// Функционал с динамической отрисовкой графика:
// function drawGrid(chartGroup, cellSize, gridWidth, gridHeight) {
//   const gridLines = chartGroup.append("g").attr("class", "grid-lines");

//   const gridWidthWhole = 125;
//   // Вертикальные линии (рисуем сразу все линии)
//   for (let x = 0; x <= gridWidthWhole; x++) {
//     gridLines
//       .append("line")
//       .attr("class", "line-vertical")
//       .attr("x1", x * cellSize)
//       .attr("y1", 0)
//       .attr("x2", x * cellSize)
//       .attr("y2", cellSize * gridHeight)
//       .attr("stroke", x % 5 === 0 ? "black" : "gray")
//       .attr("stroke-width", x % 5 === 0 ? 0.8 : 0.5);
//   }

//   // Горизонтальные линии
//   for (let y = 0; y <= gridHeight; y++) {
//     gridLines
//       .append("line")
//       .attr("class", "line-horizontal")
//       .attr("x1", 0)
//       .attr("y1", y * cellSize)
//       .attr("x2", cellSize * gridWidth)
//       .attr("y2", y * cellSize)
//       .attr("stroke", y % 5 === 0 ? "black" : "gray")
//       .attr("stroke-width", y % 5 === 0 ? 0.8 : 0.5);
//   }
// }

// document.addEventListener("DOMContentLoaded", () => {
//   const containerId = "grid-container";
//   const visibleLength = 2000; // Количество отображаемых точек
//   const cellSize = 15; // Размер клетки в пикселях
//   const gridWidth = 25 * (visibleLength / 1000); // Ширина сетки в клетках
//   const maxMvValue = 2; // Максимальное значение в мВ
//   const gridHeight = 20 * maxMvValue; // Высота сетки в клетках

//   const ecgData = window.ecgData;
//   const data = ecgData[0];

//   visibleData = data.slice(0, visibleLength);
//   // visibleData = data;

//   const svg = d3
//     .select(`#${containerId}`)
//     .append("svg")
//     .attr("width", cellSize * gridWidth)
//     .attr("height", cellSize * gridHeight)
//     .attr("viewBox", `0 0 ${cellSize * gridWidth} ${cellSize * gridHeight}`); // определяет координатную систему внутри SVG;

//   const xScale = d3
//     .scaleLinear()
//     .domain([0, visibleLength]) // задаёт диапазон данных: [0, visibleLength] (индексы точек на графике).
//     .range([0, cellSize * gridWidth]); // определяет отображение этого диапазона на пиксели;

//   xAxis = svg
//     .append("g") // добавляет новую группу элементов <g> в SVG. Группы <g> объединяют элементы, чтобы применять к ним общие трансформации, стили и атрибуты;
//     .attr("transform", `translate(0, ${cellSize * gridHeight})`) // перемещает ось вниз на высоту сетки, чтобы она располагалась внизу графика;
//     .call(d3.axisBottom(xScale)); // создаёт ось, ориентированную снизу;

//   const yScale = d3
//     .scaleLinear()
//     .domain([-maxMvValue, maxMvValue])
//     .range([cellSize * gridHeight, 0]);

//   const clip = svg
//     .append("defs") // контейнер для элементов, которые определяют графические шаблоны или эффекты;
//     .append("svg:clipPath") // определяет область клиппинга;
//     .attr("id", "clip")
//     .append("svg:rect") // задание формы клиппинга;
//     .attr("width", cellSize * gridWidth)
//     .attr("height", cellSize * gridHeight)
//     .attr("x", 0)
//     .attr("y", 0);

//   const brush = d3
//     .brushX()
//     .extent([
//       [0, 0],
//       [cellSize * gridWidth, cellSize * gridHeight],
//     ]) // задаёт размеры области, в которой можно выделять;
//     .on("end", updateChart);

//   const chartGroup = svg.append("g").attr("clip-path", "url(#clip)"); // привязывает клиппинг к группе, где лежит график. Все элементы внутри chartGroup обрезаются по области клиппинга;

//   drawGrid(chartGroup, cellSize, gridWidth, gridHeight);

//   const line = d3
//     .line()
//     .x((d, i) => xScale(i)) // преобразует индекс данных i в пиксельное значение на оси X;
//     .y((d) => yScale(d)) // преобразует значение данных d в пиксельное значение на оси Y;
//     .curve(d3.curveLinear);

//   chartGroup
//     .append("path")
//     .datum(visibleData)
//     .attr("class", "line")
//     .attr("fill", "none")
//     .attr("stroke", "blue")
//     .attr("stroke-width", 1)
//     .attr("d", line);

