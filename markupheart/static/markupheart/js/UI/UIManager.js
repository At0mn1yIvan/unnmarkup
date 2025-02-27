import { EcgGraphMarkupManager } from "../ecg/EcgGraphMarkupManager.js";

export class UIManager {
  activeMarkup;
  diseases;

  constructor() {
    this.activeMarkup = "QRS";
    this.diseases = window.diseases;
    this.initTabs();
    this.initRadioButtons();
    this.initSaveButton();
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

  initSaveButton() {
    const saveButton = document.getElementById("save-markup-button");
    saveButton.addEventListener("click", () => this.saveMarkup());
  }

  // Инициализация вкладок
  initTabs() {
    const tabButtons = document.querySelectorAll(".tab-button");
    const tabContents = document.querySelectorAll(".tab-content");

    tabButtons.forEach(button => {
      button.addEventListener("click", () => {
        // Убираем активный класс у всех кнопок
        tabButtons.forEach(btn => btn.classList.remove("active"));
        // Показываем только выбранную вкладку
        tabContents.forEach(content => content.style.display = "none");

        // Активируем выбранную кнопку и вкладку
        button.classList.add("active");
        const targetTab = document.getElementById(`${button.dataset.tab}-content`);
        targetTab.style.display = "block";
      });
    });
  }

  // Инициализация радиокнопок
  initRadioButtons() {
    const radioButtons = document.querySelectorAll('input[name="markup-option"]');
    radioButtons.forEach(radio => {
      radio.addEventListener("change", (event) => {
        this.activeMarkup = event.target.value;
      });
    });
  }

  // Получить текущий выбранный тип разметки
  getActiveMarkup() {
    return this.activeMarkup;
  }

  parseDiseases() {
    const root = [];  // Корневой массив для хранения болезней верхнего уровня
    const stack = [];  // Стек для отслеживания текущего уровня вложенности
  
    this.diseases.forEach((line) => {
      const [indices, name] = line.split(" ");  // Разделяем строку на индексы и название
      const [level] = indices.split("-").map(Number);  // Получаем уровень вложенности
  
      const disease = { name, children: [] };
  
      // Если уровень вложенности меньше текущего, возвращаемся на уровень выше
      while (stack.length > 0 && level <= stack[stack.length - 1].level) {
        stack.pop();
      }
  
      if (stack.length === 0) {
        // Если стек пуст, добавляем болезнь в корневой массив
        root.push(disease);
      } else {
        // Иначе добавляем болезнь как дочерний элемент последнего элемента в стеке
        stack[stack.length - 1].node.children.push(disease);
      }

      // Добавляем текущий элемент в стек
      stack.push({ level, node: disease });
    });
  
    return root;
  }
}