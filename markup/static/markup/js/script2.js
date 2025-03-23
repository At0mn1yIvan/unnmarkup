let currentAnnotationType = "QRS"; // Значение по умолчанию
const annotationColors = {
  QRS: "red",
  P: "yellow",
  T: "green",
  Noise: "gray",
};
let annotations = [];

function drawGrid(chartGroup, cellSize, gridWidth, gridHeight) {
  const gridLines = chartGroup.append("g").attr("class", "grid-lines");

  const gridWidthWhole = 250;
  for (let x = 0; x <= gridWidthWhole; x++) {
    gridLines
      .append("line")
      .attr("class", "line-vertical")
      .attr("x1", x * cellSize)
      .attr("y1", 0)
      .attr("x2", x * cellSize)
      .attr("y2", cellSize * gridHeight)
      .attr("stroke", "gray")
      .attr("stroke-width", x % 5 === 0 ? 1 : 0.5);
  }
  for (let y = 0; y <= gridHeight; y++) {
    gridLines
      .append("line")
      .attr("class", "line-horizontal")
      .attr("x1", 0)
      .attr("y1", y * cellSize)
      .attr("x2", cellSize * gridWidth)
      .attr("y2", y * cellSize)
      .attr("stroke", "gray")
      .attr("stroke-width", y % 5 === 0 ? 1 : 0.5);
  }
}

function updateGrid(svg, xScale, options) {
  // Постоянные константы вынести уровнем выше. !!!
  const gridWidthWhole = 250;
  const step = options.visibleLength / options.gridWidth;

  // Начало и конец видимых данных.
  const start = Math.floor(xScale.domain()[0]);
  const end = Math.ceil(xScale.domain()[1]);

  // Массив с индексами только тех линий, что должны быть видны.
  const visibleIndices = d3
    .range(0, gridWidthWhole) // Общее количество возможных клеток (250).
    .filter((i) => {
      const xValue = i * step;
      return xValue >= start && xValue <= end;
    });

  const gridLines = svg
    .select(".grid-lines") // Ищем группу, в которой находятся линии.
    .selectAll(".line-vertical") // Выбираем все вертикальные линии сетки (по X).
    .data(visibleIndices, (d) => d); // Связываем массив индексов видимых линий с svg элементами класса "line-vertical".

  // D3 сравнивает новые данные с текущими элементами и определяет, что нужно добавить, обновить или удалить.
  // D3 делит элементы на 3 группы:
  // 1) enter - элементы, которых нет в DOM, но есть в данных - создаём их.
  // 2) update - элементы, которые есть в DOM и есть в данных - обновляем их.
  // 3) exit - элементы, которые есть в DOM, но нет в данных - удаляем их.
  // join() автоматически обрабатывает добавление, обновление и удаление элементов.
  gridLines.join(
    (enter) =>
      enter
        .append("line")
        .attr("class", "line-vertical")
        .attr("x1", (d) => xScale(d * step))
        .attr("y1", 0)
        .attr("x2", (d) => xScale(d * step))
        .attr("y2", svg.attr("height"))
        .attr("stroke", "gray")
        .attr("stroke-width", (i) => (i % 5 === 0 ? 1 : 0.5)),
    (update) =>
      update
        .attr("x1", (d) => xScale(d * step))
        .attr("x2", (d) => xScale(d * step)),
    (exit) => exit.remove()
  );
}