//   chartGroup.append("g").attr("class", "brush").call(brush); // Добавляет область выделения (brush) в группу графика;

//   let idleTimeout;
//   function idled() {
//     idleTimeout = null;
//   }

//   function updateChart(event, d) {
//     extent = event.selection;

//     if (!extent) {
//       if (!idleTimeout) return (idleTimeout = setTimeout(idled, 350));
//       xScale.domain([0, visibleLength]);
//     } else {
//       xScale.domain([xScale.invert(extent[0]), xScale.invert(extent[1])]);
//       chartGroup.select(".brush").call(brush.move, null); // сброс выделения после завершения брашинга;
//     }

//     xAxis.transition().duration(1000).call(d3.axisBottom(xScale)); // обновление оси для пересчёта отметок по новому диапазону данных xScale.domain;
//     chartGroup
//       .select(".line")
//       .transition()
//       .duration(1000)
//       .attr(
//         "d",
//         d3
//           .line()
//           .x((d, i) => xScale(i))
//           .y((d) => yScale(d))
//       ); // пересчёт пути линии (d), с обновлённым xScale;

//     svg
//       .selectAll(".grid-lines .line-vertical")
//       .transition()
//       .duration(1000)
//       .attr("x1", (d, i) => xScale((i * visibleLength) / gridWidth))
//       .attr("x2", (d, i) => xScale((i * visibleLength) / gridWidth));
//   }

//   svg.on("wheel", function (event) {
//     if (!event.altKey) return;

//     event.preventDefault();

//     const currentDomain = xScale.domain();

//     let newDomain = [
//       currentDomain[0] + event.deltaY,
//       currentDomain[1] + event.deltaY,
//     ];

//     // Ограничиваем левую границу
//     if (newDomain[0] < 0) {
//       const domainWidth = newDomain[1] - newDomain[0];
//       newDomain[0] = 0;
//       newDomain[1] = domainWidth;
//     }

//     // Ограничиваем правую границу
//     if (newDomain[1] > data.length) {
//       const domainWidth = newDomain[1] - newDomain[0];
//       newDomain[1] = data.length;
//       newDomain[0] = data.length - domainWidth;
//     }

//     xScale.domain(newDomain); // Обновляем масштаб оси X

//     // Обновляем данные для графика
//     const startIndex = Math.max(0, newDomain[0]);
//     const endIndex = Math.min(data.length, newDomain[1]);
//     const visibleData = data.slice(startIndex, endIndex);

//     xAxis.transition().call(d3.axisBottom(xScale));

//     chartGroup
//       .select(".line")
//       .datum(visibleData)
//       .attr(
//         "d",
//         d3
//           .line()
//           .x((d, i) => xScale(startIndex + i))
//           .y((d) => yScale(d))
//       ); // пересчёт пути линии (d), с обновлённым xScale;

//     svg
//       .selectAll(".grid-lines .line-vertical")
//       .attr("x1", (d, i) => xScale((i * visibleLength) / gridWidth))
//       .attr("x2", (d, i) => xScale((i * visibleLength) / gridWidth));
//   });

//   svg.on("dblclick", function () {
//     xScale.domain([0, visibleLength]);
//     xAxis.transition().duration(1000).call(d3.axisBottom(xScale));
//     line
//       .select(".line")
//       .transition()
//       .attr(
//         "d",
//         d3
//           .line()
//           .x((d, i) => xScale(i))
//           .y((d) => yScale(d))
//       );

//     svg
//       .selectAll(".grid-lines .line-vertical")
//       .transition()
//       .duration(1000)
//       .attr("x1", (d, i) => i * cellSize)
//       .attr("x2", (d, i) => i * cellSize);
//   });
// });

// ТЕКУЩИЙ КОД

// function drawGrid(chartGroup, cellSize, gridWidth, gridHeight) {
//   const gridLines = chartGroup.append("g").attr("class", "grid-lines");

//   const gridWidthWhole = 125;
//   // Вертикальные линии (рисуем сразу все линии)
//   for (let x = 0; x <= gridWidthWhole; x++) {
//     gridLines
//       .append("line")
//       .attr("class", "line-vertical")
//       .attr("x1", x * cellSize)
//       .attr("y1", 0)
//       .attr("x2", x * cellSize)
//       .attr("y2", cellSize * gridHeight)
//       .attr("stroke", x % 5 === 0 ? "black" : "gray")
//       .attr("stroke-width", x % 5 === 0 ? 0.8 : 0.5);
//   }

