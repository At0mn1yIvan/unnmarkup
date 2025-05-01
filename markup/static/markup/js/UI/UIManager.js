import { MarkupMenuManager } from "../UI/MarkupMenuManager.js";
import { DiseaseTreeManager } from "../UI/DiseaseTreeManager.js";
import { IndexedDatabase } from "../indexedDB/IndexedDatabase.js";


export class UIManager {
  markupMenuManager;
  diseaseTreeManager;
  static isLoggingOut = false;

  constructor(diseasesData) {
    this.markupMenuManager = new MarkupMenuManager();
    this.diseaseTreeManager = new DiseaseTreeManager(
      diseasesData,
      "diagnosis-tree-container",
    );

    this.#initAutoSaveDB();
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


  #initAutoSaveDB() {
    // 1. Перехват кликов по ссылкам (только для внутренней навигации при переходе
    // на другие вкладки сервиса со страницы разметки).
    document.body.addEventListener(
      "click",
      (e) => {
        const isMarkupPage = window.location.pathname.endsWith("/markup/");
        if (!isMarkupPage) return; // Выходим, если находимся не на странице разметки

        const link = e.target.closest("a");
        if (!link || !link.hasAttribute("data-save-before-nav")) return;
        e.preventDefault();
        this.#saveBeforeNavigation(link);
      },
      true
    );

    //2. Обработчики для переключения вкладок/закрытия страницы
    document.addEventListener(
      "visibilitychange",
      this.#handlePageExit.bind(this)
    );
    window.addEventListener("beforeunload", this.#handlePageExit.bind(this));
  }

  // Сохранение перед переходом
  async #saveBeforeNavigation(link) {
    try {
      await this.#saveCurrentData();
      window.location.href = link.href;
    } catch (error) {
      console.error("Ошибка при сохранении:", error);
    }
  }

  async #handlePageExit() {
    if (UIManager.isLoggingOut) return;

    if (
      document.visibilityState === "hidden" ||
      event.type === "beforeunload"
    ) {
      await this.#saveCurrentData();
    }
  }

  async #saveCurrentData() {
    const markups = this.markupMenuManager.markups;
    const diagnoses = this.diseaseTreeManager.selectedDiagnoses;

    if (markups.length > 0) {
      await IndexedDatabase.add("markups", { data: markups });
    }

    if (diagnoses.length > 0) {
      await IndexedDatabase.add("diagnoses", { data: diagnoses });
    }
  }
}
