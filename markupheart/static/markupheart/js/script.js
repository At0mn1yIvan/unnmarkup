//document.addEventListener("DOMContentLoaded", function() {
//    const data = window.ecgData;
//    const names = window.ecgNames;
//
//    const zoomFactor = 500;
//    const maxOffset = data[0].length - zoomFactor;
//    let offset = 0;
//
//    document.getElementById("scroll").setAttribute("max", maxOffset);
//
//    // Функция для отрисовки сетки и осей
//    function drawGridAndAxes(ctx, canvas, grid_size, x_axis_distance_grid_lines, y_axis_distance_grid_lines, x_axis_starting_point, minValue, maxValue, offset, zoomFactor) {
//        const canvas_width = canvas.width;
//        const canvas_height = canvas.height;
//
//        // Количество вертикальных и горизонтальных линий
//        const num_lines_x = Math.floor(zoomFactor / grid_size);
//        const num_lines_y = Math.floor(zoomFactor / grid_size);
//
//        // Отрисовка горизонтальных линий (ось X и сетка)
//        for (let i = 0; i <= num_lines_x; i++) {
//            ctx.beginPath();
//            ctx.lineWidth = 1;
//            // Ось X рисуем черным цветом
//            if (i === x_axis_distance_grid_lines) {
//                //ctx.strokeStyle = "#000000";
//            } else {
//                ctx.strokeStyle = "#e9e9e9";
//            }
//
//            ctx.moveTo(0, grid_size * i + 0.5);
//            ctx.lineTo(canvas_width, grid_size * i + 0.5);
//            ctx.stroke();
//        }
//
//        // Отрисовка вертикальных линий (ось Y и сетка)
//        for (let i = 0; i <= num_lines_y; i++) {
//            ctx.beginPath();
//            ctx.lineWidth = 1;
//            // Ось Y рисуем черным цветом
//            if (i === y_axis_distance_grid_lines) {
//                //ctx.strokeStyle = "#000000";
//            } else {
//                ctx.strokeStyle = "#e9e9e9";
//            }
//
//            ctx.moveTo(grid_size * i + 0.5, 0);
//            ctx.lineTo(grid_size * i + 0.5, canvas_height);
//            ctx.stroke();
//        }
//        // NEW
//        const yZeroPosition = canvas_height - (0 - minValue) * (canvas_height / (maxValue - minValue));
//        ctx.beginPath();
//        ctx.lineWidth = 2;
//        ctx.strokeStyle = "#000000"; // Черная ось X
//        ctx.moveTo(0, yZeroPosition);
//        ctx.lineTo(canvas_width, yZeroPosition);
//        ctx.stroke();
//
//        // Отрисовка меток и подписей по оси X (учитываем смещение offset)
//        const visibleDataStart = offset;
//        const visibleDataEnd = offset + zoomFactor;
//        const xAxisStep = (visibleDataEnd - visibleDataStart) / num_lines_y;
//
//        for (let i = 1; i <= num_lines_y; i++) {
//            ctx.beginPath();
//            ctx.lineWidth = 1;
//            ctx.strokeStyle = "#000000";
//            ctx.moveTo(grid_size * i + 0.5, -3);
//            ctx.lineTo(grid_size * i + 0.5, 3);
//            ctx.stroke();
//
//            ctx.font = '9px Arial';
//            ctx.textAlign = 'start';
//
//            const label = Math.floor(visibleDataStart + i * xAxisStep);
//            ctx.fillText(label, grid_size * i - 2, 15);
//        }
//
//        // Отрисовка меток и подписей по оси Y
//        const yRange = maxValue - minValue;
//        const yAxisStep = yRange / num_lines_x;
//
//        for (let i = 0; i <= num_lines_x; i++) {
//            const yValue = maxValue - i * yAxisStep; // Значение для метки по оси Y
//
//            ctx.beginPath();
//            ctx.lineWidth = 1;
//            ctx.strokeStyle = "#000000";
//            ctx.moveTo(-3, grid_size * i + 0.5);
//            ctx.lineTo(3, grid_size * i + 0.5);
//            ctx.stroke();
//
//            ctx.font = '9px Arial';
//            ctx.textAlign = 'start';
//            ctx.fillText(yValue.toFixed(2), 8, grid_size * i + 3); // Отображаем значение с двумя знаками после запятой
//        }
//    }
//
//    // Функция для отрисовки графика ECG
//    function drawECG(canvasId, ecgData, offset) {
//        const canvas = document.getElementById(canvasId);
//        const ctx = canvas.getContext('2d');
//        const minValue = Math.min(...ecgData);
//        const maxValue = Math.max(...ecgData);
//
//        ctx.clearRect(0, 0, canvas.width, canvas.height);
//        const visibleData = ecgData.slice(offset, offset + zoomFactor);
//
//        // Отрисовка сетки и осей перед графиком, с учетом амплитуд графика (minValue, maxValue)
//        drawGridAndAxes(ctx, canvas, 20, 5, 5, { number: 1, suffix: '\u03a0' }, minValue, maxValue, offset, zoomFactor);
//
//        ctx.beginPath();
//        ctx.strokeStyle = "#8B0000";
//
//        const scaleX = canvas.width / (visibleData.length - 1);
//        const scaleY = canvas.height / (maxValue - minValue);
//
//        for (let i = 0; i < visibleData.length; i++) {
//            const x = i * scaleX;
//            const y = canvas.height - (visibleData[i] - minValue) * scaleY;
//            if (i === 0) {
//                ctx.moveTo(x, y);
//            } else {
//                ctx.lineTo(x, y);
//            }
//        }
//
//        ctx.stroke();
//    }
//
//    // Функция обновления графиков
//    function updateCharts(offset) {
//        for (let i = 0; i < 6; i++) {
//            for (let j of [0, 6]) {
//                drawECG(`chart_${names[i+j]}`, data[i + j], offset);
//            }
//        }
//    }
//
//    // Обработчик ползунка
//    document.getElementById("scroll").addEventListener("input", function() {
//        offset = parseInt(this.value);
//        updateCharts(offset);
//    });
//
//    // Первоначальная отрисовка графиков
//    updateCharts(offset);
//});