function createEcgChartGroup(containerId, dataGroup, options, chartNames) {
  const { cellSize, visibleLength, gridWidth, gridHeight, maxMvValue } =
    options;
  const chartState = {
    throttleTimeout: null,
    savedLastFullDomain: null,
  };

  const totalHeight = gridHeight * dataGroup.length;

  const svg = d3
    .select(`#${containerId}`)
    .append("svg")
    .attr("width", cellSize * gridWidth)
    .attr("height", cellSize * totalHeight)
    .attr("viewBox", `0 0 ${cellSize * gridWidth} ${cellSize * totalHeight}`);

  const xScale = d3
    .scaleLinear()
    .domain([0, visibleLength])
    .range([0, cellSize * gridWidth]);

  const yScale = d3
    .scaleLinear()
    .domain([-maxMvValue, maxMvValue])
    .range([cellSize * gridHeight, 0]);

  const xAxis = svg
    .append("g")
    .attr("transform", `translate(0, ${cellSize * totalHeight})`)
    .call(d3.axisBottom(xScale));

  const clip = svg
    .append("defs")
    .append("svg:clipPath")
    .attr("id", `clip-${containerId}`)
    .append("svg:rect")
    .attr("width", cellSize * gridWidth)
    .attr("height", cellSize * totalHeight)
    .attr("x", 0)
    .attr("y", 0);

  const brush = d3
    .brushX()
    .extent([
      [0, 0],
      [cellSize * gridWidth, cellSize * totalHeight],
    ])
    .on("end", (event) => updateBrushEvent(event, svg, xScale));

  const chartGroup = svg
    .append("g")
    .attr("clip-path", `url(#clip-${containerId})`);

  drawGrid(chartGroup, cellSize, gridWidth, totalHeight);

  dataGroup.forEach((data, index) => {
    const yOffset = index * gridHeight * cellSize;

    const line = d3
      .line()
      .x((d, i) => xScale(i))
      .y((d) => yScale(d) + yOffset)
      .curve(d3.curveLinear);

    chartGroup
      .append("path")
      .datum(data)
      .attr("class", "line")
      .attr("fill", "none")
      .attr("stroke", "blue")
      .attr("stroke-width", 1.2)
      .attr("d", line);

    chartGroup
      .append("text")
      .attr("x", 10)
      .attr("y", yOffset + 30)
      .attr("font-size", "20px")
      .attr("font-family", "Yandex Sans Display Light")
      .attr("fill", "black")
      .text(chartNames[index]);
  });

  chartGroup.append("g").attr("class", "brush").call(brush);
  svg.append("g").attr("class", "brush-annotations");

  svg.on("wheel", (event) =>
    handleScroll(
      event,
      svg,
      xScale,
      yScale,
      chartState,
      dataGroup,
      options
    )
  );
  svg.on("dblclick", () =>
    handleDoubleClick(
      svg,
      xScale,
      yScale,
      chartState,
      dataGroup,
      options
    )
  );
}

function updateChart(svg, xScale, yScale, dataGroup, options) {
  const yOffset = options.gridHeight * options.cellSize; // Сдвиг графиков вниз по Y, чтобы отобразить все 6 графиков на одном SVG.

  // Начало и конец видимых данных.
  const start = Math.floor(xScale.domain()[0]);
  const end = Math.ceil(xScale.domain()[1]);

  // xAxis.call(d3.axisBottom(xScale));

  const charts = svg
    .selectAll(".line") // Выбираем все линии графиков.
    .data(dataGroup); // Привязывает массив dataGroup, где каждый элемент массива соответствует одному графику (линии).

  const chartGenerator = (data, index) =>
    d3
      .line()
      .x((d, i) => xScale(start + i)) // i - локальный индекс точки в текущем диапазоне.
      .y((d) => yScale(d) + index * yOffset) // index - номер графика (глобальный сдвиг вниз).
      .curve(d3.curveLinear)(data.slice(start, end)); // слайс данных со start по end.

  charts.join(
    (enter) =>
      enter
        .append("path")
        .attr("class", "line")
        .attr("fill", "none")
        .attr("stroke", "blue")
        .attr("stroke-width", 1.2)
        .attr("d", (d, i) => chartGenerator(d, i)),
    (update) => update.attr("d", (d, i) => chartGenerator(d, i)),
    (exit) => exit.remove()
  );
}