//   // Горизонтальные линии
//   for (let y = 0; y <= gridHeight; y++) {
//     gridLines
//       .append("line")
//       .attr("class", "line-horizontal")
//       .attr("x1", 0)
//       .attr("y1", y * cellSize)
//       .attr("x2", cellSize * gridWidth)
//       .attr("y2", y * cellSize)
//       .attr("stroke", y % 5 === 0 ? "black" : "gray")
//       .attr("stroke-width", y % 5 === 0 ? 0.8 : 0.5);
//   }
// }

// document.addEventListener("DOMContentLoaded", () => {
//   const containerId = "grid-container";
//   const visibleLength = 1000; // Количество отображаемых точек
//   const cellSize = 15; // Размер клетки в пикселях
//   const gridWidth = 25 * (visibleLength / 1000); // Ширина сетки в клетках
//   const maxMvValue = 2; // Максимальное значение в мВ
//   const gridHeight = 20 * maxMvValue; // Высота сетки в клетках

//   const ecgData = window.ecgData;
//   const data = ecgData[0];

//   // visibleData = data.slice(0, visibleLength);

//   const svg = d3
//     .select(`#${containerId}`)
//     .append("svg")
//     .attr("width", cellSize * gridWidth)
//     .attr("height", cellSize * gridHeight)
//     .attr("viewBox", `0 0 ${cellSize * gridWidth} ${cellSize * gridHeight}`); // определяет координатную систему внутри SVG;

//   const xScale = d3
//     .scaleLinear()
//     .domain([0, visibleLength]) // задаёт диапазон данных: [0, visibleLength] (индексы точек на графике).
//     .range([0, cellSize * gridWidth]); // определяет отображение этого диапазона на пиксели;

//   xAxis = svg
//     .append("g") // добавляет новую группу элементов <g> в SVG. Группы <g> объединяют элементы, чтобы применять к ним общие трансформации, стили и атрибуты;
//     .attr("transform", `translate(0, ${cellSize * gridHeight})`) // перемещает ось вниз на высоту сетки, чтобы она располагалась внизу графика;
//     .call(d3.axisBottom(xScale)); // создаёт ось, ориентированную снизу;

//   const yScale = d3
//     .scaleLinear()
//     .domain([-maxMvValue, maxMvValue])
//     .range([cellSize * gridHeight, 0]);

//   const clip = svg
//     .append("defs") // контейнер для элементов, которые определяют графические шаблоны или эффекты;
//     .append("svg:clipPath") // определяет область клиппинга;
//     .attr("id", "clip")
//     .append("svg:rect") // задание формы клиппинга;
//     .attr("width", cellSize * gridWidth)
//     .attr("height", cellSize * gridHeight)
//     .attr("x", 0)
//     .attr("y", 0);

//   const brush = d3
//     .brushX()
//     .extent([
//       [0, 0],
//       [cellSize * gridWidth, cellSize * gridHeight],
//     ]) // задаёт размеры области, в которой можно выделять;
//     .on("end", updateChart);

//   const chartGroup = svg.append("g").attr("clip-path", "url(#clip)"); // привязывает клиппинг к группе, где лежит график. Все элементы внутри chartGroup обрезаются по области клиппинга;

//   drawGrid(chartGroup, cellSize, gridWidth, gridHeight);

//   const line = d3
//     .line()
//     .x((d, i) => xScale(i)) // преобразует индекс данных i в пиксельное значение на оси X;
//     .y((d) => yScale(d)) // преобразует значение данных d в пиксельное значение на оси Y;
//     .curve(d3.curveLinear);

//   chartGroup
//     .append("path")
//     .datum(data)
//     .attr("class", "line")
//     .attr("fill", "none")
//     .attr("stroke", "blue")
//     .attr("stroke-width", 1)
//     .attr("d", line);

//   chartGroup.append("g").attr("class", "brush").call(brush); // Добавляет область выделения (brush) в группу графика;

//   let idleTimeout;
//   let savedLastFullDomain;
//   function idled() {
//     idleTimeout = null;
//   }

//   function updateChart(event, d) {
//     extent = event.selection;
//     if (!extent) {
//       if (!idleTimeout) return (idleTimeout = setTimeout(idled, 350));
//       xScale.domain(savedLastFullDomain || [0, visibleLength]);
//     } else {
//       if (!savedLastFullDomain) {
//         savedLastFullDomain = xScale.domain();
//       }
//       xScale.domain([xScale.invert(extent[0]), xScale.invert(extent[1])]);
//       chartGroup.select(".brush").call(brush.move, null); // сброс выделения после завершения брашинга; снова вызывает updateChart;
//     }

