import { EcgGraphMarkupManager } from "../ecg/EcgGraphMarkupManager.js";
import { IndexedDatabase } from "../indexedDB/IndexedDatabase.js";

export class MarkupMenuManager {
  #activeMarkup;

  constructor() {
    this.#activeMarkup = document.querySelector(
      'input[name="markup-option"]:checked'
    ).value;
    this.#initRadioButtons();
    this.#initSaveButton();
  }

  #initRadioButtons() {
    document
      .querySelectorAll('input[name="markup-option"]')
      .forEach((radio) => {
        radio.addEventListener("change", (event) => {
          this.#activeMarkup = event.target.value;
        });
      });
  }

  #initSaveButton() {
    const saveBtn = document.getElementById("save-markup-btn");
    //if (!saveBtn) return;
    saveBtn?.addEventListener("click", async (e) => {
      const markups = this.markups;
      if (markups.length < 6) {
        e.preventDefault();
        //TODO: добавляем красивый toast с алертом
        alert("Недостаточно данных для сохранения");
        return;
      }

      markups.sort((a, b) => {
        if (a.x0 == b.x0) return a.x1 - b.x1;
        return a.x0 - b.x0;
      });

      // saveBtn.disabled = true;
      // saveBtn.textContent = "Сохранение...";

      try {
        await IndexedDatabase.add("markups", { data: markups });
        console.log("GetLatest:", await IndexedDatabase.getLatest("markups"));
      } catch (error) {
        console.error("Ошибка сохранения разметки:", error);
        alert("Ошибка сохранения разметки");
      } finally {
        saveBtn.blur();
        // saveBtn.disabled = false;
        // saveBtn.textContent = "Сохранить разметку локально";
      }
      //Добавляем toast вниз экрана, что данные успешно сохранены
      // При редиректе делаем автосейв данных
    });
  }

  get activeMarkup() {
    return this.#activeMarkup;
  }

  get markups() {
    return EcgGraphMarkupManager.getMarkups();
  }
}
