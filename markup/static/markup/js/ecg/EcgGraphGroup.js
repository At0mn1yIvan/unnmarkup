import { SingleEcgGraph } from "./SingleEcgGraph.js";

export class EcgGraphGroup {
  #container;
  #dataGroup;
  #opts;
  #svg;
  #xScale;
  #yScale;
  #graphs = [];
  #gridLines;

  constructor(containerId, dataGroup, chartNames, opts) {
    this.#container = document.getElementById(containerId);
    this.#dataGroup = dataGroup;
    this.chartNames = chartNames;
    this.#opts = opts;
    this.#opts.cellSize = this.#calculateCellSize();
    this.#initGraphGroup();
  }

  #calculateCellSize() {
    const containerWidth = this.#container.clientWidth;
    console.log(this.#container.id, containerWidth);
    return Math.floor(containerWidth / this.#opts.gridWidth);
  }

  #initGraphGroup() {
    this.#initSvg();
    this.#initScales();
    this.#initClipPath(this.#container.id);
    this.#drawGrid();
    this.#initGraphs();
  }

  #initSvg() {
    const { cellSize, gridWidth, gridHeight } = this.#opts;
    const height = cellSize * gridHeight * this.#dataGroup.length;

    this.#svg = d3
      .select(this.#container)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      // .attr("width", cellSize * gridWidth)
      // .attr("height", height)
      .attr("viewBox", `0 0 ${cellSize * gridWidth} ${height}`);
  }

  #initScales() {
    const { cellSize, gridWidth, gridHeight, visibleLength, maxMvValue } =
      this.#opts;

    this.#xScale = d3
      .scaleLinear()
      .domain([0, visibleLength])
      .range([0, cellSize * gridWidth]);

    this.#yScale = d3
      .scaleLinear()
      .domain([-maxMvValue, maxMvValue])
      .range([cellSize * gridHeight, 0]);
  }

  #initClipPath(containerId) {
    const { cellSize, gridWidth, gridHeight } = this.#opts;
    const height = cellSize * gridHeight * this.#dataGroup.length;

    this.#svg
      .append("defs")
      .append("clipPath")
      .attr("id", `clip-${containerId}`)
      .append("rect")
      .attr("width", cellSize * gridWidth)
      .attr("height", height);

    this.graphGroup = this.#svg
      .append("g")
      .attr("clip-path", `url(#clip-${containerId})`);
  }

  #initGraphs() {
    const { cellSize, gridHeight } = this.#opts;
    this.#dataGroup.forEach((data, index) => {
      const offsetY = index * cellSize * gridHeight;
      this.#graphs.push(
        new SingleEcgGraph(
          this.graphGroup,
          data,
          this.chartNames[index],
          offsetY,
          this.#xScale,
          this.#yScale
        )
      );
    });
  }

  #drawGrid() {
    const { cellSize, gridWidth, gridHeight } = this.#opts;
    const totalHeight = cellSize * gridHeight * this.#dataGroup.length;

    this.#gridLines = this.graphGroup.append("g").attr("class", "grid-lines");
    // Vertical lines
    d3.range(0, gridWidth + 1).forEach((x) => {
      this.#gridLines
        .append("line")
        .attr("class", "line-vertical")
        .attr("x1", x * cellSize)
        .attr("x2", x * cellSize)
        .attr("y1", 0)
        .attr("y2", totalHeight)
        .attr("stroke", "gray")
        .attr("stroke-width", x % 5 === 0 ? 1 : 0.5);
    });

    // Horizontal lines
    d3.range(0, gridHeight * this.#dataGroup.length + 1).forEach((y) => {
      this.#gridLines
        .append("line")
        .attr("class", "line-horizontal")
        .attr("x1", 0)
        .attr("x2", cellSize * gridWidth)
        .attr("y1", y * cellSize)
        .attr("y2", y * cellSize)
        .attr("stroke", "gray")
        .attr("stroke-width", y % 5 === 0 ? 1 : 0.5);
    });
  }

  get xScale() {
    return this.#xScale;
  }
  get yScale() {
    return this.#yScale;
  }
  get svg() {
    return this.#svg;
  }
  get dataGroup() {
    return this.#dataGroup;
  }
  get graphs() {
    return this.#graphs;
  }
  get opts() {
    return this.#opts;
  }
}