//     xAxis.transition().duration(1000).call(d3.axisBottom(xScale)); // обновление оси для пересчёта отметок по новому диапазону данных xScale.domain;
//     chartGroup
//       .select(".line")
//       .transition()
//       .duration(1000)
//       .attr(
//         "d",
//         d3
//           .line()
//           .x((d, i) => xScale(i))
//           .y((d) => yScale(d))
//       ); // пересчёт пути линии (d), с обновлённым xScale;

//     svg
//       .selectAll(".grid-lines .line-vertical")
//       .transition()
//       .duration(1000)
//       .attr("x1", (d, i) => xScale((i * visibleLength) / gridWidth))
//       .attr("x2", (d, i) => xScale((i * visibleLength) / gridWidth));
//   }

//   svg.on("wheel", function (event) {
//     if (!event.altKey) return;

//     event.preventDefault();

//     const currentDomain = xScale.domain();
//     const domainWidth = currentDomain[1] - currentDomain[0];

//     let newDomain = [
//       currentDomain[0] + event.deltaY,
//       currentDomain[1] + event.deltaY,
//     ];

//     if (newDomain[0] < 0) {
//       newDomain = [0, domainWidth];
//     }
//     if (newDomain[1] > data.length) {
//       newDomain = [data.length - domainWidth, data.length];
//     }

//     // Обновляем масштаб оси X
//     xScale.domain(newDomain);

//     // Обновляем ось X
//     xAxis.transition().call(d3.axisBottom(xScale));

//     // Обновляем график
//     chartGroup.select(".line").attr(
//       "d",
//       d3
//         .line()
//         .x((d, i) => xScale(i)) // Полный доступ ко всем данным
//         .y((d) => yScale(d))
//     );

//     svg
//       .selectAll(".grid-lines .line-vertical")
//       .attr("x1", (d, i) => xScale((i * visibleLength) / gridWidth))
//       .attr("x2", (d, i) => xScale((i * visibleLength) / gridWidth));
//   });

//   svg.on("dblclick", function () {
//     if (savedLastFullDomain) {
//       xScale.domain(savedLastFullDomain);
//       savedLastFullDomain = null;
//     } else {
//       xScale.domain([0, visibleLength]);
//     }
//     // xScale.domain([0, visibleLength]);

//     xAxis.transition().duration(1000).call(d3.axisBottom(xScale));

//     chartGroup
//       .select(".line")
//       .transition()
//       .duration(1000)
//       .attr(
//         "d",
//         d3
//           .line()
//           .x((d, i) => xScale(i))
//           .y((d) => yScale(d))
//       );

//     svg
//       .selectAll(".grid-lines .line-vertical")
//       .transition()
//       .duration(1000)
//       .attr("x1", (d, i) => xScale((i * visibleLength) / gridWidth))
//       .attr("x2", (d, i) => xScale((i * visibleLength) / gridWidth));
//     //.attr("x1", (d, i) => i * cellSize)
//     //.attr("x2", (d, i) => i * cellSize);
//   });
// });


// Function to handle idle timeout
function idled(chartState) {
  chartState.idleTimeout = null;
}

