import os
from pathlib import Path
from pprint import pprint

import numpy as np
import wfdb
import wfdb.io

from tqdm import tqdm


def download_ludb(data_dir_path: str) -> None:
    # Загрузка базы данных для тестирования сервиса и обучения нейронной сети

    Path(data_dir_path).mkdir(exist_ok=True)

    if os.listdir(data_dir_path):
        return

    wfdb.io.dl_database("ludb", data_dir_path)


def convert_ludb_to_npy_signals(data_dir_path: str) -> None:
    """Метод для конвертации сигналов из LUDB в npy для тестирования сервиса."""
    npy_signals_dir = os.path.join(os.getcwd(), "ludb", "npy_signals")
    Path(npy_signals_dir).mkdir(exist_ok=True)

    if os.listdir(npy_signals_dir):
        return

    all_files = os.listdir(data_dir_path)
    record_names = list(
        set([f.split(".")[0] for f in all_files if f.endswith(".dat")])
    )

    for record_name in tqdm(record_names):
        try:
            record_path = os.path.join(data_dir_path, record_name)

            signal, _ = wfdb.rdsamp(record_path)

            output_path = os.path.join(npy_signals_dir, f"{record_name}.npy")
            np.save(output_path, signal.T)
        except Exception as e:
            print(f"\nОшибка в записи {record_name}: {str(e)}")


if __name__ == "__main__":
    dir_name = "ludb"
    dir_path = os.path.join(os.getcwd(), dir_name)
    # download_ludb(dir_path)
    # convert_ludb_to_npy_signals(os.path.join(dir_path, "data"))

    dataset = ECGDataset(os.path.join(dir_path, "data"))
    print(dataset[0]["mask"])
    print(dataset[0]["signal"])
    print(len(dataset[0]["mask"]))
    print(len(dataset[0]["signal"]))

    # pprint(fields)

    # ann = wfdb.rdann("ludb/data/10", "i")

    # print(ann.sample)
    # print(ann.symbol)
