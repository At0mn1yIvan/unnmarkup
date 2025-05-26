export class IndexedDatabase {
  static #db = null;
  static #dbName = "MarkupApp";
  static #version = 1;

  constructor() {
    throw new Error("Use static methods instead of instantiating");
  }

  static async #open() {
    // Открытие или создание БД
    if (this.#db) return;

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

  static async add(storeName, data) {
    // Добавление данных в БД
    try {
      await this.#open();
      
      return new Promise((resolve, reject) => {
        const transaction = this.#db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);

        const timeoutId = setTimeout(() => {
          transaction.abort();
          reject(new Error("Транзакция превысила время выполнения"));
        }, 5000);

        transaction.oncomplete = () => {
          clearTimeout(timeoutId);
          resolve();
        };
        transaction.onerror = (event) => {
          clearTimeout(timeoutId);
          event.stopPropagation(); // Важно!
          reject(event.target.error);
        };
        transaction.onabort = () => {
          clearTimeout(timeoutId);
          reject(transaction.error || new Error("Транзакция прервана"));
        };

        const record = {
          id: 1,
          ...data,
        };

        store.put(record);
      });
    } catch (error) {
      console.error(`Ошибка при сохранении в ${storeName}:`, error);
      throw error;
    }
  }

  static async getLatest(storeName) {
    // Получение последних данных из БД
    try {
      await this.#open();

      return new Promise((resolve, reject) => {
        const transaction = this.#db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);

        const request = store.get(1);
        // Если пусто, то возврат undefined
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      console.error(`Ошибка при чтении из ${storeName}:`, error);
      return null;
    }
  }

  static async hasData() {
    try {
      await this.#open();
      const transaction = this.#db.transaction(['markups', 'diagnoses'], 'readonly');
      
      const [markupsCount, diagnosesCount] = await Promise.all([
        new Promise((resolve) => {
          const countRequest = transaction.objectStore('markups').count();
          countRequest.onsuccess = () => resolve(countRequest.result);
          countRequest.onerror = () => resolve(0);
        }),
        new Promise((resolve) => {
          const countRequest = transaction.objectStore('diagnoses').count();
          countRequest.onsuccess = () => resolve(countRequest.result);
          countRequest.onerror = () => resolve(0);
        })
      ]);
  
      return (markupsCount + diagnosesCount) > 0;
    } catch {
      return false;
    }
  }

  static async deleteDatabase() {
    if (this.#db) {
      this.#db.close();
      this.#db = null;
    }

    // Удаление базы данных при выходе из профиля
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.#dbName);

      request.onsuccess = () => {
        //this.#db = null;
        resolve();
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };

      request.onblocked = () => {
        reject(new Error("База данных заблокирована в других вкладках"));
      };
    });
  }
}
