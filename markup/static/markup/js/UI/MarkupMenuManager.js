import { EcgGraphMarkupManager } from "../ecg/EcgGraphMarkupManager.js";

export class MarkupMenuManager {
  #activeMarkup;

  constructor() {
    this.#activeMarkup = "QRS";
    this.#initRadioButtons();
  }

  #initRadioButtons() {
    const radioButtons = document.querySelectorAll('input[name="markup-option"]');
    radioButtons.forEach(radio => {
      radio.addEventListener("change", (event) => {
        this.#activeMarkup = event.target.value;
      });
    });
  }

  saveMarkup() {
    const markups = EcgGraphMarkupManager.getMarkups().sort((a, b) => { 
      if (a.x0 === b.x0) {
        return a.x1 - b.x1;
      }
      return a.x0 - b.x0;
    });
    const jsonData = JSON.stringify(markups, null, 2);  // Преобразуем в JSON

    // Создаем Blob и ссылку для скачивания
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Создаем временную ссылку для скачивания
    const a = document.createElement("a");
    a.href = url;
    a.download = "markup.json";  // Имя файла
    document.body.appendChild(a);
    a.click();  // Программно "кликаем" по ссылке

    // Убираем ссылку из DOM
    document.body.removeChild(a);
    URL.revokeObjectURL(url);  // Освобождаем память
  }

  getActiveMarkup() {
    return this.#activeMarkup;
  }

}