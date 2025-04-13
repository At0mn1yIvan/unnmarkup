import { MarkupMenuManager } from "../UI/MarkupMenuManager.js";
import { DiseaseTreeManager } from "../UI/DiseaseTreeManager.js";

export class UIManager {
  markupMenuManager;
  diseaseTreeManager;

  constructor(diseasesData) {
    this.markupMenuManager = new MarkupMenuManager();
    this.diseaseTreeManager = new DiseaseTreeManager(
      diseasesData,
      "diagnosis-tree-container"
    );
    this.#initTabs();
  }

  // Инициализация вкладок
  #initTabs() {
    const tabButtons = document.querySelectorAll(".tab-button");
    const tabContents = document.querySelectorAll(".tab-content");

    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const activeTab = button.dataset.tab;

        // Убираем активный класс у всех кнопок
        tabButtons.forEach((btn) => btn.classList.remove("active"));
        // Показываем только выбранную вкладку
        tabContents.forEach((content) => (content.style.display = "none"));

        // Активируем выбранную кнопку и вкладку
        button.classList.add("active");
        document.getElementById(`${activeTab}-content`).style.display = "block";

      });
    });
  }
}

