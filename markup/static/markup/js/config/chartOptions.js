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
});
