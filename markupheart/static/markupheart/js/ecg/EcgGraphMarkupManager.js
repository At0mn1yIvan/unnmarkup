export class EcgGraphMarkupManager {
  static colorMap = {
    QRS: "red",
    P: "yellow",
    T: "green",
    Noise: "gray",
  };
  static markups = [];
  #graphGroup;
  #uiManager;
  #brush;

  constructor(graphGroup, uiManager) {
    this.#graphGroup = graphGroup;
    this.#uiManager = uiManager;
    this.#initBrush();
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
      type: this.#uiManager.getActiveMarkup(),
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

  static getMarkups() {
    return EcgGraphMarkupManager.markups;
  }
}
