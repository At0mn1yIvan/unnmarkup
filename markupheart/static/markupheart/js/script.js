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
      buildChart(`chart-container_${window.ecgNames[i + j]}`, i + j);
    }
  }
}

document.addEventListener("DOMContentLoaded", function () {
  buildCharts();
});

