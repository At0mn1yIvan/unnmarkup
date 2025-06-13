import os

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import wfdb
from sklearn.metrics import f1_score
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader, Dataset
from tqdm import tqdm

from common.constants import ECG_LEADS


# ECG_LEADS = [
#     "I",
#     "II",
#     "III",
#     "AVR",
#     "AVL",
#     "AVF",
#     "V1",
#     "V2",
#     "V3",
#     "V4",
#     "V5",
#     "V6",
# ]


class UNetModel(nn.Module):
    class _TwoConvLayers(nn.Module):
        def __init__(
            self,
            in_channels,
            out_channels,
            mid_channels=None,
            kernel_size=9,
            padding=4,
        ):
            super().__init__()

            if not mid_channels:
                mid_channels = out_channels

            self.model = nn.Sequential(
                nn.Conv1d(
                    in_channels,
                    mid_channels,
                    kernel_size=kernel_size,
                    padding=padding,
                    bias=False,
                ),
                nn.BatchNorm1d(mid_channels),
                nn.ReLU(inplace=True),
                nn.Conv1d(
                    mid_channels,
                    out_channels,
                    kernel_size=kernel_size,
                    padding=padding,
                    bias=False,
                ),
                nn.BatchNorm1d(out_channels),
                nn.ReLU(inplace=True),
            )

        def forward(self, x):
            return self.model(x)

    class _EncoderBlock(nn.Module):
        """Блок для спуска по сети."""

        def __init__(
            self, in_channels, out_channels, kernel_size=9, padding=4
        ):
            super().__init__()
            self.conv_block = UNetModel._TwoConvLayers(
                in_channels,
                out_channels,
                kernel_size=kernel_size,
                padding=padding,
            )
            self.max_pool = nn.MaxPool1d(2)

        def forward(self, x):
            x_skip = self.conv_block(x)
            x_down = self.max_pool(x_skip)

            return x_down, x_skip

    # class _DecoderBlock(nn.Module):
    #     """Блок для поднятия по сети."""
    #     def __init__(self, in_channels, out_channels, kernel_size=8, padding=3, stride=2):
    #         super().__init__()
    #         self.transpose = nn.ConvTranspose1d(in_channels, out_channels, kernel_size=kernel_size, padding=padding, stride=stride)
    #         self.conv_block = UNetModel._TwoConvLayers(out_channels, out_channels, kernel_size=kernel_size, padding=padding)

    #     def forward(self, x_up, x_skip):
    #         x = self.transpose(x_up)
    #         u = torch.cat([x, x_skip], dim=1)
    #         u = self.conv_block(u)
    #         return u

    class _DecoderBlock(nn.Module):
        """Блок для поднятия по сети."""

        def __init__(
            self,
            in_channels_for_transpose,  # Каналы, идущие на ConvTranspose1d
            out_channels_after_transpose,  # Каналы ПОСЛЕ ConvTranspose1d
            skip_channels,  # Каналы от skip-соединения
            final_out_channels_of_block,  # Финальные выходные каналы этого блока
            kernel_size_up=8,
            padding_up=3,
            stride_up=2,  # Параметры для ConvTranspose
            kernel_size_conv=9,
            padding_conv=4,
        ):
            super().__init__()
            self.transpose = nn.ConvTranspose1d(
                in_channels_for_transpose,
                out_channels_after_transpose,
                kernel_size=kernel_size_up,
                stride=stride_up,
                padding=padding_up,
            )

            self.conv_block = UNetModel._TwoConvLayers(
                out_channels_after_transpose + skip_channels,
                final_out_channels_of_block,
                kernel_size=kernel_size_conv,
                padding=padding_conv,
            )

        def forward(self, x_up, x_skip):
            x_transposed = self.transpose(x_up)

            u = torch.cat([x_transposed, x_skip], dim=1)
            u = self.conv_block(u)
            return u

    def __init__(self, in_channels, num_classes):
        super().__init__()

        self.enc_block1 = self._EncoderBlock(in_channels, 8)
        self.enc_block2 = self._EncoderBlock(8, 16)
        self.enc_block3 = self._EncoderBlock(16, 32)
        self.enc_block4 = self._EncoderBlock(32, 64)

        self.bottleneck = self._TwoConvLayers(64, 96)

        self.dec_block1 = self._DecoderBlock(96, 48, 64, 64)
        self.dec_block2 = self._DecoderBlock(64, 32, 32, 32)
        self.dec_block3 = self._DecoderBlock(32, 16, 16, 16)
        self.dec_block4 = self._DecoderBlock(16, 8, 8, 8)

        self.out = nn.Conv1d(8, num_classes, kernel_size=1)

    def forward(self, x):
        x, x_skip1 = self.enc_block1(x)
        x, x_skip2 = self.enc_block2(x)
        x, x_skip3 = self.enc_block3(x)
        x, x_skip4 = self.enc_block4(x)

        b = self.bottleneck(x)

        x = self.dec_block1(b, x_skip4)
        x = self.dec_block2(x, x_skip3)
        x = self.dec_block3(x, x_skip2)
        x = self.dec_block4(x, x_skip1)

        return self.out(x)


