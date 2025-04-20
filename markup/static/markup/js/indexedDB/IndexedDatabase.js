export class IndexedDatabase {
  static #instance;
  #db;
  #dbName = "MarkupApp";
  #version = 1;

  constructor() {
    if (IndexedDatabase.#instance) {
      return IndexedDatabase.#instance;
    }
    IndexedDatabase.#instance = this;
  }

  async open() {
    if (this.#db?.readyState === "open") return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.#dbName, this.#version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains("markups")) {
          db.createObjectStore("markups", {
            keyPath: "id",
          });
        }

        if (!db.objectStoreNames.contains("diagnoses")) {
          db.createObjectStore("diagnoses", {
            keyPath: "id",
          });
        }
      };

      request.onsuccess = (event) => {
        this.#db = event.target.result;
        resolve();
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  async add(storeName, data) {
    try {
      await this.open();

      return new Promise((resolve, reject) => {
        const transaction = this.#db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);

        const record = {
          id: 1,
          ...data,
        };

        const request = store.put(record);

        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error(`Ошибка при сохранении в ${storeName}:`, error);
      throw error;
    }
  }

  // Проверить, что делает метод при пустых данных
  async getLatest(storeName) {
    try {
      await this.open();

      return new Promise((resolve, reject) => {
        const transaction = this.#db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);

        const request = store.get(1);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error(`Ошибка при чтении из ${storeName}:`, error);
      return null;
    }
  }
}
