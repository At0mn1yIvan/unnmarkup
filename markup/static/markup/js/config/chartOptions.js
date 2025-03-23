export const chartOptions = {
    cellSize: 7,
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
      return Math.ceil((window.ecgData[0].length / this.hertz) * this.cellsPerSecond);
    }
  };