class ECGDataset(Dataset):
    def __init__(
        self,
        data_dir_path: str,
        record_names: list[str],
        is_train: bool = True,
        signal_len_points: int = 5000,
        fragment_len_points: int = 2000,
    ):
        self.data_dir_path = data_dir_path
        self.record_names = record_names
        self.is_train = is_train
        self.signal_len_points = signal_len_points
        self.fragment_len_points = fragment_len_points

        self.lead_annotator_extensions = list(map(lambda x: x.lower(), ECG_LEADS))

        self.class_map = {"p": 1, "N": 2, "t": 3}

        self.processed_samples = []

        self._load_and_process_data()

        # Делаем ограничения на диапазон данных для выдачи, поскольку первый
        # и последний сердечные циклы в LUDB записываются
        # не полностью, поэтому пропускаем первую и последнюю секунды.
        self.min_start_idx_fragment = 1000
        self.max_start_idx_fragment = (
            self.signal_len_points - (2 * 500) - self.fragment_len_points
        )

    def _create_full_mask(self, annotation_symbols, annotation_samples):
        mask = np.zeros(self.signal_len_points, dtype=np.int64)

        i = 0
        while i < len(annotation_symbols):
            if annotation_symbols[i] == "(":
                start_seg_idx = annotation_samples[i]

                if (
                    i + 2 < len(annotation_samples)
                    and annotation_symbols[i + 2] == ")"
                ):
                    wave_char = annotation_symbols[i + 1]

                    end_seg_idx = annotation_samples[i + 2]

                    class_id = self.class_map.get(wave_char, 0)

                    if class_id != 0:
                        mask[start_seg_idx : end_seg_idx + 1] = class_id

                    i += 2
            i += 1
        return mask

    def _load_and_process_data(self):
        print(
            f"Загрузка и обработка данных для {'обучения' if self.is_train else 'валидации'}..."
        )
        for record_name in tqdm(
            self.record_names, desc="Обработка записей ludb"
        ):
            record_path = os.path.join(self.data_dir_path, record_name)
            try:
                # Загружаем все 12 отведений сразу
                signals_all_leads, meta = wfdb.rdsamp(
                    record_path
                )  # signals_all_leads: (5000, 12)
                if signals_all_leads.shape != (12, 5000):
                    signals_all_leads = (
                        signals_all_leads.T
                    )  # signals_all_leads: (12, 5000)

                if signals_all_leads.shape[1] != self.signal_len_points:
                    print(
                        f"Предупреждение: Длина сигнала для записи {record_name} ({signals_all_leads.shape[1]})"
                        f" не равна ожидаемой ({self.signal_len_points}). Пропуск."
                    )
                    continue

                # Итерируемся по каждому отведению
                for lead_idx, lead_name_lower in enumerate(
                    self.lead_annotator_extensions
                ):

                    signal_one_lead = signals_all_leads[lead_idx, :]

                    try:
                        # Загружаем аннотации для текущего отведения, используя его имя как расширение
                        annotation = wfdb.rdann(
                            record_path, extension=lead_name_lower
                        )
                        mask_one_lead = self._create_full_mask(
                            annotation.symbol, annotation.sample
                        )

                        self.processed_samples.append(
                            (signal_one_lead.astype(np.float32), mask_one_lead)
                        )
                    except FileNotFoundError:
                        # Создание пустой маски
                        mask_one_lead = np.zeros(
                            self.signal_len_points, dtype=np.int64
                        )
                        self.processed_samples.append(
                            (signal_one_lead.astype(np.float32), mask_one_lead)
                        )
                    except Exception as e_ann:
                        print(
                            f"Ошибка при чтении аннотаций для {record_name}.{lead_name_lower}: {e_ann}"
                        )

            except Exception as e_rec:
                print(f"Ошибка при обработке записи {record_name}: {e_rec}")

        print(f"Загружено {len(self.processed_samples)} пар сигнал-маска.")

    def __len__(self):
        return len(self.processed_samples)

    def __getitem__(self, index):
        full_signal, full_mask = self.processed_samples[index]

        if self.is_train:
            start_idx = np.random.randint(
                self.min_start_idx_fragment, self.max_start_idx_fragment + 1
            )
        else:
            start_idx = 1500

        end_idx = start_idx + self.fragment_len_points

        signal_fragment = full_signal[start_idx:end_idx]
        mask_fragment = full_mask[start_idx:end_idx]

        signal_tensor = torch.from_numpy(signal_fragment).unsqueeze(0).float()
        mask_tensor = torch.from_numpy(mask_fragment).long()

        return {"signal": signal_tensor, "mask": mask_tensor}


