export class DiseaseTreeManager {
  #db;
  #diseases;
  #container;

  constructor(diseasesData, containerId, IndexedDatabase) {
    this.#db = IndexedDatabase;
    this.#container = document.getElementById(containerId);
    this.#diseases = diseasesData;  // Получаем JSON данные
    this.#render();
    this.#initSaveButton();
  }

  // Основной метод для построения дерева
  #render() {
    this.#container.innerHTML = "";
    const ul = document.createElement("ul");
    ul.className = "list-group disease-tree";
    this.#buildTree(this.#diseases, ul, null);
    this.#container.appendChild(ul);
  }

  // Рекурсивное построение дерева
  #buildTree(nodes, parentElement, parentName) {
    for (const [name, children] of Object.entries(nodes)) {
      const li = document.createElement("li");
      li.className = "list-group-item border-0 p-0 mb-1"; 

      if (children === null) {
        let hierarchy = [parentName, name].join(" | ");
        // Для листовых элементов сохраняем имя родителя | имя элемента
        li.innerHTML = `
          <div class="form-check ps-2 py-1">
            <input class="form-check-input border border-secondary" 
                   type="checkbox" 
                   name="diagnoses" 
                   value="${hierarchy}"
                   id="diag-${hierarchy.replace(/\s+\|\s+/g, '-')}">
            <label class="form-check-label text-dark" 
                   for="diag-${hierarchy.replace(/\s+\|\s+/g, '-')}">
              ${name}
            </label>
          </div>  
            `;
      } else {
        li.innerHTML = `
          <details class="dropdown">
            <summary class="tn btn-sm btn-outline-primary w-100 text-start d-flex align-items-center py-1 fs-5"">
              <span class="flex-grow-1 small">${name}</span>
              <span class="dropdown-arrow ms-auto small">▼</span>
            </summary>
            <ul class="list-group nested-list mt-1"></ul>
          </details>
            `;
        const childUl = li.querySelector("ul");
        this.#buildTree(children, childUl, name);
      }

      parentElement.appendChild(li);
    }
  }

  // Получение выбранных диагнозов
  #getSelectedDiagnoses() {
    return Array.from(this.#container.querySelectorAll('input[name="diagnoses"]:checked'))
      .map(checkbox => checkbox.value);
  }

  #initSaveButton() {
    const saveBtn = document.getElementById("save-diagnoses-btn");
    saveBtn.addEventListener("click", async (e) => {
      const diagnoses = this.#getSelectedDiagnoses();

      // localStorage.setItem("savedDiagnoses", JSON.stringify(diagnoses));

      try {
        await this.#db.open();
        await this.#db.add("diagnoses", {data: diagnoses});
      }
      catch (error){
        console.error("Ошибка сохранения диагнозов:", error);
        alert("Ошибка сохранения диагнозов");
      }

      //Добавляем toast вниз экрана, что данные успешно сохранены
      // При редиректе делаем автосейв данных
      // Убираем актив с кнопки по нажатию.
    });
  }
}