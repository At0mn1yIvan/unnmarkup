export class DiseaseTreeManager {
  #diseases;
  #container;

  constructor(containerId) {
      this.#container = document.getElementById(containerId);
      this.#diseases = window.diseasesData;  // Получаем JSON данные
  }

  // Основной метод для построения дерева
  render() {
      this.#container.innerHTML = "";  // Очищаем контейнер
      const ul = document.createElement("ul");
      this.#buildTree(this.#diseases, ul);
      this.#container.appendChild(ul);
  }

  // Рекурсивное построение дерева
  #buildTree(nodes, parentElement) {
      for (const [name, children] of Object.entries(nodes)) {
          const li = document.createElement("li");
          const isLeaf = children === null;

          if (isLeaf) {
              // Создаем чекбокс для конечного диагноза
              li.innerHTML = `
                  <label>
                      <input type="checkbox" name="diagnosis" value="${name}">
                      ${name}
                  </label>
              `;
          } else {
              // Создаем раскрывающийся список
              li.innerHTML = `
                  <details>
                      <summary>${name}</summary>
                      <ul class="nested-list"></ul>
                  </details>
              `;
              
              // Рекурсивно строим дочерние элементы
              const childUl = li.querySelector("ul");
              this.#buildTree(children, childUl);
          }

          parentElement.appendChild(li);
      }
  }

  // Метод для получения выбранных диагнозов
  getSelectedDiagnoses() {
      return Array.from(this.#container.querySelectorAll('input[name="diagnosis"]:checked'))
          .map(checkbox => checkbox.value);
  }
}