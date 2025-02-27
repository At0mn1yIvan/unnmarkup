class SingleEcgGraph {
  #chartGroup;
  #data;
  #offsetY;
  #opts;
  #xScale;
  #yScale;
  #lineGroup;
  #linePath;
  #lineGenerator;

  constructor(chartGroup, data, name, offsetY, opts, xScale, yScale) {
    this.#chartGroup = chartGroup;
    this.#data = data;
    this.name = name;
    this.#offsetY = offsetY;
    this.#opts = opts;
    this.#xScale = xScale;
    this.#yScale = yScale;
    this.#initGraph();
  }

  #initGraph() {
    this.#lineGroup = this.#chartGroup
    .append("g")
    .attr("class", "line-group")
    .attr("transform", `translate(0, ${this.#offsetY})`);

  this.#linePath = this.#lineGroup
    .append("path")
    .attr("class", "ecg-line")
    .attr("fill", "none")
    .attr("stroke", "blue")
    .attr("stroke-width", 1.5);

    this.#lineGenerator = (domainStart) => d3.line()
      .x((d, i) => this.#xScale(i + domainStart))
      .y((d) => this.#yScale(d))
      .curve(d3.curveLinear);

  this.updateGraph();
  }

  updateGraph() {
    const [domainStart, domainEnd] = this.#xScale.domain();
    const visibleData = this.#data.slice(
      Math.floor(domainStart),
      Math.ceil(domainEnd)
    );

    // const lineGenerator = d3
    //   .line()
    //   .x((d, i) => this.#xScale(i + domainStart))
    //   .y((d) => this.#yScale(d))
    //   .curve(d3.curveLinear);

    //this.#linePath.datum(visibleData).attr("d", lineGenerator);

    this.#linePath.datum(visibleData).attr("d", this.#lineGenerator(domainStart));
  }
}