def train_model(ludb_data_dir="ludb/data", num_epochs=100):
    LUDB_DATA_DIR = ludb_data_dir

    NUM_EPOCHS = num_epochs
    BATCH_SIZE = 16

    LEARNING_RATE = 1e-4
    VAL_SPLIT = 0.2
    RANDOM_SEED = 42

    NUM_WORKERS = 0
    NUM_CLASSES = 4
    INPUT_CHANNELS = 1

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    if not os.path.isdir(LUDB_DATA_DIR):
        print(
            f"Ошибка: Директория {LUDB_DATA_DIR} не найдена. Укажите правильный путь."
        )
        return

    all_dat_files = [
        f for f in os.listdir(LUDB_DATA_DIR) if f.endswith(".dat")
    ]
    available_record_names = sorted(
        list(set([f.split(".")[0] for f in all_dat_files]))
    )[
        :190
    ]  # Берем 10 записей для предсказаний в сервисе

    if not available_record_names:
        print(
            f"В директории {LUDB_DATA_DIR} не найдены файлы .dat. Проверьте путь."
        )
        return
    print(f"Найдено ЭКГ записей: {len(available_record_names)}")

    train_rec_names, val_rec_names = train_test_split(
        available_record_names, test_size=VAL_SPLIT, random_state=RANDOM_SEED
    )
    print(
        f"Записей для обучения: {len(train_rec_names)}, для валидации: {len(val_rec_names)}"
    )

    train_dataset = ECGDataset(
        data_dir_path=LUDB_DATA_DIR,
        record_names=train_rec_names,
        is_train=True,
    )
    val_dataset = ECGDataset(
        data_dir_path=LUDB_DATA_DIR, record_names=val_rec_names, is_train=False
    )

    if len(train_dataset) == 0 or len(val_dataset) == 0:
        print(
            "Один из датасетов пуст. Проверьте процесс загрузки данных, пути и наличие аннотаций."
        )
        return

    train_loader = DataLoader(
        train_dataset,
        batch_size=BATCH_SIZE,
        shuffle=True,
        num_workers=NUM_WORKERS,
        pin_memory=True if device.type == "cuda" else False,
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=NUM_WORKERS,
        pin_memory=True if device.type == "cuda" else False,
    )
    print(
        f"Размер обучающего датасета (отведения): {len(train_dataset)}, батчей: {len(train_loader)}"
    )
    print(
        f"Размер валидационного датасета (отведения): {len(val_dataset)}, батчей: {len(val_loader)}"
    )

    # --- Инициализация модели, функции потерь, оптимизатора ---
    model = UNetModel(in_channels=INPUT_CHANNELS, num_classes=NUM_CLASSES).to(
        device
    )
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    # Опционально: scheduler для изменения learning rate
    # scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, 'min', patience=3, factor=0.1, verbose=True)

    # --- Цикл обучения ---
    # best_val_loss = float("inf")  # Для сохранения лучшей модели
    best_val_f1_macro = 0.0

    for epoch in range(NUM_EPOCHS):
        # --- Обучение ---
        model.train()
        running_train_loss = 0.0

        # Обертка train_loader в tqdm для прогресс-бара
        train_progress_bar = tqdm(
            train_loader, desc=f"Epoch {epoch+1}/{NUM_EPOCHS} [Train]"
        )
        for batch in train_progress_bar:
            signals = batch["signal"].to(device)
            masks = batch["mask"].to(device)

            optimizer.zero_grad()
            outputs = model(signals)
            loss = criterion(outputs, masks)
            loss.backward()
            optimizer.step()

            running_train_loss += loss.item()
            train_progress_bar.set_postfix(loss=loss.item())

        avg_train_loss = running_train_loss / len(train_loader)
        print(
            f"Epoch [{epoch+1}/{NUM_EPOCHS}] - Training Loss: {avg_train_loss:.4f}"
        )

        # --- Валидация ---
        model.eval()
        running_val_loss = 0.0

        all_val_preds_epoch = []
        all_val_masks_epoch = []

        # correct_pixels = 0
        # total_pixels = 0

        val_progress_bar = tqdm(
            val_loader, desc=f"Epoch {epoch+1}/{NUM_EPOCHS} [Val]"
        )
        with torch.no_grad():
            for batch in val_progress_bar:
                signals = batch["signal"].to(device)
                masks = batch["mask"].to(device)

                outputs = model(signals)
                loss = criterion(outputs, masks)
                running_val_loss += loss.item()

                _, predicted_classes = torch.max(outputs, 1)

                all_val_preds_epoch.append(
                    predicted_classes.cpu().numpy().flatten()
                )
                all_val_masks_epoch.append(masks.cpu().numpy().flatten())

                # correct_pixels += (predicted_classes == masks).sum().item()
                # total_pixels += masks.nelement()
                val_progress_bar.set_postfix(loss=loss.item())

        avg_val_loss = running_val_loss / len(val_loader)

        # Вычисление метрик после прохода по всем валидационным данным
        pixel_accuracy = 0
        f1_macro = 0
        f1_p_wave, f1_qrs, f1_t_wave = 0, 0, 0

        if len(all_val_preds_epoch) > 0:
            all_val_preds_flat = np.concatenate(all_val_preds_epoch)
            all_val_masks_flat = np.concatenate(all_val_masks_epoch)

            # Pixel Accuracy (по всем классам, включая фон)
            correct_pixels = (all_val_preds_flat == all_val_masks_flat).sum()
            total_pixels = len(all_val_masks_flat)
            pixel_accuracy = (
                (correct_pixels / total_pixels) * 100
                if total_pixels > 0
                else 0
            )

            # F1 Scores (только для классов P, QRS, T - метки 1, 2, 3)
            # Убедимся, что у нас есть предсказания и истинные метки для этих классов
            unique_true_labels = np.unique(all_val_masks_flat)
            labels_to_calc_f1 = [
                lbl for lbl in [1, 2, 3] if lbl in unique_true_labels
            ]

            if labels_to_calc_f1:
                f1_macro = f1_score(
                    all_val_masks_flat,
                    all_val_preds_flat,
                    labels=labels_to_calc_f1,
                    average="macro",
                    zero_division=0,
                )

                f1_per_class = f1_score(
                    all_val_masks_flat,
                    all_val_preds_flat,
                    labels=labels_to_calc_f1,
                    average=None,
                    zero_division=0,
                )

                # Сопоставление F1 с классами P, QRS, T
                class_to_f1_idx = {
                    label: i for i, label in enumerate(labels_to_calc_f1)
                }
                f1_p_wave = (
                    f1_per_class[class_to_f1_idx[1]]
                    if 1 in class_to_f1_idx
                    else 0
                )
                f1_qrs = (
                    f1_per_class[class_to_f1_idx[2]]
                    if 2 in class_to_f1_idx
                    else 0
                )
                f1_t_wave = (
                    f1_per_class[class_to_f1_idx[3]]
                    if 3 in class_to_f1_idx
                    else 0
                )
            else:
                print(
                    "Внимание: в валидационных масках нет классов P, QRS или T для расчета F1."
                )

        print(
            f"Epoch [{epoch+1}/{NUM_EPOCHS}] - Validation Loss: {avg_val_loss:.4f}, Pixel Acc: {pixel_accuracy:.2f}%"
        )
        print(f"  F1-Macro (P,QRS,T): {f1_macro:.4f}")
        print(
            f"  F1 P-wave: {f1_p_wave:.4f}, F1 QRS-complex: {f1_qrs:.4f}, F1 T-wave: {f1_t_wave:.4f}"
        )

        if f1_macro > best_val_f1_macro:
            best_val_f1_macro = f1_macro
            torch.save(model.state_dict(), "best_ecg_unet_model_f1.pth")
            print(
                f"Модель сохранена как best_ecg_unet_model_f1.pth (Val F1-Macro: {best_val_f1_macro:.4f})"
            )

    print("Обучение завершено.")


