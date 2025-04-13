import { EcgGraphSynchronizer } from "./ecg/EcgGraphSynchronizer.js";
import { createChartOptions } from "./config/chartOptions.js";
import { EcgGraphMarkupManager } from "./ecg/EcgGraphMarkupManager.js";

document.addEventListener("DOMContentLoaded", () => {

  try {
    const ecgData = JSON.parse(document.getElementById('ecgData').textContent);
    const ecgNames = JSON.parse(document.getElementById('ecgNames').textContent);
    const diseasesData = JSON.parse(document.getElementById('diseasesData').textContent);
    const markups = JSON.parse(document.getElementById('markups').textContent);

    const options = createChartOptions(ecgData);

    
    EcgGraphMarkupManager.loadMarkups(markups);

    new EcgGraphSynchronizer(
      "left-column",
      "right-column",
      ecgData,
      ecgNames,
      diseasesData,
      options
    );

  }
  catch (error) {
    console.error("Ошибка загрузки данных:", error);
  }

});