const DELTA_Y = 0.1;
const VIEWPORT_SIZE = 1000;
const SCROLL_STEP = 100;

function getTicks(last, values) {
  return d3.range(0, last + last / values, last / values);
}

function findGlobalMinMax(data) {
  const globalMin = d3.min(data, (arr) => d3.min(arr));
  const globalMax = d3.max(data, (arr) => d3.max(arr));

  return [globalMin, globalMax];
}

function buildChart(containerId, index) {
  const data = window.ecgData[index];
  const name = window.ecgNames[index];
  const totalDataPoints = data.length;

  const [globalMinY, globalMaxY] = findGlobalMinMax(window.ecgData);

  // Начальный индекс для прокрутки
  let currentStartIndex = 0;
  // Флаг для отключения/включения прокрутки
  let isMouseOverChart = false;

  // Графики строятся относительно общего минимума
  const minY = globalMinY - DELTA_Y;
  const maxY = globalMaxY + DELTA_Y;

  // Графики строятся относительно собственных минимумов
  //    const minY = d3.min(data) - DELTA_Y;
  //    const maxY = d3.max(data) + DELTA_Y;

  // Количество тиков по оси X и Y
  const ticksAmountX = 25 * (VIEWPORT_SIZE / 1000);
  const ticksAmountY = 10 * (maxY - minY);

  // Получение ширины контейнера для корректной отрисовки
  const container = d3.select(`#${containerId}`);
  const containerWidth = container.node().getBoundingClientRect().width;

  // Общие данные о размере графика
  const innerChartWidth = containerWidth;
  const innerChartHeight =
    VIEWPORT_SIZE === data.length
      ? innerChartWidth / 2
      : innerChartWidth * (ticksAmountY / ticksAmountX);
  const margin = { top: 10, right: 30, bottom: 40, left: 30 };
  const svgWidth = innerChartWidth - margin.left - margin.right;
  const svgHeight = innerChartHeight - margin.top - margin.bottom;

  // Задание X и Y, а так же их диапазона
  const x = d3.scaleLinear().range([0, svgWidth]);
  const y = d3.scaleLinear().range([svgHeight, 0]);

  const svg = d3
    .select(`#${containerId}`)
    .append("svg")
    .attr("width", svgWidth + margin.left + margin.right)
    .attr("height", svgHeight + margin.top + margin.bottom)
    .on("mouseenter", () => (isMouseOverChart = true))
    .on("mouseleave", () => (isMouseOverChart = false));

  // Создаем группу для сетки, которая обновляться не будет
  const gridGroup = svg
    .append("g")
    .attr("class", "grid-group")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Создаем группу для графика, которая будет обновляться
  const chartGroup = svg
    .append("g")
    .attr("class", "chart-group")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const line = d3
    .line()
    .x((d, i) => x(currentStartIndex + i))
    .y((d) => y(d));

  const drawGrid = () => {
    // Ось X для сетки
    gridGroup
      .selectAll("xGrid")
      .data(getTicks(VIEWPORT_SIZE, ticksAmountX))
      .join("line")
      .attr("x1", (d) => x(d))
      .attr("x2", (d) => x(d))
      .attr("y1", 0)
      .attr("y2", svgHeight)
      .attr("stroke", "#e0e0e0")
      .attr("stroke-width", 0.5);

    // Ось Y для сетки
    gridGroup
      .selectAll("yGrid")
      .data(y.ticks(ticksAmountY))
      .join("line")
      .attr("x1", 0)
      .attr("x2", svgWidth)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d))
      .attr("stroke", "#e0e0e0")
      .attr("stroke-width", 0.5);

    // Текст с названием графика
    gridGroup
      .append("text")
      .attr("x", margin.left + 50)
      .attr("y", margin.top + 50)
      .attr("text-anchor", "middle")
      .attr("font-size", "32px")
      .attr("font-family", "Yandex Sans Display Light")
      .attr("fill", "black")
      .text(name);
  };

  const updateChart = () => {
    const visibleData = data.slice(
      currentStartIndex,
      currentStartIndex + VIEWPORT_SIZE
    );
    const tickValuesX = d3.range(
      currentStartIndex,
      currentStartIndex + VIEWPORT_SIZE + SCROLL_STEP,
      SCROLL_STEP
    );

    x.domain([currentStartIndex, currentStartIndex + VIEWPORT_SIZE]);
    y.domain([minY, maxY]);

    chartGroup.selectAll("*").remove();

    chartGroup
      .append("g")
      .attr("transform", `translate(0,${svgHeight})`)
      .call(d3.axisBottom(x).tickValues(tickValuesX));

    chartGroup
      .append("g")
      .call(d3.axisLeft(y).ticks(ticksAmountY).tickFormat(d3.format(".1f")));

    chartGroup
      .append("path")
      .datum(visibleData)
      .attr("fill", "none")
      .attr("stroke", "gray")
      .attr("stroke-width", 1.5)
      .attr("d", line);
  };

  updateChart();
  drawGrid();

  d3.select(`#${containerId}`).on("wheel", function (event) {
    if (!isMouseOverChart) return;

    event.preventDefault();
    if (event.deltaY < 0) {
      currentStartIndex = Math.max(0, currentStartIndex - SCROLL_STEP);
    } else {
      currentStartIndex = Math.min(
        totalDataPoints - VIEWPORT_SIZE,
        currentStartIndex + SCROLL_STEP
      );
    }
    updateChart();
  });
}

function buildCharts() {
    for (let i = 0; i < 6; i++) {
        for (let j of [0, 6]) {
            buildChart(`chart-container_${window.ecgNames[i+j]}`, i+j);
        }
    }
}

document.addEventListener("DOMContentLoaded", function () {
  buildCharts();
});