def extract_segments_from_mask_array(mask_array, class_id_map_inverse):
    segments = {wave_name: [] for wave_name in class_id_map_inverse.values()}
    for class_id, wave_name in class_id_map_inverse.items():
        in_segment = False
        start_idx = -1
        for i, label in enumerate(mask_array):
            if label == class_id and not in_segment:
                in_segment = True
                start_idx = i
            elif label != class_id and in_segment:
                in_segment = False
                segments[wave_name].append((start_idx, i - 1))
                start_idx = -1
        if in_segment:
            segments[wave_name].append((start_idx, len(mask_array) - 1))
    return segments


def predict(signal_all_leads: np.ndarray, lead_to_predict="I"):
    MODEL_PATH = 'best_ecg_unet_model_f1.pth'

    NUM_CLASSES = 4
    INPUT_CHANNELS = 1
    FRAGMENT_LENGTH = 2000
    STRIDE = 1500
    BATCH_SIZE_INFERENCE = 16

    CLASS_ID_MAP = {1: "P", 2: "QRS", 3: "T"}

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    loaded_model = UNetModel(in_channels=INPUT_CHANNELS, num_classes=NUM_CLASSES)
    try:
        loaded_model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
        print(f"Веса модели успешно загружены")
    except Exception as e:
        print(f"Ошибка при загрузке весов модели: {e}")
        return
    loaded_model.to(device)
    loaded_model.eval()

    try:
        lead_to_predict_idx = ECG_LEADS.index(lead_to_predict.upper())
        predict_signal = signal_all_leads[lead_to_predict_idx, :].astype(np.float32)
        print(f"\nЗагружен сигнал. Отведение {lead_to_predict}")
    except Exception as e:
        print(f"Ошибка при загрузке сигнала: {e}")
        return

    predict_signal_length = len(predict_signal)
    sum_logits_np = np.zeros((NUM_CLASSES, predict_signal_length), dtype=np.float32)
    overlap_counts_np = np.zeros(predict_signal_length, dtype=np.float32)

    all_fragments_np_list = []
    all_start_idx_list = []

    for start_idx in range(0, predict_signal_length - FRAGMENT_LENGTH + 1, STRIDE):
        all_fragments_np_list.append(predict_signal[start_idx: start_idx + FRAGMENT_LENGTH])
        all_start_idx_list.append(start_idx)

    last_processed_end = 0
    if all_start_idx_list:
        last_processed_end = all_start_idx_list[-1] + FRAGMENT_LENGTH

    if last_processed_end < predict_signal_length:
        start_idx_last_frag = max(0, predict_signal_length - FRAGMENT_LENGTH)
        if not all_start_idx_list or start_idx_last_frag != all_start_idx_list[-1]:
            all_fragments_np_list.append(predict_signal[start_idx_last_frag : start_idx_last_frag + FRAGMENT_LENGTH])
            all_start_idx_list.append(start_idx_last_frag)

    print(f"Сигнал будет обработан {len(all_fragments_np_list)} окнами по {FRAGMENT_LENGTH} точек с шагом {STRIDE}.")
    print(f"Инференс будет выполняться батчами по {BATCH_SIZE_INFERENCE} фрагментов.")

    with torch.no_grad():
        total_fragments_length = len(all_fragments_np_list)
        for batch_start_idx in range(0, total_fragments_length, BATCH_SIZE_INFERENCE):
            batch_end_idx = min(batch_start_idx + BATCH_SIZE_INFERENCE, total_fragments_length)

            current_fragments_for_batch_np_list = all_fragments_np_list[batch_start_idx:batch_end_idx]
            current_start_indices_for_batch = all_start_idx_list[batch_start_idx:batch_end_idx]

            fragments_batch_np = np.stack(current_fragments_for_batch_np_list, axis=0)

            batch_tensor = torch.from_numpy(fragments_batch_np).unsqueeze(1).float().to(device)

            # Предсказания
            batch_logits_tensor = loaded_model(batch_tensor)
            batch_logits_np = batch_logits_tensor.cpu().numpy()

            for i in range(batch_logits_np.shape[0]):
                single_fragment_logits_np = batch_logits_np[i]
                original_start_idx = current_start_indices_for_batch[i]

                sum_logits_np[:, original_start_idx: original_start_idx + FRAGMENT_LENGTH] += single_fragment_logits_np
                overlap_counts_np[original_start_idx: original_start_idx + FRAGMENT_LENGTH] += 1

    averaged_logits_np = sum_logits_np / np.maximum(overlap_counts_np, 1)
    predicted_classes_np = np.argmax(averaged_logits_np, axis=0)

    segmented_intervals = extract_segments_from_mask_array(predicted_classes_np, CLASS_ID_MAP)

    all_predictions = []
    for wave_type, intervals in segmented_intervals.items():
        for start, end in intervals:
            all_predictions.append({"type": wave_type, "x0": start, "x1": end})

    all_predictions.sort(key=lambda x: (x["x0"], x["x1"]))

    return all_predictions


if __name__ == "__main__":
    # Тестирование разметки
    data = np.load("ludb/npy_signals/191.npy").T

    predict(data)
