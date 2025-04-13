import { EcgGraphGroup } from "./EcgGraphGroup.js";
import { EcgGraphMarkupManager } from "./EcgGraphMarkupManager.js";
import { UIManager } from "../UI/UIManager.js";

export class EcgGraphSynchronizer {
  #leftGraphGroup;
  #rightGraphGroup;
  #leftMarkup;
  #rightMarkup;
  #uiManager;
  #zoomCompensationFactor;
  #gridStep;

  constructor(leftContainerId, rightContainerId, dataGroup, chartNames, diseasesData, opts) {
    this.#zoomCompensationFactor = 0.7;
    this.#gridStep = opts.visibleLength / opts.gridWidth;

    this.#uiManager = new UIManager(diseasesData);

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

    this.#leftMarkup = new EcgGraphMarkupManager(this.#leftGraphGroup, this.#uiManager);
    this.#rightMarkup = new EcgGraphMarkupManager(this.#rightGraphGroup, this.#uiManager);

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
