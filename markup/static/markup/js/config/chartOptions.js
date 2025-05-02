export const createChartOptions = (ecgData) => ({
  visibleLength: 1500,
  maxMvValue: 1.5,
  hertz: 500, // герцовка ЭКГ
  cellsPerSecond: 25, // мм (клеток)/сек
  cellsPerMv: 20,
  cellSize: 7,
  get gridWidth() {
    return (this.visibleLength / this.hertz) * this.cellsPerSecond;
  },
  get gridHeight() {
    return this.cellsPerMv * this.maxMvValue;
  },
  get totalVerticalLines() {
    return Math.ceil((ecgData[0].length / this.hertz) * this.cellsPerSecond);
  },
  // get cellSize() {
  //   const chartsContainer = document.getElementById("charts-container");
  //   if (!chartsContainer) return 7; // fallback значение

  //   // const containerStyle = getComputedStyle(chartsContainer);
  //   // const totalAvailableWidth =
  //   //   chartsContainer.clientWidth -
  //   //   parseFloat(containerStyle.paddingLeft) -
  //   //   parseFloat(containerStyle.paddingRight);

  //   // const singleGraphWidth = totalAvailableWidth / 2;
  //   // const rawCellSize = singleGraphWidth / this.gridWidth;

  //   // // Используем floor вместо round для гарантии вписывания
  //   // return Math.floor(rawCellSize);

  //   // Общая доступная ширина для двух графиков линии)
  //   // const totalAvailableWidth = chartsContainer.offsetWidth;

  //   // // Ширина одного графика
  //   // const singleGraphWidth = Math.ceil(totalAvailableWidth / 2);

  //   // // Рассчитываем cellSize, чтобы график точно вписывался
  //   // return Math.floor(singleGraphWidth / this.gridWidth);
  // },
});
