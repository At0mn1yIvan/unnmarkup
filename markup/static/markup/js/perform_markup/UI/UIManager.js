import { MarkupMenuManager } from "./MarkupMenuManager.js";
import { DiseaseTreeManager } from "./DiseaseTreeManager.js";
import { IndexedDatabase } from "../indexedDB/IndexedDatabase.js";

export class UIManager {
  markupMenuManager;
  diseaseTreeManager;
  static isAutosave = true; // поле-флаг, отключающее автосохранение разметки для определенных действий

  constructor(diagnosesTreeStructure) {
    this.markupMenuManager = new MarkupMenuManager();
    this.diseaseTreeManager = new DiseaseTreeManager(
      diagnosesTreeStructure,
      "diagnosis-tree-container"
    );

    this.#initAutoSaveDB();
    this.#initValidationButton();
  }

  #initValidationButton() {
    const submitBtn = document.getElementById("submit-validation-btn");
    // if (!submitBtn) return;

    submitBtn?.addEventListener("click", async (e) => {
      e.preventDefault();
      // меняем на красивую плашку.
      const isConfirmed = confirm(
        "Вы уверены, что хотите отправить данные? После отправки отредактировать разметку будет невозможно"
      );
      if (!isConfirmed) return;

      try {
        const [savedMarkups, savedDiagnoses] = await Promise.all([
          IndexedDatabase.getLatest("markups"),
          IndexedDatabase.getLatest("diagnoses"),
        ]);

        const markups = this.markupMenuManager.markups || savedMarkups?.data;
        const diagnoses = this.diseaseTreeManager.selectedDiagnoses || savedDiagnoses?.data;

        if (markups.length < 6) {
          // проверяем только длину разметки, так как
          // диагнозы к разметке не обязательны в текущей итерации проекта
          alert("Недостаточно данных для отправки!");
          return;
        }

        document.getElementById("markup-data").value = JSON.stringify(markups);
        document.getElementById("diagnoses-data").value = JSON.stringify(diagnoses);

        UIManager.isAutosave = false;

        await IndexedDatabase.deleteDatabase();

        document.getElementById("validation-form").submit();

      } catch (error) {
        console.error("Ошибка отправки:", error);
        alert("Ошибка при подготовке данных к отправке");
        UIManager.isAutosave = true; 
      } finally {
        submitBtn.blur();
      }
    });
  }

  #initAutoSaveDB() {
    // 1. Перехват кликов по ссылкам (только для внутренней навигации при переходе
    // на другие вкладки сервиса со страницы разметки).
    document.body.addEventListener(
      "click",
      (e) => {
        // const isMarkupPage = window.location.pathname.endsWith("/markup/");
        // if (!isMarkupPage) return; // Выходим, если находимся не на странице разметки

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
    if (!UIManager.isAutosave) return;

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
