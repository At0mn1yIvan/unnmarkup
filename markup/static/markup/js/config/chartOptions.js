export const createChartOptions = (ecgData) => ({
  visibleLength: 1500,
  maxMvValue: 1.5,
  hertz: 500, // герцовка ЭКГ
  cellsPerSecond: 25, // мм (клеток)/сек
  cellsPerMv: 20,
  get gridWidth() {
    return (this.visibleLength / this.hertz) * this.cellsPerSecond;
  },
  get gridHeight() {
    return this.cellsPerMv * this.maxMvValue;
  },
  get totalVerticalLines() {
    return Math.ceil(
      (ecgData[0].length / this.hertz) * this.cellsPerSecond
    );
  },
  get cellSize() {
    const graphsContainer = document.getElementById("charts-container");
    if (!graphsContainer) return 7; // fallback значение

    // Общая доступная ширина для двух графиков линии)
    const totalAvailableWidth = graphsContainer.offsetWidth;

    // Ширина одного графикаS
    const singleGraphWidth = totalAvailableWidth / 2;

    // Рассчитываем cellSize, чтобы график точно вписывался
    return Math.round(singleGraphWidth / this.gridWidth);
  },
});
