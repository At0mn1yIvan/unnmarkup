class EcgChart {
  constructor(chartGroup, data, name, offsetY, opts, xScale, yScale) {
    this.chartGroup = chartGroup;
    this.data = data;
    this.name = name;
    this.offsetY = offsetY;
    this.opts = opts;
    this.xScale = xScale;
    this.yScale = yScale;
    this.initChart();
  }

  initChart() {
    this.drawLine();
  }

  drawLine() {
    this.lineGroup = this.chartGroup
      .append("g")
      .attr("class", "line-group")
      .attr("transform", `translate(0, ${this.offsetY})`);
    this.linePath = this.lineGroup
      .append("path")
      .attr("class", "ecg-line")
      .attr("fill", "none")
      .attr("stroke", "blue")
      .attr("stroke-width", 1.5);
    this.updateChart();
  }

  updateChart() {
    const [domainStart, domainEnd] = this.xScale.domain();

    const lineGenerator = d3
      .line()
      .x((d, i) => this.xScale(i + domainStart))
      .y((d) => this.yScale(d))
      .curve(d3.curveLinear);

    this.linePath
      .datum(this.data.slice(domainStart, domainEnd))
      .attr("d", lineGenerator);
  }
}

// Группа графиков
class EcgGraphGroup {
  constructor(containerId, dataGroup, chartNames, opts) {
    this.container = document.getElementById(containerId);
    this.dataGroup = dataGroup;
    this.chartNames = chartNames;
    this.opts = opts;
    this.charts = [];
    this.initChartGroup();
  }

  initChartGroup() {
    this.svg = d3
      .select(this.container)
      .append("svg")
      .attr("width", this.opts.cellSize * this.opts.gridWidth)
      .attr(
        "height",
        this.opts.cellSize * this.opts.gridHeight * this.dataGroup.length
      )
      .attr(
        "viewBox",
        `0 0 ${this.opts.cellSize * this.opts.gridWidth} ${
          this.opts.cellSize * this.opts.gridHeight * this.dataGroup.length
        }`
      );

    this.chartGroup = this.svg.append("g");

    this.xScale = d3
      .scaleLinear()
      .domain([0, this.opts.visibleLength])
      .range([0, this.opts.cellSize * this.opts.gridWidth]);

    this.yScale = d3
      .scaleLinear()
      .domain([-this.opts.maxMvValue, this.opts.maxMvValue])
      .range([this.opts.cellSize * this.opts.gridHeight, 0]);

    this.ecgMarkup = new EcgMarkup(this);

    this.drawGrid();
    this.initCharts();
    this.addEventListeners();
  }

  drawGrid() {
    const gridLines = this.chartGroup.append("g").attr("class", "grid-lines");

    for (let x = 0; x <= this.opts.gridWidth; x++) {
      gridLines
        .append("line")
        .attr("class", "line-vertical")
        .attr("x1", x * this.opts.cellSize)
        .attr("y1", 0)
        .attr("x2", x * this.opts.cellSize)
        .attr(
          "y2",
          this.opts.cellSize * this.opts.gridHeight * this.dataGroup.length
        )
        .attr("stroke", "gray")
        .attr("stroke-width", x % 5 === 0 ? 1 : 0.5);
    }

    for (let y = 0; y <= this.opts.gridHeight * this.dataGroup.length; y++) {
      gridLines
        .append("line")
        .attr("class", "line-horizontal")
        .attr("x1", 0)
        .attr("y1", y * this.opts.cellSize)
        .attr("x2", this.opts.cellSize * this.opts.gridWidth)
        .attr("y2", y * this.opts.cellSize)
        .attr("stroke", "gray")
        .attr("stroke-width", y % 5 === 0 ? 1 : 0.5);
    }
  }

  initCharts() {
    this.dataGroup.forEach((data, index) => {
      const offsetY = index * this.opts.cellSize * this.opts.gridHeight;
      const chart = new EcgChart(
        this.chartGroup,
        data,
        this.chartNames[index],
        offsetY,
        this.opts,
        this.xScale,
        this.yScale
      );
      this.charts.push(chart);
    });
  }

