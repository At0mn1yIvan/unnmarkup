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
    this.diseaseTreeManager = new DiseaseTreeManager("diagnosis-content");

    this.diseaseTreeManager.render();

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
    const buttonConfig = {
      [TABS.MARKUP]: {
        text: "Сохранить разметку",
        handler: () => this.markupMenuManager.saveMarkup()
      },
      [TABS.DIAGNOSIS]: {
        text: "Сохранить диагнозы",
        handler: () => this.#saveDiagnoses()
      }
    };

    const config = buttonConfig[this.#activeTab];
    this.#saveButton.textContent = config.text;
  }

  // Обработчик нажатия на кнопку сохранения
  #handleSave() {
    const actions = {
      [TABS.MARKUP]: () => this.markupMenuManager.saveMarkup(),
      [TABS.DIAGNOSIS]: () => this.#saveDiagnoses()
    };

    actions[this.#activeTab]();
  }

  async #saveDiagnoses() {
    try {
      const selectedDiagnoses = this.diseaseTreeManager.getSelectedDiagnoses();
      
      // Здесь должна быть логика отправки на сервер
      console.log("Selected diagnoses:", selectedDiagnoses);
      
      // Пример отправки через fetch:
      const response = await fetch("/save-diagnoses/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": this.#getCsrfToken()
        },
        body: JSON.stringify({ diagnoses: selectedDiagnoses })
      });

      if (!response.ok) throw new Error("Ошибка сохранения");
      alert("Диагнозы успешно сохранены!");
    } catch (error) {
      console.error("Ошибка:", error);
      alert("Произошла ошибка при сохранении");
    }
  }

  #getCsrfToken() {
    return document.querySelector("[name=csrfmiddlewaretoken]").value;
  }
}