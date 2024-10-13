document.addEventListener("DOMContentLoaded", function() {
    const data = window.ecgData;
    const names = window.ecgNames;

    const zoomFactor = 500;
    const maxOffset = data[0].length - zoomFactor;
    let offset = 0;

    document.getElementById("scroll").setAttribute("max", maxOffset);

    function drawECG(canvasId, ecgData, offset) {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();

        const visibleData = ecgData.slice(offset, offset + zoomFactor)

        const minValue = Math.min(...visibleData);
        const maxValue = Math.max(...visibleData);

        const scaleX = canvas.width / (visibleData.length - 1);
        const scaleY = canvas.height / (maxValue - minValue);

        for (let i = 0; i < ecgData.length; i++) {
            const x = i * scaleX;
            const y = canvas.height - (visibleData[i] - minValue) * scaleY;
            ctx.lineTo(x, y);
        }

        ctx.stroke();
    }

    function updateCharts(offset) {
        for (let i = 0; i < 6; i++) {
            for (let j of [0, 6]) {
                drawECG(`chart_${names[i+j]}`, data[i + j], offset);
            }
        }
    }

    document.getElementById("scroll").addEventListener("input", function() {
        offset = parseInt(this.value);
        updateCharts(offset);
    })

    updateCharts(offset);
});