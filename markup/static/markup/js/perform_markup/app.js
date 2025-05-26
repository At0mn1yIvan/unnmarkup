import { EcgGraphSynchronizer } from "./ecg/EcgGraphSynchronizer.js";
import { createChartOptions } from "./config/ChartOptions.js";
import { EcgGraphMarkupManager } from "./ecg/EcgGraphMarkupManager.js";
import { IndexedDatabase } from "./indexedDB/IndexedDatabase.js";
import { DiseaseTreeManager } from "./UI/DiseaseTreeManager.js";
import { UIManager } from "./UI/UIManager.js";


async function initDiagnosesStructure() {
  try {
    const response = await fetch(window.APP_CONFIG.diagnosesJsonUrl);
    if (!response.ok) {
      throw new Error(
        `HTTP error! status: ${response.status} while fetching diagnoses.`
      );
    }
    const diagnosesData = await response.json();
    // console.log("Diagnoses data loaded:", diagnosesData);
    return diagnosesData;
  } catch (error) {
    console.error("Failed to load diagnoses data:", error);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const ecgData = JSON.parse(document.getElementById("ecgData").textContent);
    const ecgNames = JSON.parse(
      document.getElementById("ecgNames").textContent
    );
    // const diseasesData = JSON.parse(
    //   document.getElementById("diseasesData").textContent
    // );
    const diagnosesStructure = await initDiagnosesStructure();

    const markupsPredicted = JSON.parse(
      document.getElementById("markups").textContent
    );

    const options = createChartOptions(ecgData);

    const markupsIndexedDB = await IndexedDatabase.getLatest("markups");
    const diagnosesIndexedDB = await IndexedDatabase.getLatest("diagnoses");

    if (!markupsIndexedDB) {
      EcgGraphMarkupManager.loadMarkups(markupsPredicted);
    } else {
      EcgGraphMarkupManager.loadMarkups(markupsIndexedDB.data);
    }

    if (diagnosesIndexedDB) {
      DiseaseTreeManager.loadSelectedDiagnoses(diagnosesIndexedDB.data);
    }

    let uiManager = new UIManager(diagnosesStructure);

    new EcgGraphSynchronizer(
      "left-column",
      "right-column",
      ecgData,
      ecgNames,
      uiManager,
      options
    );
  } catch (error) {
    console.error("Ошибка загрузки данных:", error);
  }
});
