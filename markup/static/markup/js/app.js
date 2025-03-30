import { EcgGraphSynchronizer } from "./ecg/EcgGraphSynchronizer.js";
import { chartOptions } from "./config/chartOptions.js";

document.addEventListener("DOMContentLoaded", () => {
  new EcgGraphSynchronizer(
    "left-column",
    "right-column",
    window.ecgData,
    window.ecgNames,
    chartOptions
  );
});
