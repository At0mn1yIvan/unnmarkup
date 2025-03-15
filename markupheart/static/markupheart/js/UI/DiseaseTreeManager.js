export class DiseaseTreeManager {
    #diseases;
    #content;

    constructor() {
      this.#diseases = [];
      this.#content = window.diseases;
    }

    parseDiseases() {
        const root = [];  // Корневой массив для хранения болезней верхнего уровня
        const stack = [];  // Стек для отслеживания текущего уровня вложенности

        this.#content.forEach((line) => {
          console.log("line:", line);
          const [indices, name] = line.split(" ");  // Разделяем строку на индексы и название
          console.log("indices:", indices);
          console.log("name:", name);
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
        //return root;
      }    
}