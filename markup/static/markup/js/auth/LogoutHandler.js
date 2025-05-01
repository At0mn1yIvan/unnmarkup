import { UIManager } from "../UI/UIManager.js";
import { IndexedDatabase } from "../indexedDB/IndexedDatabase.js";

function initLogoutClearDB() {
  // Привязка функционала очистки локальной БД к форме выхода из профиля
  const logoutLink = document.getElementById("logoutLink");
  logoutLink?.addEventListener("click", async (e) => {
    e.preventDefault();

    UIManager.isLoggingOut = true;

    if (!(await IndexedDatabase.clearWithConfirm())) {
      UIManager.isLoggingOut = false;
      return;
    }

    const form = document.getElementById("logoutForm");
    form.submit();
  });
}

document.addEventListener("DOMContentLoaded", initLogoutClearDB);
