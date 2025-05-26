function initDraftTimer() {
  const timerElement = document.querySelector('[id^="draft-timer-"]');
  if (!timerElement) {
    return;
  }

  const refreshUrl = timerElement.dataset.refreshUrl || "#";

  let totalSeconds;
  try {
    totalSeconds = JSON.parse(
      document.getElementById("totalSecondsData").textContent
    );
  } catch (e) {
    console.error("Ошибка парсинга данных для таймера:", e);
    timerElement.textContent = "Ошибка данных";
    return;
  }

  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, "0")}:${m
      .toString()
      .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  if (
    totalSeconds === null ||
    totalSeconds === undefined ||
    isNaN(totalSeconds) ||
    totalSeconds <= 0
  ) {
    timerElement.textContent = "Время истекло";
    return;
  }

  timerElement.textContent = formatTime(totalSeconds);

  const intervalId = setInterval(() => {
    totalSeconds--;
    if (totalSeconds < 0) {
      clearInterval(intervalId);
      timerElement.textContent = "Время истекло";
      let parentCardBody = timerElement.closest(".card-body");
      if (parentCardBody) {
        let existingMsg = parentCardBody.querySelector(".expiry-alert-message");
        if (!existingMsg) {
          let alertMsg = document.createElement("p");
          alertMsg.className = "text-danger mt-2 expiry-alert-message";
          alertMsg.innerHTML = `Время вышло. <a href="${refreshUrl}">Обновите страницу</a>, чтобы увидеть актуальный статус.`;
          parentCardBody.appendChild(alertMsg);
        }
      }
    } else {
      timerElement.textContent = formatTime(totalSeconds);
    }
  }, 1000);
}

document.addEventListener("DOMContentLoaded", initDraftTimer);
