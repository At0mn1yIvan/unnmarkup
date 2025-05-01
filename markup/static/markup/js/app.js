import { EcgGraphSynchronizer } from "./ecg/EcgGraphSynchronizer.js";
import { createChartOptions } from "./config/ChartOptions.js";
import { EcgGraphMarkupManager } from "./ecg/EcgGraphMarkupManager.js";
import { IndexedDatabase } from "./indexedDB/IndexedDatabase.js";
import { DiseaseTreeManager } from "./UI/DiseaseTreeManager.js";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const ecgData = JSON.parse(document.getElementById("ecgData").textContent);
    const ecgNames = JSON.parse(
      document.getElementById("ecgNames").textContent
    );
    const diseasesData = JSON.parse(
      document.getElementById("diseasesData").textContent
    );
    const markupsNN = JSON.parse(document.getElementById("markups").textContent);

    const options = createChartOptions(ecgData);

    const markupsIndexedDB = await IndexedDatabase.getLatest("markups"); 
    const diagnosesIndexedDB = await IndexedDatabase.getLatest("diagnoses");

    if (!markupsIndexedDB) {
      EcgGraphMarkupManager.loadMarkups(markupsNN);
    }
    else {
      EcgGraphMarkupManager.loadMarkups(markupsIndexedDB.data);
    }
    
    if (diagnosesIndexedDB) {
      DiseaseTreeManager.loadSelectedDiagnoses(diagnosesIndexedDB.data);
    }

    new EcgGraphSynchronizer(
      "left-column",
      "right-column",
      ecgData,
      ecgNames,
      diseasesData,
      options
    );
  } catch (error) {
    console.error("Ошибка загрузки данных:", error);
  }
});
