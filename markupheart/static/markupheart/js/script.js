document.addEventListener("DOMContentLoaded", function() {
    const sliders = document.querySelectorAll('.slider');

    sliders.forEach(slider => {
        slider.addEventListener('input', function() {
            syncAllSliders(slider.value);
        });
    });

    function syncAllSliders(value) {
        sliders.forEach(slider => {
            slider.value = value;
            syncScroll(slider);
        });
    }

    function syncScroll(slider) {
        const container = slider.previousElementSibling;
        const rowContainers = Array.from(container.parentElement.parentElement.children);

        const sliderIndex = Array.from(slider.parentElement.children).indexOf(slider);
        const isFirstSliderInRow = (sliderIndex % 2 === 0);

        const rowIndex = rowContainers.indexOf(container.parentElement);
        const chartsInRow = rowContainers
            .slice(rowIndex, rowIndex + 2)
            .flatMap(rowContainer => Array.from(rowContainer.querySelectorAll('.chart')));

        const scrollAmount = (chartsInRow[0].scrollWidth - chartsInRow[0].clientWidth) * (slider.value / 100);

        chartsInRow.forEach(chart => chart.scrollLeft = scrollAmount);
    }
});