  addEventListeners() {
    this.svg.on("wheel", (event) => this.handleScroll(event));
    this.svg.on("dblclick", () => this.resetPosition());
  }

  handleScroll(event) {
    event.preventDefault();
    const scrollStep = Math.abs(event.deltaY);

    let [domainStart, domainEnd] = this.xScale.domain();

    if (event.deltaY > 0) {
      domainStart = Math.min(
        domainStart + scrollStep,
        this.dataGroup[0].length - this.opts.visibleLength
      );
    } else {
      domainStart = Math.max(domainStart - scrollStep, 0);
    }
    domainEnd = Math.min(
      domainStart + this.opts.visibleLength,
      this.dataGroup[0].length
    );
    this.xScale.domain([domainStart, domainEnd]);

    this.charts.forEach((chart) => {
      chart.updateChart();
    });
    this.updateGrid();
    this.ecgMarkup.drawMarkups();
  }

  resetPosition() {
    this.xScale.domain([0, this.opts.visibleLength]);
    this.charts.forEach((chart) => {
      chart.updateChart();
    });
    this.updateGrid();
    this.ecgMarkup.drawMarkups();
  }

  updateGrid() {
    const gridWidthWhole = 250;
    const step = this.opts.visibleLength / this.opts.gridWidth;
    const [domainStart, domainEnd] = this.xScale.domain();

    const visibleIndices = d3.range(0, gridWidthWhole).filter((i) => {
      const xValue = i * step;
      return xValue >= domainStart && xValue <= domainEnd;
    });

    const gridLines = this.chartGroup
      .select(".grid-lines")
      .selectAll(".line-vertical")
      .data(visibleIndices, (d) => d);

    gridLines.join(
      (enter) =>
        enter
          .append("line")
          .attr("class", "line-vertical")
          .attr("x1", (d) => this.xScale(d * step))
          .attr("y1", 0)
          .attr("x2", (d) => this.xScale(d * step))
          .attr("y2", this.svg.attr("height"))
          .attr("stroke", "gray")
          .attr("stroke-width", (i) => (i % 5 === 0 ? 1 : 0.5)),
      (update) =>
        update
          .attr("x1", (d) => this.xScale(d * step))
          .attr("x2", (d) => this.xScale(d * step)),
      (exit) => exit.remove()
    );
  }
}

class EcgChartController {
  constructor(leftContainerId, rightContainerId, dataGroup, chartNames, opts) {
    this.leftChartGroup = new EcgGraphGroup(
      leftContainerId,
      dataGroup.slice(0, 6),
      chartNames.slice(0, 6),
      opts
    );
    this.rightChartGroup = new EcgGraphGroup(
      rightContainerId,
      dataGroup.slice(6, 12),
      chartNames.slice(6, 12),
      opts
    );
    this.syncEvents();
  }

  syncEvents() {
    this.leftChartGroup.svg.on("wheel", (event) =>
      this.handleScroll(event, this.leftChartGroup, this.rightChartGroup)
    );
    this.rightChartGroup.svg.on("wheel", (event) =>
      this.handleScroll(event, this.rightChartGroup, this.leftChartGroup)
    );

    // Прокрутка и сброс позиции синхронизированы между двумя графиками
    this.leftChartGroup.svg.on("dblclick", () =>
      this.resetPosition(this.leftChartGroup)
    );
    this.rightChartGroup.svg.on("dblclick", () =>
      this.resetPosition(this.rightChartGroup)
    );
  }

  handleScroll(event, sourceGroup, targetGroup) {
    event.preventDefault();
    const scrollStep = Math.abs(event.deltaY);

    let [domainStart, domainEnd] = sourceGroup.xScale.domain();

    if (event.deltaY > 0) {
      domainStart = Math.min(
        domainStart + scrollStep,
        sourceGroup.dataGroup[0].length - sourceGroup.opts.visibleLength
      );
    } else {
      domainStart = Math.max(domainStart - scrollStep, 0);
    }
    domainEnd = Math.min(
      domainStart + sourceGroup.opts.visibleLength,
      sourceGroup.dataGroup[0].length
    );
    sourceGroup.xScale.domain([domainStart, domainEnd]);

    sourceGroup.charts.forEach((chart) => chart.updateChart());
    sourceGroup.updateGrid();

    // Синхронизация оси X для второго графика
    targetGroup.xScale.domain(sourceGroup.xScale.domain());
    targetGroup.charts.forEach((chart) => chart.updateChart());
    targetGroup.updateGrid();
  }

