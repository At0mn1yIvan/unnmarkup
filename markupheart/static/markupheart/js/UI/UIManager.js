import { MarkupMenuManager } from "../UI/MarkupMenuManager.js";
import { DiseaseTreeManager } from "../UI/DiseaseTreeManager.js";

// Константы для имен вкладок
const TABS = {
  MARKUP: "markup",
  DIAGNOSIS: "diagnosis",
};

export class UIManager {
  markupMenuManager;
  diseaseTreeManager;
  #saveButton;
  #activeTab = TABS.MARKUP;  // Текущая активная вкладка

  constructor() {
    this.markupMenuManager = new MarkupMenuManager();
    this.diseaseTreeManager = new DiseaseTreeManager();

    this.#initSaveButton();
    this.#initTabs();
  }

  // Инициализация вкладок
  #initTabs() {
    const tabButtons = document.querySelectorAll(".tab-button");
    const tabContents = document.querySelectorAll(".tab-content");

    tabButtons.forEach(button => {
      button.addEventListener("click", () => {
        const activeTab = button.dataset.tab;

        // Убираем активный класс у всех кнопок
        tabButtons.forEach(btn => btn.classList.remove("active"));
        // Показываем только выбранную вкладку
        tabContents.forEach(content => content.style.display = "none");

        // Активируем выбранную кнопку и вкладку
        button.classList.add("active");
        document.getElementById(`${activeTab}-content`).style.display = "block";

        // Обновляем активную вкладку и текст кнопки
        this.#activeTab = activeTab;
        this.#updateSaveButton();
      });
    });
  }

  // Инициализация кнопки сохранения
  #initSaveButton() {
    this.#saveButton = document.getElementById("save-button");
    this.#saveButton.addEventListener("click", () => this.#handleSave());
  }

  // Обновление текста кнопки
  #updateSaveButton() {
    const buttonText = {
      [TABS.MARKUP]: "Сохранить разметку",
      [TABS.DIAGNOSIS]: "Сохранить диагнозы",
    };

    this.#saveButton.innerText = buttonText[this.#activeTab];
  }

  // Обработчик нажатия на кнопку сохранения
  #handleSave() {
    const actions = {
      [TABS.MARKUP]: () => this.markupMenuManager.saveMarkup(),
      [TABS.DIAGNOSIS]: () => this.diseaseTreeManager.parseDiseases(),
    };

    actions[this.#activeTab]();
  }
}