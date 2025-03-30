export const chartOptions = {
  visibleLength: 1500,
  maxMvValue: 1.5,
  hertz: 500, // герцовка ЭКГ
  cellsPerSecond: 25, // мм (клеток)/сек
  cellsPerMv: 20,
  get gridWidth() {
    return Math.ceil((this.visibleLength / this.hertz) * this.cellsPerSecond);
  },
  get gridHeight() {
    return this.cellsPerMv * this.maxMvValue;
  },
  get totalVerticalLines() {
    return Math.ceil(
      (window.ecgData[0].length / this.hertz) * this.cellsPerSecond
    );
  },
  get cellSize() {
    const graphsContainer = document.getElementById("charts-container");
    if (!graphsContainer) return 7; // fallback значение

    // Общая доступная ширина для двух графиков (минус 1px для разделительной линии)
    const totalAvailableWidth = graphsContainer.offsetWidth;

    // Ширина одного графика
    const singleGraphWidth = totalAvailableWidth / 2;

    // Рассчитываем cellSize, чтобы график точно вписывался
    return singleGraphWidth / this.gridWidth;
  },
};
