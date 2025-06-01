import torch
import torch.nn as nn


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


if __name__ == "__main__":
    # 1. Определение устройства
    if torch.cuda.is_available():
        device = torch.device("cuda")
        print(
            f"CUDA доступен. Используется GPU: {torch.cuda.get_device_name(0)}"
        )
    else:
        device = torch.device("cpu")
        print("CUDA недоступен. Используется CPU.")

    # Параметры для тестирования
    batch_size = 2  # Можно увеличить, если позволяет память GPU
    num_channels_in = 1  # 1 канал для ЭКГ
    signal_length = 2000  # Длина сигнала 4 секунды * 500 Гц
    num_classes = 4  # P, QRS, T, Фон

    # 2. Создание модели и перемещение на устройство
    model = UNetModel(in_channels=num_channels_in, num_classes=num_classes)
    model.to(device)
    model.eval()

    # 3. Создание входных данных и перемещение на устройство
    # Используем torch.float32, так как веса модели обычно в этом формате
    dummy_ecg_signal = torch.randn(
        batch_size, num_channels_in, signal_length, dtype=torch.float32
    )
    dummy_ecg_signal = dummy_ecg_signal.to(device)

    print(
        f"\nInput shape: {dummy_ecg_signal.shape}, Device: {dummy_ecg_signal.device}"
    )

    # Выполнение прямого прохода (инференс)
    # torch.no_grad() используется для отключения вычисления градиентов,
    # что экономит память и ускоряет инференс.
    with torch.no_grad():
        output_logits = model(dummy_ecg_signal)

    print(
        f"Output (logits) shape: {output_logits.shape}, Device: {output_logits.device}"
    )

    # Если нужно вернуть результат на CPU для дальнейшей обработки (например, с NumPy):
    # output_logits_cpu = output_logits.cpu()

    # Подсчет количества обучаемых параметров (остается на CPU)
    total_params = sum(
        p.numel() for p in model.parameters() if p.requires_grad
    )
    print(f"Total trainable parameters: {total_params:,}")

    # Дополнительно: можно проверить время выполнения
    import time

    # Прогрев GPU (первый прогон может быть медленнее)
    with torch.no_grad():
        for _ in range(5):  # Несколько "прогревочных" прогонов
            _ = model(dummy_ecg_signal)

    num_iterations = 100
    start_time = time.time()
    with torch.no_grad():
        for _ in range(num_iterations):
            _ = model(dummy_ecg_signal)
    end_time = time.time()

    avg_time_per_batch = (end_time - start_time) / num_iterations
    print(
        f"\nAverage inference time per batch (batch_size={batch_size}) over {num_iterations} iterations: {avg_time_per_batch*1000:.2f} ms"
    )
    print(
        f"Average inference time per signal: {(avg_time_per_batch / batch_size)*1000:.2f} ms"
    )
