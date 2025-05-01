import { EcgGraphMarkupManager } from "../ecg/EcgGraphMarkupManager.js";
import { IndexedDatabase } from "../indexedDB/IndexedDatabase.js";

export class MarkupMenuManager {
  #activeMarkup;

  constructor() {
    this.#activeMarkup = document.querySelector('input[name="markup-option"]:checked').value;
    this.#initRadioButtons();
    this.#initSaveButton();
  }

  #initRadioButtons() {
    document.querySelectorAll('input[name="markup-option"]').forEach(radio => {
      radio.addEventListener("change", (event) => {
        this.#activeMarkup = event.target.value;
      });
    });
  }

// TODO: Добавляем автосейв в локальное хранилище. При уходе со страницы автоматически сохраняем изменения локально.
  #initSaveButton() {
    const saveBtn = document.getElementById("save-markup-btn");
    saveBtn.addEventListener("click", async (e) => {
      
      // const markups = EcgGraphMarkupManager.getMarkups();
      const markups = this.markups;
      // имзенить тип уведомления
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

      //localStorage.setItem("savedMarkup", JSON.stringify(markups, null, 2));
      //localStorage.setItem("savedMarkup", JSON.stringify(markups));

      try {
        await IndexedDatabase.add("markups", { data: markups });
        console.log("GetLatest:", await IndexedDatabase.getLatest("markups"));
      }
      catch (error){
        console.error("Ошибка сохранения разметки:", error);
        alert("Ошибка сохранения разметки");
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