// Function to draw grid
function drawGrid(chartGroup, cellSize, gridWidth, gridHeight) {
  const gridLines = chartGroup.append("g").attr("class", "grid-lines");

  // Vertical lines
  const gridWidthWhole = 125;
  for (let x = 0; x <= gridWidthWhole; x++) {
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

  // Horizontal lines
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

// Function to create ECG chart
function createEcgChart(containerId, data, options) {
  const { cellSize, visibleLength, gridWidth, gridHeight, maxMvValue } =
    options;
  
  const chartState = {
    idleTimeout: null,
    savedLastFullDomain: null,
  };

  const svg = d3
    .select(`#${containerId}`)
    .append("svg")
    .attr("width", cellSize * gridWidth)
    .attr("height", cellSize * gridHeight)
    .attr("viewBox", `0 0 ${cellSize * gridWidth} ${cellSize * gridHeight}`);

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
    .attr("transform", `translate(0, ${cellSize * gridHeight})`)
    .call(d3.axisBottom(xScale));

  const clip = svg
    .append("defs")
    .append("svg:clipPath")
    .attr("id", `clip-${containerId}`)
    .append("svg:rect")
    .attr("width", cellSize * gridWidth)
    .attr("height", cellSize * gridHeight)
    .attr("x", 0)
    .attr("y", 0);

  const brush = d3
    .brushX()
    .extent([
      [0, 0],
      [cellSize * gridWidth, cellSize * gridHeight],
    ])
    .on("end", (event) =>
      updateChart(event, svg, xScale, xAxis, yScale, chartState, options)
    );

  const chartGroup = svg
    .append("g")
    .attr("clip-path", `url(#clip-${containerId})`);

  drawGrid(chartGroup, cellSize, gridWidth, gridHeight);

  const line = d3
    .line()
    .x((d, i) => xScale(i))
    .y((d) => yScale(d))
    .curve(d3.curveLinear);

  chartGroup
    .append("path")
    .datum(data)
    .attr("class", "line")
    .attr("fill", "none")
    .attr("stroke", "blue")
    .attr("stroke-width", 1)
    .attr("d", line);

  chartGroup.append("g").attr("class", "brush").call(brush);

  svg.on("wheel", (event) =>
    handleScroll(event, svg, xScale, xAxis, yScale, data, options)
  );

  svg.on("dblclick", () =>
    handleDoubleClick(svg, xScale, xAxis, yScale, chartState, options)
  );
}

// Function to update chart on brush event
function updateChart(event, svg, xScale, xAxis, yScale, chartState, options) {
  const { visibleLength, gridWidth } = options;
  const extent = event.selection;

  if (!extent) {
    if (!chartState.idleTimeout) return (chartState.idleTimeout = setTimeout(() => idled(chartState), 350));
    xScale.domain(chartState.savedLastFullDomain || [0, visibleLength]);
  } else {
    if (!chartState.savedLastFullDomain) {
      chartState.savedLastFullDomain = xScale.domain();
    }
    xScale.domain([xScale.invert(extent[0]), xScale.invert(extent[1])]);
    svg.select(".brush").call(d3.brushX().move, null);
  }

  xAxis.transition().duration(1000).call(d3.axisBottom(xScale));

  svg
    .select(".line")
    .transition()
    .duration(1000)
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
    .attr("x1", (d, i) => xScale((i * visibleLength) / gridWidth))
    .attr("x2", (d, i) => xScale((i * visibleLength) / gridWidth));
}

// Function to handle scroll event
function handleScroll(event, svg, xScale, xAxis, yScale, data, options) {
  const { visibleLength, gridWidth } = options;

  if (!event.altKey) return;
  event.preventDefault();

  const currentDomain = xScale.domain();
  const domainWidth = currentDomain[1] - currentDomain[0];

  let newDomain = [
    currentDomain[0] + event.deltaY,
    currentDomain[1] + event.deltaY,
  ];

  if (newDomain[0] < 0) {
    newDomain = [0, domainWidth];
  }
  if (newDomain[1] > data.length) {
    newDomain = [data.length - domainWidth, data.length];
  }

  xScale.domain(newDomain);

  xAxis.transition().call(d3.axisBottom(xScale));

  svg.select(".line").attr(
    "d",
    d3
      .line()
      .x((d, i) => xScale(i))
      .y((d) => yScale(d))
  );

  svg
    .selectAll(".grid-lines .line-vertical")
    .attr("x1", (d, i) => xScale((i * visibleLength) / gridWidth))
    .attr("x2", (d, i) => xScale((i * visibleLength) / gridWidth));
}

// Function to handle double-click event
function handleDoubleClick(svg, xScale, xAxis, yScale, chartState, options) {
  const { visibleLength, gridWidth } = options;

  if (chartState.savedLastFullDomain) {
    xScale.domain(chartState.savedLastFullDomain);
    chartState.savedLastFullDomain = null;
  } else {
    xScale.domain([0, visibleLength]);
  }

  xAxis.transition().duration(1000).call(d3.axisBottom(xScale));

  svg
    .select(".line")
    .transition()
    .duration(1000)
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
    .attr("x1", (d, i) => xScale((i * visibleLength) / gridWidth))
    .attr("x2", (d, i) => xScale((i * visibleLength) / gridWidth));
}

document.addEventListener("DOMContentLoaded", () => {
  const ecgData = window.ecgData[0];

  const visibleLength = 1000; // Количество отображаемых точек
  const cellSize = 15; // Размер клетки в пикселях
  const gridWidth = 25 * (visibleLength / 1000); // Ширина сетки в клетках
  const maxMvValue = 2; // Максимальное значение в мВ
  const gridHeight = 20 * maxMvValue; // Высота сетки в клетках

  const chartOptions = {
    cellSize: cellSize,
    visibleLength: visibleLength,
    gridWidth: gridWidth,
    gridHeight: gridHeight,
    maxMvValue: maxMvValue,
  };

  createEcgChart("grid-container", ecgData, chartOptions);
});