class EcgGraphGroup {
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
    this.#initGraphGroup(containerId);
  }

  #initGraphGroup(containerId) {
    this.#initSvg();
    this.#initScales();
    this.#initClipPath(containerId);
    this.#drawGrid();
    this.#initGraphs();
  }

  #initSvg() {
    const { cellSize, gridWidth, gridHeight } = this.#opts;
    const height = cellSize * gridHeight * this.#dataGroup.length;

    this.#svg = d3
      .select(this.#container)
      .append("svg")
      .attr("width", cellSize * gridWidth)
      .attr("height", height)
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
    this.#dataGroup.forEach((data, index) => {
      const offsetY = index * this.#opts.cellSize * this.#opts.gridHeight;
      this.#graphs.push(
        new SingleEcgGraph(
          this.graphGroup,
          data,
          this.chartNames[index],
          offsetY,
          this.#opts,
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

class EcgGraphSynchronizer {
  #leftGraphGroup;
  #rightGraphGroup;
  #leftMarkup;
  #rightMarkup;
  #zoomCompensationFactor;
  #gridStep;

  constructor(leftContainerId, rightContainerId, dataGroup, chartNames, opts) {
    this.#zoomCompensationFactor = 0.7;
    this.#gridStep = opts.visibleLength / opts.gridWidth;
    this.#leftGraphGroup = new EcgGraphGroup(
      leftContainerId,
      dataGroup.slice(0, 6),
      chartNames.slice(0, 6),
      opts
    );
    this.#rightGraphGroup = new EcgGraphGroup(
      rightContainerId,
      dataGroup.slice(6, 12),
      chartNames.slice(6, 12),
      opts
    );

    this.#leftMarkup = new EcgGraphMarkupManager(this.#leftGraphGroup);
    this.#rightMarkup = new EcgGraphMarkupManager(this.#rightGraphGroup);

    this.#syncEvents();
  }

  #syncEvents() {
    this.#initWheelHandlers();
    this.#initDoubleClickHandlers();
    this.#initMarkupSync();
  }

  #initWheelHandlers() {
    const wheelHandler = (event, group) => {
      event.preventDefault();
      this.#handleScroll(event, group);
    };

    this.#leftGraphGroup.svg.on("wheel", (e) =>
      wheelHandler(e, this.#leftGraphGroup)
    );
    this.#rightGraphGroup.svg.on("wheel", (e) =>
      wheelHandler(e, this.#rightGraphGroup)
    );
  }

  #initDoubleClickHandlers() {
    const doubleClickHandler = (group) => {
      this.#resetPosition(group);
    };

    this.#leftGraphGroup.svg.on("dblclick", () =>
      doubleClickHandler(this.#leftGraphGroup)
    );
    this.#rightGraphGroup.svg.on("dblclick", () =>
      doubleClickHandler(this.#rightGraphGroup)
    );
  }

  #initMarkupSync() {
    const syncHandler = () => {
      this.#leftMarkup.drawMarkups();
      this.#rightMarkup.drawMarkups();
    };

    this.#leftGraphGroup.svg.on("markChange", syncHandler);
    this.#rightGraphGroup.svg.on("markChange", syncHandler);
  }

  #handleScroll(event, graphGroup) {
    const scrollStep = Math.abs(event.deltaY) * this.#zoomCompensationFactor;
    let [domainStart, domainEnd] = graphGroup.xScale.domain();

    const maxDomainStart = graphGroup.dataGroup[0].length - graphGroup.opts.visibleLength;
    domainStart = event.deltaY > 0
      ? Math.min(domainStart + scrollStep, maxDomainStart)
      : Math.max(domainStart - scrollStep, 0);

    domainEnd = Math.min(
      domainStart + graphGroup.opts.visibleLength,
      graphGroup.dataGroup[0].length
    );

    graphGroup.xScale.domain([domainStart, domainEnd]);
    requestAnimationFrame(() => {
      graphGroup.graphs.forEach((graph) => graph.updateGraph());
      this.#updateGrid(graphGroup);
      this.#updateMarkups();
    });
  }

  #resetPosition(graphGroup) {
    graphGroup.xScale.domain([0, graphGroup.opts.visibleLength]);
    requestAnimationFrame(() => {
      graphGroup.graphs.forEach((graph) => graph.updateGraph());
      this.#updateGrid(graphGroup);
      this.#updateMarkups();
    });
  }

  #updateGrid(graphGroup) {
    //const { visibleLength, gridWidth, totalVerticalLines } = graphGroup.opts;
    //const step = visibleLength / gridWidth;
    const [domainStart, domainEnd] = graphGroup.xScale.domain();

    const visibleIndices = d3
      .range(0, graphGroup.opts.totalVerticalLines)
      .filter((i) => (i * this.#gridStep) >= domainStart && (i * this.#gridStep) <= domainEnd);

    graphGroup.graphGroup
      .select(".grid-lines")
      .selectAll(".line-vertical")
      .data(visibleIndices, (d) => d)
      .join(
        (enter) =>
          enter
            .append("line")
            .attr("class", "line-vertical")
            .attr("stroke", "gray")
            .attr("y1", 0)
            .attr("y2", graphGroup.svg.attr("height"))
            .attr("x1", (d) => graphGroup.xScale(d * this.#gridStep))
            .attr("x2", (d) => graphGroup.xScale(d * this.#gridStep))
            .attr("stroke-width", (d) => (d % 5 === 0 ? 1 : 0.5)),
        (update) =>
          update
            .attr("x1", (d) => graphGroup.xScale(d * this.#gridStep))
            .attr("x2", (d) => graphGroup.xScale(d * this.#gridStep)),
        (exit) => exit.remove()
      );
  }

  #updateMarkups() {
    this.#leftMarkup.drawMarkups();
    this.#rightMarkup.drawMarkups();
  }
}

class EcgGraphMarkupManager {
  static colorMap = {
    QRS: "red",
    P: "yellow",
    T: "green",
    Noise: "gray",
  };
  static markups = [];
  #graphGroup;
  #activeMarkup = "QRS";
  #brush;

  constructor(graphGroup) {
    this.#graphGroup = graphGroup;
    this.#initBrush();
    this.#setupRadioButtons();
  }

  #initBrush() {
    const { width, height } = this.#getSvgDimensions();

    this.#graphGroup.svg.append("g").attr("class", "brush-markups");

    this.#brush = d3
      .brushX()
      .extent([
        [0, 0],
        [width, height],
      ])
      .on("end", (event) => this.#handleBrushEnd(event));

    this.#graphGroup.graphGroup
      .append("g")
      .attr("class", "brush")
      .call(this.#brush);
  }

  #getSvgDimensions() {
    return {
      width: Number(this.#graphGroup.svg.attr("width")),
      height: Number(this.#graphGroup.svg.attr("height")),
    };
  }

  #hasForbiddenOverlap(newMarkup, currentMarkup = null) {
    return EcgGraphMarkupManager.markups.some(existing => {
      if (existing === currentMarkup) return false;
      // 1. Проверка полного перекрытия (любые типы)
      const isFullOverlap =
        (newMarkup.x0 <= existing.x0 && newMarkup.x1 >= existing.x1) ||
        (existing.x0 <= newMarkup.x0 && existing.x1 >= newMarkup.x1);

      // 2. Проверка пересечения для одинаковых типов
      const isSameTypeOverlap =
        existing.type === newMarkup.type &&
        newMarkup.x0 < existing.x1 &&
        newMarkup.x1 > existing.x0;

      // 3. Проверка на пересечение с шумом
      const isNoiseOverlap =
        existing.type === "Noise" &&
        newMarkup.x0 < existing.x1 &&
        newMarkup.x1 > existing.x0;

      return isFullOverlap || isSameTypeOverlap || isNoiseOverlap;
    });
  }

  #showOverlapWarning() {
    const warning = this.#graphGroup.svg.append("rect")
      .attr("class", "overlap-warning")
      .attr("x", 0)
      .attr("width", "100%")
      .attr("height", "100%")
      .style("fill", "rgba(255,0,0,0.1)")
      .transition().duration(250).style("opacity", 0).remove();
  }

  #applyNoiseMarkup(newNoiseMarkup) {
    EcgGraphMarkupManager.markups = EcgGraphMarkupManager.markups
      .filter(markup =>
        markup.x1 < newNoiseMarkup.x0 ||
        markup.x0 > newNoiseMarkup.x1
      );

    EcgGraphMarkupManager.markups.push(newNoiseMarkup);
    this.#triggerMarkChange();
  }

  #handleBrushEnd(event) {
    const selection = event.selection;
    if (!selection) return;

    const [x0, x1] = selection.map(this.#graphGroup.xScale.invert);
    this.#graphGroup.svg.select(".brush").call(d3.brushX().move, null);
    const newMarkup = {
      x0: x0,
      x1: x1,
      type: this.#activeMarkup,
    };

    if (newMarkup.type === "Noise") {
      this.#applyNoiseMarkup(newMarkup);
      return;
    }

    if (this.#hasForbiddenOverlap(newMarkup)) {
      this.#showOverlapWarning();
      return;
    }

    EcgGraphMarkupManager.markups.push(newMarkup);
    this.#triggerMarkChange();
  }

  #triggerMarkChange() {
    const event = new CustomEvent("markChange");
    this.#graphGroup.svg.node().dispatchEvent(event);
  }

  #setupRadioButtons() {
    document
      .querySelectorAll('input[name="markup-option"]')
      .forEach((input) => {
        input.addEventListener("change", (event) => {
          this.#activeMarkup = event.target.value;
        });
      });
  }

  drawMarkups() {
    const markupGroup = this.#graphGroup.svg.select(".brush-markups");
    if (markupGroup.empty()) return;

    markupGroup
      .selectAll("rect")
      .data(EcgGraphMarkupManager.markups, (d) => `${d.x0}-${d.x1}-${d.type}`)
      .join(
        (enter) =>
          enter
            .append("rect")
            .attr("y", 0)
            .attr("height", this.#graphGroup.svg.attr("height"))
            .attr("fill", (d) => EcgGraphMarkupManager.colorMap[d.type])
            .attr("stroke", "black")
            .attr("stroke-width", 3)
            .attr("opacity", 0.4)
            .on("contextmenu", (event, d) => this.#removeMarkup(event, d))
            .on("mousedown", (event, d) => this.#handleResizeStart(event, d)),
        (update) => update,
        (exit) => exit.remove()
      )
      .attr("x", (d) => this.#graphGroup.xScale(d.x0))
      .attr(
        "width",
        (d) => this.#graphGroup.xScale(d.x1) - this.#graphGroup.xScale(d.x0)
      );
  }

  #removeMarkup(event, markup) {
    event.preventDefault();
    EcgGraphMarkupManager.markups = EcgGraphMarkupManager.markups.filter(
      (m) => m !== markup
    );
    this.#triggerMarkChange();
  }

  #handleResizeStart(event, markup) {
    event.preventDefault();
    const mouseX = d3.pointer(event, this.#graphGroup.svg.node())[0];
    const xScale = this.#graphGroup.xScale;
    const originalValues = { x0: markup.x0, x1: markup.x1, type: markup.type };

    const resizeType =
      Math.abs(mouseX - xScale(markup.x0)) < 20
        ? "left"
        : Math.abs(mouseX - xScale(markup.x1)) < 20
          ? "right"
          : null;
    if (!resizeType) return;

    const clamp = (num, min, max) => Math.min(Math.max(num, min), max);
    let isValidResize = true;

    const onMouseMove = (e) => {
      const newX = clamp(
        xScale.invert(d3.pointer(e, this.#graphGroup.svg.node())[0]),
        0,
        this.#graphGroup.dataGroup[0].length
      );

      const newValues = {
        x0: resizeType === "left" ? newX : markup.x0,
        x1: resizeType === "right" ? newX : markup.x1,
        type: markup.type
      }

      isValidResize = !this.#hasForbiddenOverlap(
        newValues,
        markup
      );

      if (isValidResize) {
        if (resizeType === "left") markup.x0 = Math.min(newX, markup.x1 - 1);
        if (resizeType === "right") markup.x1 = Math.max(newX, markup.x0 + 1);
        requestAnimationFrame(() => {
          this.drawMarkups();
          this.#triggerMarkChange();
        });
      }
    };

    const onMouseUp = () => {
      if (!isValidResize) {
        Object.assign(markup, originalValues); // Откат изменений
        requestAnimationFrame(() => {
        this.drawMarkups();
        this.#triggerMarkChange();
        this.#showOverlapWarning();
        });
      }
      d3.select(window).on("mousemove", null).on("mouseup", null);
    };

    d3.select(window).on("mousemove", onMouseMove).on("mouseup", onMouseUp);
  }
}

const chartOptions = {
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

document.addEventListener("DOMContentLoaded", () => {
  new EcgGraphSynchronizer(
    "left-column",
    "right-column",
    window.ecgData,
    window.ecgNames,
    chartOptions
  );
});