  resetPosition(group) {
    group.xScale.domain([0, group.opts.visibleLength]);
    group.charts.forEach((chart) => chart.updateChart());
    group.updateGrid();
  }
}

// Инициализация браша и подключение функции для ивента
// const brush = d3
// .brushX()
// .extent([
//   [0, 0],
//   [cellSize * gridWidth, cellSize * totalHeight],
// ])
// .on("end", (event) => updateBrushEvent(event, svg, xScale));

// Подключение браша к группе графииков
// chartGroup.append("g").attr("class", "brush").call(brush);

// добавляем группу разметки на svg
// svg.append("g").attr("class", "brush-annotations");

class EcgMarkup {
  static markups = [];
  static colorMap = {
    QRS: "red",
    P: "yellow",
    T: "green",
    Noise: "gray",
  };

  constructor(ecgChartGroup) {
    this.ecgChartGroup = ecgChartGroup;
    this.activeMarkup = "QRS";

    this.initBrush();
    this.setupRadioButtons();
  }

  initBrush() {
    const width = this.ecgChartGroup.svg.attr("width");
    const height = this.ecgChartGroup.svg.attr("height");

    this.ecgChartGroup.svg.append("g").attr("class", "brush-markups");

    this.brush = d3
      .brushX()
      .extent([
        [0, 0],
        [width, height],
      ])
      .on("end", (event) => this.handleBrushEnd(event));

    this.ecgChartGroup.chartGroup
      .append("g")
      .attr("class", "brush")
      .call(this.brush);
  }

  handleBrushEnd(event) {
    const extent = event.selection;
    if (!extent) return;

    const [x0, x1] = extent.map(this.ecgChartGroup.xScale.invert);
    this.ecgChartGroup.svg.select(".brush").call(d3.brushX().move, null);

    EcgMarkup.markups.push({
      x0: x0,
      x1: x1,
      type: this.activeMarkup,
    });

    this.drawMarkups();
  }

  drawMarkups() {
    const markupGroup = this.ecgChartGroup.svg.select(".brush-markups");

    const markupRects = markupGroup
      .selectAll("rect")
      .data(EcgMarkup.markups, (d) => `${d.x0}-${d.x1}-${d.type}`);

    markupRects
      .enter()
      .append("rect")
      .attr("y", 0)
      .attr("height", this.ecgChartGroup.svg.attr("height"))
      .attr("fill", (d) => EcgMarkup.colorMap[d.type])
      .attr("opacity", 0.4)
      .merge(markupRects)
      .attr("x", (d) => this.ecgChartGroup.xScale(d.x0))
      .attr(
        "width",
        (d) => this.ecgChartGroup.xScale(d.x1) - this.ecgChartGroup.xScale(d.x0)
      );

    markupRects.exit().remove();
  }

  setupRadioButtons() {
    document
      .querySelectorAll('input[name="markup-option"]')
      .forEach((input) => {
        input.addEventListener("change", (event) => {
          this.activeMarkup = event.target.value;
        });
      });
  }
}

const chartOptions = {
  cellSize: 7,
  visibleLength: 1500,
  gridWidth: 75,
  gridHeight: 30,
  maxMvValue: 1.5,
};

document.addEventListener("DOMContentLoaded", () => {
  let leftChartGroup = new EcgGraphGroup(
    "left-column",
    window.ecgData.slice(0, 6),
    window.ecgNames.slice(0, 6),
    chartOptions
  );
  let rightChartGroup = new EcgGraphGroup(
    "right-column",
    window.ecgData.slice(6, 12),
    window.ecgNames.slice(6, 12),
    chartOptions
  );
});
