//document.addEventListener("DOMContentLoaded", function() {
//    const sliders = document.querySelectorAll('.slider');
//
//    sliders.forEach(slider => {
//        slider.addEventListener('input', function() {
//            syncAllSliders(slider.value);
//        });
//    });
//
//    function syncAllSliders(value) {
//        sliders.forEach(slider => {
//            slider.value = value;
//            syncScroll(slider);
//        });
//    }
//
//    function syncScroll(slider) {
//        const container = slider.previousElementSibling;
//        const rowContainers = Array.from(container.parentElement.parentElement.children);
//
//        const sliderIndex = Array.from(slider.parentElement.children).indexOf(slider);
//        const isFirstSliderInRow = (sliderIndex % 2 === 0);
//
//        const rowIndex = rowContainers.indexOf(container.parentElement);
//        const chartsInRow = rowContainers
//            .slice(rowIndex, rowIndex + 2)
//            .flatMap(rowContainer => Array.from(rowContainer.querySelectorAll('.chart')));
//
//        const scrollAmount = (chartsInRow[0].scrollWidth - chartsInRow[0].clientWidth) * (slider.value / 100);
//
//        chartsInRow.forEach(chart => chart.scrollLeft = scrollAmount);
//    }
//});

document.addEventListener("DOMContentLoaded", function() {
    const data = window.ecgData;
    const names = window.ecgNames;

    const zoomFactor = 500;
    let offset = 0;

    function drawECG(canvasId, ecgData, offset) {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();

        const visibleData = ecgData.slice(offset, offset + zoomFactor)

        const scaleX = canvas.width / ecgData.length;
        const scaleY = canvas.height / 2;

        for (let i = 0; i < ecgData.length; i++) {
            const x = i * scaleX;
            const y = scaleY - visibleData[i];
            ctx.lineTo(x, y);
        }

        ctx.stroke();
    }

    function updateCharts(offset) {
        names.forEach((name, index) => {
            drawECG(`chart_${name}`, data[index], offset);
        });
    }

    document.getElementById("scroll").addEventListener("input", function() {
        offset = parseInt(this.value);
        updateCharts(offset);
    })

    updateCharts(offset);
});