function updateAnnotations(svg, xScale) {
  const brushGroup = svg.select(".brush-annotations");

  const annotationRects = brushGroup
    .selectAll("rect")
    .data(annotations, (d) => `${d.x0}-${d.x1}-${d.type}`);

  annotationRects
    .enter()
    .append("rect")
    .attr("y", 0)
    .attr("height", svg.attr("height"))
    .attr("fill", (d) => annotationColors[d.type])
    .attr("opacity", 0.4)
    .merge(annotationRects)
    .attr("x", (d) => xScale(d.x0))
    .attr("width", (d) => xScale(d.x1) - xScale(d.x0));

  annotationRects.exit().remove();
}

function updateBrushEvent(event, svg, xScale) {
  const extent = event.selection;
  if (!extent) return;

  const [x0, x1] = extent.map(xScale.invert);
  svg.select(".brush").call(d3.brushX().move, null);

  annotations.push({
    x0: x0,
    x1: x1,
    type: currentAnnotationType,
  });

  updateAnnotations(svg, xScale);
}

function handleScroll(
  event,
  svg,
  xScale,
  yScale,
  chartState,
  dataGroup,
  options
) {
  if (!event.altKey) return;
  event.preventDefault();

  if (chartState.throttleTimeout) return;

  chartState.throttleTimeout = setTimeout(() => {
    const currentDomain = xScale.domain();
    const domainWidth = currentDomain[1] - currentDomain[0];

    let newDomain = [
      currentDomain[0] + event.deltaY,
      currentDomain[1] + event.deltaY,
    ];

    if (newDomain[0] < 0) {
      newDomain = [0, domainWidth];
    }
    if (newDomain[1] > dataGroup[0].length) {
      newDomain = [dataGroup[0].length - domainWidth, dataGroup[0].length];
    }

    xScale.domain(newDomain);

    updateChart(svg, xScale, yScale, dataGroup, options);
    updateGrid(svg, xScale, options);
    updateAnnotations(svg, xScale);

    chartState.throttleTimeout = null;
  }, 20);
}

function handleDoubleClick(
  svg,
  xScale,
  yScale,
  chartState,
  dataGroup,
  options
) {
  if (chartState.savedLastFullDomain) {
    xScale.domain(chartState.savedLastFullDomain);
    chartState.savedLastFullDomain = null;
  } else {
    xScale.domain([0, options.visibleLength]);
  }

  updateChart(svg, xScale, yScale, dataGroup, options);
  updateGrid(svg, xScale, options);
  updateAnnotations(svg, xScale);
}

document.addEventListener("DOMContentLoaded", () => {
  const visibleLength = 1500; // Количество отображаемых точек
  const cellSize = 7; // Размер клетки в пикселях
  const gridWidth = 25 * (visibleLength / 500); // Ширина сетки в клетках
  const maxMvValue = 1.5; // Максимальное значение в мВ
  const gridHeight = 20 * maxMvValue; // Высота сетки в клетках

  const chartOptions = {
    cellSize: cellSize,
    visibleLength: visibleLength,
    gridWidth: gridWidth,
    gridHeight: gridHeight,
    maxMvValue: maxMvValue,
  };

  createEcgChartGroup(
    "left-column",
    window.ecgData.slice(0, 6),
    chartOptions,
    window.ecgNames.slice(0, 6)
  );
  createEcgChartGroup(
    "right-column",
    window.ecgData.slice(6, 12),
    chartOptions,
    window.ecgNames.slice(6, 12)
  );

  const buttons = document.querySelectorAll(".tab-button");
  const contents = document.querySelectorAll(".tab-content");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      contents.forEach((content) => (content.style.display = "none"));
      document.getElementById(button.dataset.tab + "-content").style.display =
        "block";
    });
  });

  document.querySelectorAll('input[name="markup-option"]').forEach((radio) => {
    radio.addEventListener("change", function () {
      currentAnnotationType = this.value;
    });
  });
});
