// Shared behaviour for every page: phone menu, light/dark switch,
// nav highlighting, fade-in on scroll and the footer year.
(function () {
    const root = document.documentElement;

    // ---------- Phone menu ----------
    const menuBtn = document.querySelector('.menu-toggle');
    const links = document.querySelector('.nav-links');

    function setMenu(open) {
        menuBtn.setAttribute('aria-expanded', open);
        menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        links.classList.toggle('is-open', open);
    }

    if (menuBtn && links) {
        menuBtn.addEventListener('click', function () {
            setMenu(menuBtn.getAttribute('aria-expanded') !== 'true');
        });
        // Close after picking a link or pressing Escape
        links.addEventListener('click', function (e) {
            if (e.target.closest('a')) setMenu(false);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') setMenu(false);
        });
    }

    // ---------- Light / dark switch ----------
    const themeBtn = document.querySelector('.theme-toggle');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

    function isDark() {
        return root.dataset.theme ? root.dataset.theme === 'dark' : prefersDark.matches;
    }

    function updateThemeLabel() {
        themeBtn.setAttribute('aria-label', isDark() ? 'Switch to light mode' : 'Switch to dark mode');
    }

    if (themeBtn) {
        // Fade colours for a moment while the theme changes
        const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        let fadeTimer;
        function fadeThemeChange() {
            if (reduceMotionQuery.matches) return;
            root.classList.add('theme-fading');
            clearTimeout(fadeTimer);
            fadeTimer = setTimeout(function () { root.classList.remove('theme-fading'); }, 1700);
        }

        function setTheme(next) {
            root.dataset.theme = next;
            try { localStorage.setItem('theme', next); } catch (e) {}
            updateThemeLabel();
        }

        themeBtn.addEventListener('click', function () {
            const next = isDark() ? 'light' : 'dark';
            if (reduceMotionQuery.matches) {
                setTheme(next);
            } else if (document.startViewTransition) {
                // Cross-fades the whole page, gradients and images included
                document.startViewTransition(function () { setTheme(next); });
            } else {
                // Older browsers: fade the colours instead
                fadeThemeChange();
                setTheme(next);
            }
        });
        prefersDark.addEventListener('change', function () { fadeThemeChange(); updateThemeLabel(); });
        updateThemeLabel();
    }

    // ---------- Highlight the nav link for the section on screen ----------
    const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
    if (navLinks.length && 'IntersectionObserver' in window) {
        const byId = {};
        navLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });

        const spy = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                const link = byId[entry.target.id];
                if (!link || !entry.isIntersecting) return;
                navLinks.forEach(function (a) { a.removeAttribute('aria-current'); });
                link.setAttribute('aria-current', 'true');
            });
        }, { rootMargin: '-45% 0px -50% 0px' });

        Object.keys(byId).forEach(function (id) {
            const section = document.getElementById(id);
            if (section) spy.observe(section);
        });
    }

    // ---------- Fade cards in as they scroll into view ----------
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealItems = document.querySelectorAll('.section-head, .job, .skill-group, .cert, .project, .about, .facts li, .reflection');

    if (!reduceMotion && 'IntersectionObserver' in window) {
        const reveal = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                reveal.unobserve(entry.target);
            });
        }, { rootMargin: '0px 0px -8% 0px' });

        revealItems.forEach(function (el) {
            // Stagger cards that sit side by side in a grid
            const siblings = Array.prototype.indexOf.call(el.parentElement.children, el);
            el.style.setProperty('--delay', (siblings % 4) * 70 + 'ms');
            el.classList.add('reveal');
            reveal.observe(el);
        });
    }

    // ---------- Footer year ----------
    const year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();
})();
