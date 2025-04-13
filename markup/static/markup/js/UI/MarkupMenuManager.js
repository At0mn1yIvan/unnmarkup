import { EcgGraphMarkupManager } from "../ecg/EcgGraphMarkupManager.js";

export class MarkupMenuManager {
  #activeMarkup;
  #form;

  constructor() {
    this.#activeMarkup = document.querySelector('input[name="markup-option"]:checked').value;
    this.#form = document.getElementById("markup-form");
    this.#initRadioButtons();
    this.#initFormSubmit();
  }

  #initRadioButtons() {
    document.querySelectorAll('input[name="markup-option"]').forEach(radio => {
      radio.addEventListener("change", (event) => {
        this.#activeMarkup = event.target.value;
      });
    });
  }
// TODO: Добавляем проверку на минимальное количество разметки - пустую не сохраняем.
// TODO: Добавляем автосейв в локальное хранилище. При уходе со страницы сохраняем изменения локально.

  #initFormSubmit() {
    this.#form.addEventListener("submit", (e) => {
      const markups = EcgGraphMarkupManager.getMarkups();
      
      // имзенить тип уведомления
      if (markups.length < 6) {
        e.preventDefault();
        alert("Нельзя сохранить пустую разметку!");
        return;
      }
      
      markups.sort((a, b) => {
        if (a.x0 == b.x0) return a.x1 - b.x1;
        return a.x0 - b.x0;
      });

      document.getElementById("markup-data").value = JSON.stringify(markups, null, 2);
    });
  }

  getActiveMarkup() {
    return this.#activeMarkup;
  }

  // saveMarkup() {
  //   const markups = EcgGraphMarkupManager.getMarkups().sort((a, b) => { 
  //     if (a.x0 === b.x0) {
  //       return a.x1 - b.x1;
  //     }
  //     return a.x0 - b.x0;
  //   });
  //   const jsonData = JSON.stringify(markups, null, 2);  // Преобразуем в JSON

  //   // Создаем Blob и ссылку для скачивания
  //   const blob = new Blob([jsonData], { type: "application/json" });
  //   const url = URL.createObjectURL(blob);

  //   // Создаем временную ссылку для скачивания
  //   const a = document.createElement("a");
  //   a.href = url;
  //   a.download = "markup.json";  // Имя файла
  //   document.body.appendChild(a);
  //   a.click();  // Программно "кликаем" по ссылке

  //   // Убираем ссылку из DOM
  //   document.body.removeChild(a);
  //   URL.revokeObjectURL(url);  // Освобождаем память
  // }



}