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
//            // TODO: убрать if.
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
//            // TODO: убрать if.
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
//        // TODO: решить, нужны ли отметки на осях X и Y.
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

//document.addEventListener("DOMContentLoaded", function() {
//    const data = window.ecgData;
//    const names = window.ecgNames;
//
//    const zoomFactor = 500; // Количество точек для отображения
//    const maxOffset = data[0].length - zoomFactor;
//    let offset = 0;
//
//    document.getElementById("scroll").setAttribute("max", maxOffset);
//
//    // Размер сетки — 1 мм = 1 клетка
//    const mmPerGrid = 1;
//    // Высота клетки в мм = 10 мм (1 милливольт)
//    const mmPerMillivolt = 10;
//    // Ширина клетки по X = 25 мм (1 секунда = 1000 мс)
//    const mmPerSecond = 25;
//
//    // Функция для отрисовки сетки
//    function drawGridAndAxes(ctx, canvas) {
//        const canvasWidth = canvas.width;
//        const canvasHeight = canvas.height;
//
//        // Вычисляем размеры квадратных клеток
//        const cellSizeX = canvasWidth / (mmPerSecond * 5);  // 25 мм = 1 секунда, 5 секунд данных
//        const cellSizeY = canvasHeight / (mmPerMillivolt * 2); // 10 мм = 1 милливольт, 2 милливольта по оси Y (по умолчанию)
//
//        // Отрисовка вертикальных линий сетки (ось X)
//        for (let x = 0; x <= canvasWidth; x += cellSizeX) {
//            ctx.beginPath();
//            ctx.lineWidth = (x % (cellSizeX * 5) === 0) ? 1 : 0.5; // Толстая линия каждые 25 мм (1 секунда)
//            ctx.strokeStyle = "#e0e0e0"; // Светло-серая сетка
//            ctx.moveTo(x, 0);
//            ctx.lineTo(x, canvasHeight);
//            ctx.stroke();
//        }
//
//        // Отрисовка горизонтальных линий сетки (ось Y)
//        for (let y = 0; y <= canvasHeight; y += cellSizeY) {
//            ctx.beginPath();
//            ctx.lineWidth = (y % (cellSizeY * 10) === 0) ? 1 : 0.5; // Толстая линия каждые 10 мм (1 милливольт)
//            ctx.strokeStyle = "#e0e0e0"; // Светло-серая сетка
//            ctx.moveTo(0, y);
//            ctx.lineTo(canvasWidth, y);
//            ctx.stroke();
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
//
//        // Отображаемая часть данных с учетом сдвига (offset) и zoomFactor
//        const visibleData = ecgData.slice(offset, offset + zoomFactor);
//
//        // Отрисовка сетки перед графиком
//        drawGridAndAxes(ctx, canvas);
//
//        ctx.beginPath();
//
//        // Подгоняем масштаб графика по осям X и Y
//        const scaleX = canvas.width / (zoomFactor); // zoomFactor определяет количество точек на графике
//        const scaleY = canvas.height / ((maxValue - minValue) * mmPerMillivolt); // 1 милливольт = 10 мм
//
//        // Ось Y — разделение графика по нулевой амплитуде
//        const zeroY = canvas.height / 2;
//
//        for (let i = 0; i < visibleData.length; i++) {
//            const x = i * scaleX;
//            const y = zeroY - visibleData[i] * scaleY; // Растягиваем график под сетку
//            if (i === 0) {
//                ctx.moveTo(x, y);
//            } else {
//                ctx.lineTo(x, y);
//            }
//        }
//
//        ctx.strokeStyle = "#000000"; // Чёрный цвет для линии графика
//        ctx.lineWidth = 1.5;
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

function getTicks(last, values) {
    var myArray = [0];
    for(var i = 1; i <= values; i++) {
        myArray.push(last * i / values)
    }
    return myArray;
}

function findGlobalMinMax(data) {
    const globalMin = d3.min(data, arr => d3.min(arr));
    const globalMax = d3.max(data, arr => d3.max(arr));

    return [ globalMin, globalMax ];
}

document.addEventListener("DOMContentLoaded", function() {
    const data = window.ecgData[0];
    const margin = { top: 10, right: 30, bottom: 40, left: 30 };

    const [globalMinY, globalMaxY] = findGlobalMinMax(window.ecgData);

    const totalDataPoints = data.length;
    const scrollFactor = 1000;
    const scrollStep = 100;
    let currentStartIndex = 0;
    let isMouseOverChart = false;

    // Графики строятся относительно общего минимума
    const deltaY = 0.1;
//    const minY = globalMinY - deltaY;
//    const maxY = globalMaxY + deltaY;

    // Графики строятся относительно собственных минимумов
    const minY = d3.min(data) - deltaY;
    const maxY = d3.max(data) + deltaY;

    const ticksAmountX = 25 * (scrollFactor / 1000);
    const ticksAmountY = 10 * (maxY - minY);
    const unscaledWidth = 1000;
    const unscaledHeight = (scrollFactor === data.length) ? (unscaledWidth / 2) : (unscaledWidth * (ticksAmountY / ticksAmountX));
    const width = unscaledWidth - margin.left - margin.right;
    const height = unscaledHeight - margin.top - margin.bottom;

    const x = d3.scaleLinear().range([0, width]);
    const y = d3.scaleLinear().range([height, 0]);

    const svg = d3.select("#chart-container")
        .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .on("mouseenter", () => isMouseOverChart = true)
            .on("mouseleave", () => isMouseOverChart = false);

    // Создаем группу для сетки, которая обновляться не будет
    const gridGroup = svg.append("g")
        .attr("class", "grid-group")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Создаем группу для графика, которая будет обновляться
    const chartGroup = svg.append("g")
        .attr("class", "chart-group")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const line = d3.line()
            .x((d, i) => x(currentStartIndex + i))
            .y(d => y(d));

    const drawGrid = () => {
    // Ось X для сетки
        gridGroup.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x)
                .tickValues(getTicks(scrollFactor, ticksAmountX))
                .tickSize(-height)
                .tickFormat(""));

        // Ось Y для сетки
        gridGroup.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(y)
                .ticks(ticksAmountY)
                .tickSize(-width)
                .tickFormat(""));
    };

    const updateChart = () => {
        const visibleData = data.slice(currentStartIndex, currentStartIndex + scrollFactor);
        const tickValuesX = d3.range(currentStartIndex, currentStartIndex + scrollFactor + scrollStep, scrollStep);

        x.domain([currentStartIndex, currentStartIndex + scrollFactor]);
        y.domain([minY, maxY]);

        chartGroup.selectAll("*").remove();

        chartGroup.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x)
                .tickValues(tickValuesX));

        chartGroup.append("g")
            .call(d3.axisLeft(y)
                .ticks(ticksAmountY)
                .tickFormat(d3.format(".1f")));

        chartGroup.append("path")
            .datum(visibleData)
            .attr("fill", "none")
            .attr("stroke", "steelblue")
            .attr("stroke-width", 1.5)
            .attr("d", line);
    };

    updateChart();
    drawGrid();

    d3.select("#chart-container").on("wheel", function(event) {
        if (!isMouseOverChart) return;

        event.preventDefault();
        if (event.deltaY < 0) {
            currentStartIndex = Math.max(0, currentStartIndex - scrollStep);
        } else {
            currentStartIndex = Math.min(totalDataPoints - scrollFactor, currentStartIndex + scrollStep);
        }
        updateChart();
    });
});
