export class SingleEcgGraph {
  #chartGroup;
  #data;
  #name;
  #offsetY;
  #xScale;
  #yScale;
  #lineGroup;
  #linePath;
  #lineGenerator;

  constructor(chartGroup, data, name, offsetY, xScale, yScale) {
    this.#chartGroup = chartGroup;
    this.#data = data;
    this.#name = name;
    this.#offsetY = offsetY;
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
      .attr("stroke-width", 1.2);

    this.#lineGroup
      .append("text")
      .attr("x", 10)
      .attr("y", 150)
      .attr("font-family", "Arial, sans-serif")
      .attr("font-size", "20px")
      .attr("font-weight", "bold")
      .attr("fill", "#2c3e50")
      .attr("paint-order", "stroke")
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .text(this.#name);

    this.#lineGenerator = (domainStart) =>
      d3
        .line()
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
    this.#linePath
      .datum(visibleData)
      .attr("d", this.#lineGenerator(domainStart));
  }
}
