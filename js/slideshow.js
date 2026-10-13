// Simple, accessible slideshow for the project page.
// Works with the buttons, the dots, and the left/right arrow keys.
(function () {
    const show = document.querySelector('.slideshow');
    if (!show) return;

    const slides = show.querySelectorAll('.slide');
    const dots = show.querySelectorAll('.slide-dots button');
    let current = 0;

    function goTo(index) {
        // Wrap around at either end
        current = (index + slides.length) % slides.length;

        slides.forEach(function (slide, i) {
            slide.hidden = i !== current;
        });
        dots.forEach(function (dot, i) {
            dot.setAttribute('aria-current', i === current ? 'true' : 'false');
        });
    }

    show.querySelector('.slide-btn--prev').addEventListener('click', function () {
        goTo(current - 1);
    });
    show.querySelector('.slide-btn--next').addEventListener('click', function () {
        goTo(current + 1);
    });
    dots.forEach(function (dot, i) {
        dot.addEventListener('click', function () {
            goTo(i);
        });
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') goTo(current - 1);
        if (e.key === 'ArrowRight') goTo(current + 1);
    });

    goTo(0);
})();
