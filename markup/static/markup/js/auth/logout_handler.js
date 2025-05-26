import { UIManager } from "../perform_markup/UI/UIManager.js";
import { IndexedDatabase } from "../perform_markup/indexedDB/IndexedDatabase.js";

function initLogoutClearDB() {
  const customLogoutTrigger = document.getElementById("customLogoutTrigger");
  const actualLogoutButton = document.getElementById("actualLogoutButton");

  customLogoutTrigger?.addEventListener("click", async (e) => {
    e.preventDefault();
    UIManager.isAutosave = false;

    let proceedToLogout = false;
    if (!(await IndexedDatabase.hasData())) {
        proceedToLogout = true;
    } else {
        if (confirm("При выходе из профиля несохраненные данные разметки будут утеряны. Продолжить?")) {
            try {
                await IndexedDatabase.deleteDatabase();
                proceedToLogout = true;
            } catch (dbError) {
                console.error("Ошибка при удалении БД во время выхода:", dbError);
                alert("Не удалось очистить локальные данные. Выход отменен.");
                proceedToLogout = false;
            }
        } else {
            proceedToLogout = false;
        }
    }

    if (!proceedToLogout) {
      UIManager.isAutosave = true;
      return;
    }

    if (actualLogoutButton) {
      console.log("Attempting actualLogoutButton.click() for logout");
      actualLogoutButton.click(); // Инициируем клик по настоящей кнопке submit
    } else {
      console.error("Кнопка #actualLogoutButton не найдена!");
      UIManager.isAutosave = true;
    }
  });
}
document.addEventListener("DOMContentLoaded", initLogoutClearDB);