function drawGrid(svg, cellSize, gridWidth, gridHeight) {
  const gridLines = svg.append("g").attr("class", "grid-lines");

  // Вертикальные линии
  for (let x = 0; x <= gridWidth; x++) {
    gridLines
      .append("line")
      .attr("class", "line-vertical")
      .attr("x1", x * cellSize)
      .attr("y1", 0)
      .attr("x2", x * cellSize)
      .attr("y2", cellSize * gridHeight)
      .attr("stroke", x % 5 === 0 ? "black" : "gray")
      .attr("stroke-width", x % 5 === 0 ? 0.8 : 0.5);
  }

  // Горизонтальные линии
  for (let y = 0; y <= gridHeight; y++) {
    gridLines
      .append("line")
      .attr("class", "line-horizontal")
      .attr("x1", 0)
      .attr("y1", y * cellSize)
      .attr("x2", cellSize * gridWidth)
      .attr("y2", y * cellSize)
      .attr("stroke", y % 5 === 0 ? "black" : "gray")
      .attr("stroke-width", y % 5 === 0 ? 0.8 : 0.5);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const containerId = "grid-container";
  const visibleLength = 2000; // Количество отображаемых точек
  const cellSize = 15; // Размер клетки в пикселях
  const gridWidth = 25 * (visibleLength / 1000); // Ширина сетки в клетках
  const maxMvValue = 2; // Максимальное значение в мВ
  const gridHeight = 20 * maxMvValue; // Высота сетки в клетках
  let startIndex = 0;

  const ecgData = window.ecgData;
  const data = ecgData[6];

  visibleData = data.slice(startIndex, startIndex + visibleLength);

  const svg = d3
    .select(`#${containerId}`)
    .append("svg")
    .attr("width", cellSize * gridWidth)
    .attr("height", cellSize * gridHeight)
    .attr("viewBox", `0 0 ${cellSize * gridWidth} ${cellSize * gridHeight}`); // определяет координатную систему внутри SVG;

  drawGrid(svg, cellSize, gridWidth, gridHeight);

  const xScale = d3
    .scaleLinear()
    .domain([0, visibleLength]) // задаёт диапазон данных: [0, visibleLength] (индексы точек на графике).
    .range([0, cellSize * gridWidth]); // определяет отображение этого диапазона на пиксели;

  xAxis = svg
    .append("g") // добавляет новую группу элементов <g> в SVG. Группы <g> объединяют элементы, чтобы применять к ним общие трансформации, стили и атрибуты;
    .attr("transform", `translate(0, ${cellSize * gridHeight})`) // перемещает ось вниз на высоту сетки, чтобы она располагалась внизу графика;
    .call(d3.axisBottom(xScale)); // создаёт ось, ориентированную снизу;

  const yScale = d3
    .scaleLinear()
    .domain([-maxMvValue, maxMvValue])
    .range([cellSize * gridHeight, 0]);

  const clip = svg
    .append("defs") // контейнер для элементов, которые определяют графические шаблоны или эффекты;
    .append("svg:clipPath") // определяет область клиппинга;
    .attr("id", "clip")
    .append("svg:rect") // задание формы клиппинга;
    .attr("width", cellSize * gridWidth)
    .attr("height", cellSize * gridHeight)
    .attr("x", 0)
    .attr("y", 0);

  const brush = d3
    .brushX()
    .extent([
      [0, 0],
      [cellSize * gridWidth, cellSize * gridHeight],
    ]) // задаёт размеры области, в которой можно выделять;
    .on("end", updateChart);

  const chartGroup = svg.append("g").attr("clip-path", "url(#clip)"); // привязывает клиппинг к группе, где лежит график. Все элементы внутри chartGroup обрезаются по области клиппинга;

  const line = d3
    .line()
    .x((d, i) => xScale(i)) // преобразует индекс данных i в пиксельное значение на оси X;
    .y((d) => yScale(d)) // преобразует значение данных d в пиксельное значение на оси Y;
    .curve(d3.curveLinear);

  chartGroup
    .append("path")
    .datum(visibleData)
    .attr("class", "line")
    .attr("fill", "none")
    .attr("stroke", "blue")
    .attr("stroke-width", 1)
    .attr("d", line);

  chartGroup.append("g").attr("class", "brush").call(brush); // Добавляет область выделения (brush) в группу графика;

  let idleTimeout;
  function idled() {
    idleTimeout = null;
  }

  function updateChart(event, d) {
    extent = event.selection;

    if (!extent) {
      if (!idleTimeout) return (idleTimeout = setTimeout(idled, 350));
      xScale.domain([0, visibleLength]);
    } else {
      xScale.domain([xScale.invert(extent[0]), xScale.invert(extent[1])]);
      chartGroup.select(".brush").call(brush.move, null); // сброс выделения после завершения брашинга;
    }

    xAxis.transition().duration(1000).call(d3.axisBottom(xScale)); // обновление оси для пересчёта отметок по новому диапазону данных xScale.domain;
    chartGroup
      .select(".line")
      .transition()
      .duration(1000)
      .attr(
        "d",
        d3
          .line()
          .x((d, i) => xScale(i))
          .y((d) => yScale(d))
      ); // пересчёт пути линии (d), с обновлённым xScale;

    svg
      .selectAll(".grid-lines .line-vertical")
      .transition()
      .duration(1000)
      .attr("x1", (d, i) => xScale((i * visibleLength) / gridWidth))
      .attr("x2", (d, i) => xScale((i * visibleLength) / gridWidth));
  }

  svg.on("wheel", function (event) {
    if (!event.altKey) return;

    event.preventDefault();

    const delta = event.deltaY; // Направление прокрутки
    const scaleStep = 0.1; // Степень изменения масштаба
    const currentDomain = xScale.domain();
    const domainSize = currentDomain[1] - currentDomain[0];
    const center = (currentDomain[1] + currentDomain[0]) / 2;

    if (delta > 0) {
      // Увеличение масштаба (сужение видимой области)
      const newDomainSize = Math.max(
        visibleLength * 0.1,
        domainSize * (1 - scaleStep)
      );
      xScale.domain([center - newDomainSize / 2, center + newDomainSize / 2]);
    } else {
      // Уменьшение масштаба (расширение видимой области)
      const newDomainSize = Math.min(
        visibleLength,
        domainSize * (1 + scaleStep)
      );
      xScale.domain([center - newDomainSize / 2, center + newDomainSize / 2]);
    }

    // Обновление оси X
    xAxis.transition().duration(200).call(d3.axisBottom(xScale));

    // Обновление линии графика
    line
      .select(".line")
      .transition()
      .duration(200)
      .attr(
        "d",
        d3
          .line()
          .x((d, i) => xScale(i))
          .y((d) => yScale(d))
      );

    // Обновление вертикальных линий сетки
    svg
      .selectAll(".grid-lines .line-vertical")
      .transition()
      .duration(200)
      .attr("x1", (d, i) => xScale(i))
      .attr("x2", (d, i) => xScale(i));
  });

  svg.on("dblclick", function () {
    xScale.domain([0, visibleLength]);
    xAxis.transition().duration(1000).call(d3.axisBottom(xScale));
    line
      .select(".line")
      .transition()
      .attr(
        "d",
        d3
          .line()
          .x((d, i) => xScale(i))
          .y((d) => yScale(d))
      );

    svg
      .selectAll(".grid-lines .line-vertical")
      .transition()
      .duration(1000)
      .attr("x1", (d, i) => i * cellSize)
      .attr("x2", (d, i) => i * cellSize);
  });
});
