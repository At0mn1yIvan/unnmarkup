class FileUploader {
  constructor() {
    this.form = document.getElementById("uploadForm");
    this.dropZone = document.getElementById("dropZone");
    this.filesList = document.getElementById("filesList");
    this.initEventListeners();
  }

  initEventListeners() {
    // Drag and Drop
    this.dropZone.addEventListener("dragover", (e) => this.handleDragOver(e));
    this.dropZone.addEventListener("drop", (e) => this.handleDrop(e));

    // Форма
    this.form.addEventListener("submit", (e) => this.handleSubmit(e));
  }

  handleDragOver(e) {
    e.preventDefault();
    this.dropZone.classList.add("dragover");
  }

  handleDrop(e) {
    e.preventDefault();
    this.dropZone.classList.remove("dragover");
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.form.data_file.files = files;
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    const formData = new FormData(this.form);

    try {
      const response = await fetch(this.form.action, {
        method: "POST",
        body: formData,
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.addNewFile(data);
        this.form.reset();
      } else {
        const errors = await response.json();
        this.showErrors(errors);
      }
    } catch (error) {
      this.showErrors("Ошибка сети");
    }
  }

  addNewFile(data) {
    const newItem = document.createElement("div");
    newItem.className = "list-group-item";
    newItem.innerHTML = `
            <div class="d-flex justify-content-between">
                <div>
                    <strong>${data.filename}</strong>
                    <div class="text-muted small">
                        ${data.date} | 
                        Частота: ${data.sample_rate} Гц | 
                        Поставщик: ${this.form.supplier.value}
                    </div>
                </div>
            </div>
        `;
    this.filesList.prepend(newItem);
  }

  showErrors(errors) {
    Object.entries(errors).forEach(([field, messages]) => {
      const input = this.form.querySelector(`[name="${field}"]`);
      if (input) {
        input.classList.add("is-invalid");
        input.nextElementSibling.textContent = messages.join(", ");
      }
    });
  }
}

// Инициализация
document.addEventListener("DOMContentLoaded", () => new FileUploader());
