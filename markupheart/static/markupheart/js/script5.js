class SingleEcgGraph {
  constructor(chartGroup, data, name, offsetY, opts, xScale, yScale) {
    this.chartGroup = chartGroup;
    this.data = data;
    this.name = name;
    this.offsetY = offsetY;
    this.opts = opts;
    this.xScale = xScale;
    this.yScale = yScale;
    this.initGraph();
  }

  initGraph() {
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
    this.updateGraph();
  }

  updateGraph() {
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

class EcgGraphGroup {
  constructor(containerId, dataGroup, chartNames, opts) {
    this.container = document.getElementById(containerId);
    this.dataGroup = dataGroup;
    this.chartNames = chartNames;
    this.opts = opts;
    this.graphs = [];
    this.initGraphGroup(containerId);
  }

  initGraphGroup(containerId) {
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

    this.xScale = d3
      .scaleLinear()
      .domain([0, this.opts.visibleLength])
      .range([0, this.opts.cellSize * this.opts.gridWidth]);

    this.yScale = d3
      .scaleLinear()
      .domain([-this.opts.maxMvValue, this.opts.maxMvValue])
      .range([this.opts.cellSize * this.opts.gridHeight, 0]);

    const clip = this.svg
      .append("defs")
      .append("svg:clipPath")
      .attr("id", `clip-${containerId}`)
      .append("svg:rect")
      .attr("width", this.opts.cellSize * this.opts.gridWidth)
      .attr(
        "height",
        this.opts.cellSize * this.opts.gridHeight * this.dataGroup.length
      )
      .attr("x", 0)
      .attr("y", 0);

    this.graphGroup = this.svg
      .append("g")
      .attr("clip-path", `url(#clip-${containerId})`);

    this.drawGrid();
    this.initGraphs();
  }

  initGraphs() {
    this.dataGroup.forEach((data, index) => {
      const offsetY = index * this.opts.cellSize * this.opts.gridHeight;
      const chart = new SingleEcgGraph(
        this.graphGroup,
        data,
        this.chartNames[index],
        offsetY,
        this.opts,
        this.xScale,
        this.yScale
      );
      this.graphs.push(chart);
    });
  }

  drawGrid() {
    const gridLines = this.graphGroup.append("g").attr("class", "grid-lines");

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
}

class EcgGraphSynchronizer {
  constructor(leftContainerId, rightContainerId, dataGroup, chartNames, opts) {
    this.leftGraphGroup = new EcgGraphGroup(
      leftContainerId,
      dataGroup.slice(0, 6),
      chartNames.slice(0, 6),
      opts
    );
    this.rightGraphGroup = new EcgGraphGroup(
      rightContainerId,
      dataGroup.slice(6, 12),
      chartNames.slice(6, 12),
      opts
    );

    this.leftMarkup = new EcgGraphMarkupManager(this.leftGraphGroup);
    this.rightMarkup = new EcgGraphMarkupManager(this.rightGraphGroup);

    this.syncEvents();
  }

  syncEvents() {
    this.leftGraphGroup.svg.on("wheel", (event) =>
      this.handleScroll(event, this.leftGraphGroup)
    );
    this.rightGraphGroup.svg.on("wheel", (event) =>
      this.handleScroll(event, this.rightGraphGroup)
    );

    this.leftGraphGroup.svg.on("dblclick", () =>
      this.resetPosition(this.leftGraphGroup)
    );
    this.rightGraphGroup.svg.on("dblclick", () =>
      this.resetPosition(this.rightGraphGroup)
    );

    this.leftMarkup.graphGroup.svg.on("markChange", () => {
      this.rightMarkup.drawMarkups();
    });

    this.rightMarkup.graphGroup.svg.on("markChange", () => {
      this.leftMarkup.drawMarkups();
    });
  }

  handleScroll(event, graphGroup) {
    event.preventDefault();
    const scrollStep = Math.abs(event.deltaY);

    let [domainStart, domainEnd] = graphGroup.xScale.domain();

    if (event.deltaY > 0) {
      domainStart = Math.min(
        domainStart + scrollStep,
        graphGroup.dataGroup[0].length - graphGroup.opts.visibleLength
      );
    } else {
      domainStart = Math.max(domainStart - scrollStep, 0);
    }
    domainEnd = Math.min(
      domainStart + graphGroup.opts.visibleLength,
      graphGroup.dataGroup[0].length
    );
    graphGroup.xScale.domain([domainStart, domainEnd]);

    graphGroup.graphs.forEach((graph) => graph.updateGraph());

    this.updateGrid(graphGroup);
    this.leftMarkup.drawMarkups();
    this.rightMarkup.drawMarkups();
  }

  resetPosition(graphGroup) {
    graphGroup.xScale.domain([0, graphGroup.opts.visibleLength]);
    graphGroup.graphs.forEach((graph) => graph.updateGraph());

    this.updateGrid(graphGroup);
    this.leftMarkup.drawMarkups();
    this.rightMarkup.drawMarkups();
  }

  updateGrid(graphGroup) {
    const gridWidthWhole = 250;
    const step = graphGroup.opts.visibleLength / graphGroup.opts.gridWidth;
    const [domainStart, domainEnd] = graphGroup.xScale.domain();

    const visibleIndices = d3.range(0, gridWidthWhole).filter((i) => {
      const xValue = i * step;
      return xValue >= domainStart && xValue <= domainEnd;
    });

    const gridLines = graphGroup.graphGroup
      .select(".grid-lines")
      .selectAll(".line-vertical")
      .data(visibleIndices, (d) => d);

    gridLines.join(
      (enter) =>
        enter
          .append("line")
          .attr("class", "line-vertical")
          .attr("x1", (d) => graphGroup.xScale(d * step))
          .attr("y1", 0)
          .attr("x2", (d) => graphGroup.xScale(d * step))
          .attr("y2", graphGroup.svg.attr("height"))
          .attr("stroke", "gray")
          .attr("stroke-width", (i) => (i % 5 === 0 ? 1 : 0.5)),
      (update) =>
        update
          .attr("x1", (d) => graphGroup.xScale(d * step))
          .attr("x2", (d) => graphGroup.xScale(d * step)),
      (exit) => exit.remove()
    );
  }
}

class EcgGraphMarkupManager {
  static markups = [];
  static colorMap = {
    QRS: "red",
    P: "yellow",
    T: "green",
    Noise: "gray",
  };

  constructor(graphGroup) {
    this.graphGroup = graphGroup;
    this.activeMarkup = "QRS";

    this.initBrush();
    this.setupRadioButtons();
    this.addEventListeners();
  }

  initBrush() {
    const width = this.graphGroup.svg.attr("width");
    const height = this.graphGroup.svg.attr("height");

    this.graphGroup.svg.append("g").attr("class", "brush-markups");

    this.brush = d3
      .brushX()
      .extent([
        [0, 0],
        [width, height],
      ])
      .on("end", (event) => this.handleBrushEnd(event));

    this.graphGroup.graphGroup
      .append("g")
      .attr("class", "brush")
      .call(this.brush);
  }

  addEventListeners() {
    this.graphGroup.svg.on("markChange", () => {
      this.drawMarkups();
    });
  }

  triggerMarkChange() {
    const event = new CustomEvent("markChange");
    this.graphGroup.svg.node().dispatchEvent(event);
  }

  handleBrushEnd(event) {
    const extent = event.selection;
    if (!extent) return;

    const [x0, x1] = extent.map(this.graphGroup.xScale.invert);
    this.graphGroup.svg.select(".brush").call(d3.brushX().move, null);

    EcgGraphMarkupManager.markups.push({
      x0: x0,
      x1: x1,
      type: this.activeMarkup,
    });

    this.drawMarkups();
    this.triggerMarkChange();
  }

  onResizeStart(event, markup) {
    event.preventDefault();

    const mouseX = d3.pointer(event, this.graphGroup.svg.node())[0];
    const x0 = this.graphGroup.xScale(markup.x0);
    const x1 = this.graphGroup.xScale(markup.x1);
    let resizeType = null;

    // Определяем, к какому краю ближе курсор
    if (Math.abs(mouseX - x0) < 20) {
      resizeType = "left"; // Левый край
    } else if (Math.abs(mouseX - x1) < 20) {
      resizeType = "right"; // Правый край
    } else {
      return;
    }
  
    // Начинаем отслеживание движения мыши
    const onMouseMove = (e) => {
      const newX = this.graphGroup.xScale.invert(d3.pointer(e, this.graphGroup.svg.node())[0]);
      if (resizeType === "left") {
        markup.x0 = Math.min(newX, markup.x1 - 1); // Левый край двигаем, но не даем пересечь правый
      } else if (resizeType === "right") {
        markup.x1 = Math.max(newX, markup.x0 + 1); // Правый край двигаем, но не даем пересечь левый
      }

      this.drawMarkups();
      this.triggerMarkChange();
    };
  
    const onMouseUp = () => {
      d3.select(window).on("mousemove", null).on("mouseup", null);
    };
  
    d3.select(window).on("mousemove", onMouseMove).on("mouseup", onMouseUp);
  }

  removeMarkup(event, markup) {
    // Удаление блока разметки при помощи ПКМ.
    event.preventDefault();

    EcgGraphMarkupManager.markups = EcgGraphMarkupManager.markups.filter((d) => d !== markup);

    this.drawMarkups();
    this.triggerMarkChange();
  }

  drawMarkups() {
    const markupGroup = this.graphGroup.svg.select(".brush-markups");

    const markupRects = markupGroup
      .selectAll("rect")
      .data(EcgGraphMarkupManager.markups, (d) => `${d.x0}-${d.x1}-${d.type}`);

    markupRects.join(
      (enter) =>
        enter
          .append("rect")
          .attr("y", 0)
          .attr("height", this.graphGroup.svg.attr("height"))
          .attr("fill", (d) => EcgGraphMarkupManager.colorMap[d.type])
          .attr("opacity", 0.4)
          .attr("x", (d) => this.graphGroup.xScale(d.x0))
          .attr("width", (d) => this.graphGroup.xScale(d.x1) - this.graphGroup.xScale(d.x0))
          .on("contextmenu", (event, d) => this.removeMarkup(event, d))
          .call((rects) => {
            rects.each((d, i, nodes) => {
              const rect = d3.select(nodes[i]);
              rect.on("mousedown", (event) => this.onResizeStart(event, d));
            });
          }),
      (update) =>
        update
          .attr("x", (d) => this.graphGroup.xScale(d.x0))
          .attr("width", (d) => this.graphGroup.xScale(d.x1) - this.graphGroup.xScale(d.x0)),
      (exit) => exit.remove()
      );
    
    // markupRects
    //   .enter()
    //   .append("rect")
    //   .attr("y", 0)
    //   .attr("height", this.graphGroup.svg.attr("height"))
    //   .attr("fill", (d) => EcgGraphMarkupManager.colorMap[d.type])
    //   .attr("opacity", 0.4)
    //   .merge(markupRects)
    //   .attr("x", (d) => this.graphGroup.xScale(d.x0))
    //   .attr(
    //     "width",
    //     (d) => this.graphGroup.xScale(d.x1) - this.graphGroup.xScale(d.x0)
    //   );

    // markupRects.exit().remove();
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
  new EcgGraphSynchronizer(
    "left-column",
    "right-column",
    window.ecgData,
    window.ecgNames,
    chartOptions
  );
});
