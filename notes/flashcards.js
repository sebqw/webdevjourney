// Flashcards for the notes section.
// Reads cards from ms102-cards.js. Progress is saved in this browser only.
(function () {
    'use strict';

    const CARDS = window.MS102_CARDS || [];
    const TOPICS = window.MS102_TOPICS || [];
    const STORE_KEY = 'notes.ms102.progress';

    const $ = function (sel) { return document.querySelector(sel); };

    // ---------- Saved progress: { cardId: 'known' | 'learning' } ----------

    function loadProgress() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORE_KEY));
            if (saved && typeof saved === 'object') return saved;
        } catch (e) {}
        return {};
    }

    let progress = loadProgress();

    function saveProgress() {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) {}
    }

    // ---------- Safe text formatting ----------
    // Text is escaped first, then `code` and new lines are turned into markup,
    // so nothing in the cards file can inject HTML.

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function format(text) {
        return String(text || '').split('\n').filter(function (line) {
            return line.trim() !== '';
        }).map(function (line) {
            const html = escapeHtml(line).replace(/`([^`]+)`/g, '<code>$1</code>');
            return '<p>' + html + '</p>';
        }).join('');
    }

    function labHtml(card) {
        if (!card.lab || !card.lab.trim()) return '';
        return '<div class="lab"><span class="lab-label">From my dev tenant</span>' + format(card.lab) + '</div>';
    }

    function statusPill(id) {
        const s = progress[id];
        if (s === 'known') return '<span class="status-pill status-pill--known">Got it</span>';
        if (s === 'learning') return '<span class="status-pill status-pill--learning">Still learning</span>';
        return '';
    }

    // ---------- View state ----------

    const view = {
        topic: 'all',
        onlyLearning: false,
        order: CARDS.map(function (_, i) { return i; }),
        index: 0,
        mode: 'cards'
    };

    function deck() {
        return view.order.map(function (i) { return CARDS[i]; }).filter(function (c) {
            if (view.topic !== 'all' && c.topic !== view.topic) return false;
            if (view.onlyLearning && progress[c.id] === 'known') return false;
            return true;
        });
    }

    // ---------- Progress summary ----------

    function renderProgress() {
        const known = CARDS.filter(function (c) { return progress[c.id] === 'known'; }).length;
        const learning = CARDS.filter(function (c) { return progress[c.id] === 'learning'; }).length;
        $('#p-total').textContent = CARDS.length;
        $('#p-known').textContent = known;
        $('#p-learning').textContent = learning;
        const pct = CARDS.length ? Math.round(known / CARDS.length * 100) : 0;
        $('#p-bar').style.width = pct + '%';
        $('#p-bar-wrap').setAttribute('aria-valuenow', pct);
        $('#p-bar-wrap').setAttribute('aria-valuetext', known + ' of ' + CARDS.length + ' cards marked got it');
    }

    // ---------- Topic buttons ----------

    function renderTopics() {
        const list = $('#topics');
        list.replaceChildren();
        ['all'].concat(TOPICS).forEach(function (t) {
            const n = t === 'all' ? CARDS.length : CARDS.filter(function (c) { return c.topic === t; }).length;
            if (!n) return;
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.topic = t;
            btn.setAttribute('aria-pressed', String(view.topic === t));
            btn.textContent = t === 'all' ? 'All topics' : t;
            const count = document.createElement('span');
            count.className = 'count';
            count.textContent = n;
            btn.append(count);
            li.append(btn);
            list.append(li);
        });
    }

    $('#topics').addEventListener('click', function (e) {
        const btn = e.target.closest('button');
        if (!btn) return;
        view.topic = btn.dataset.topic;
        view.index = 0;
        renderTopics();
        render();
    });

    // ---------- Card view ----------

    const flashcard = $('#flashcard');

    function setFlipped(flipped) {
        flashcard.setAttribute('aria-pressed', String(flipped));
        flashcard.setAttribute('aria-label', flipped ? 'Show question' : 'Show answer');
        $('#face-front').setAttribute('aria-hidden', String(flipped));
        $('#face-back').setAttribute('aria-hidden', String(!flipped));
        $('#rate-learning').disabled = !flipped;
        $('#rate-known').disabled = !flipped;
    }

    function renderCard() {
        const cards = deck();
        const hasCards = cards.length > 0;
        $('#stage').hidden = !hasCards;
        $('#cards-empty').hidden = hasCards;
        if (!hasCards) return;

        if (view.index >= cards.length) view.index = cards.length - 1;
        if (view.index < 0) view.index = 0;
        const card = cards[view.index];

        $('#front-topic').textContent = card.topic;
        $('#back-topic').textContent = card.topic;
        $('#front-status').innerHTML = statusPill(card.id);
        $('#back-status').innerHTML = statusPill(card.id);
        $('#front-q').textContent = card.q;
        $('#back-q').textContent = card.q;
        $('#back-a').innerHTML = format(card.a) + labHtml(card);
        $('#position').textContent = (view.index + 1) + ' / ' + cards.length;
        setFlipped(false);
    }

    flashcard.addEventListener('click', function () {
        setFlipped(flashcard.getAttribute('aria-pressed') !== 'true');
    });

    function move(step) {
        const cards = deck();
        if (!cards.length) return;
        view.index = (view.index + step + cards.length) % cards.length;
        renderCard();
    }

    $('#prev').addEventListener('click', function () { move(-1); });
    $('#next').addEventListener('click', function () { move(1); });

    function rate(status) {
        const cards = deck();
        const card = cards[view.index];
        if (!card || flashcard.getAttribute('aria-pressed') !== 'true') return;
        progress[card.id] = status;
        saveProgress();
        renderProgress();
        $('#announce').textContent = status === 'known' ? 'Marked as got it.' : 'Marked as still learning.';
        // When hiding known cards, the current card drops out of the deck, so
        // the next card slides into the same position.
        if (!(view.onlyLearning && status === 'known')) view.index += 1;
        if (view.index >= deck().length) view.index = 0;
        renderCard();
    }

    $('#rate-learning').addEventListener('click', function () { rate('learning'); });
    $('#rate-known').addEventListener('click', function () { rate('known'); });

    // ---------- Study sheet ----------

    function renderSheet() {
        const query = $('#sheet-q').value.trim().toLowerCase();
        const cards = deck().filter(function (c) {
            if (!query) return true;
            return (c.q + ' ' + c.a + ' ' + (c.lab || '')).toLowerCase().includes(query);
        });

        const wrap = $('#sheet-list');
        wrap.replaceChildren();
        $('#sheet-count').textContent = cards.length + (cards.length === 1 ? ' card' : ' cards') +
            (query ? ' matching "' + $('#sheet-q').value.trim() + '"' : '');

        TOPICS.forEach(function (topic) {
            const group = cards.filter(function (c) { return c.topic === topic; });
            if (!group.length) return;
            const section = document.createElement('section');
            section.className = 'sheet-topic';
            const h2 = document.createElement('h2');
            h2.textContent = topic;
            const ul = document.createElement('ul');
            ul.className = 'sheet-list';
            group.forEach(function (c) {
                const li = document.createElement('li');
                li.className = 'sheet-item';
                li.innerHTML = '<div class="sheet-item-head"><h3>' + escapeHtml(c.q) + '</h3>' + statusPill(c.id) + '</div>' +
                    '<div class="answer">' + format(c.a) + labHtml(c) + '</div>';
                ul.append(li);
            });
            section.append(h2, ul);
            wrap.append(section);
        });

        $('#sheet-empty').hidden = cards.length > 0;
    }

    $('#sheet-q').addEventListener('input', renderSheet);

    // ---------- Modes and tools ----------

    function render() {
        const cardsMode = view.mode === 'cards';
        $('#card-view').hidden = !cardsMode;
        $('#sheet-view').hidden = cardsMode;
        $('#mode-cards').setAttribute('aria-pressed', String(cardsMode));
        $('#mode-sheet').setAttribute('aria-pressed', String(!cardsMode));
        $('#shuffle').hidden = !cardsMode;
        if (cardsMode) renderCard(); else renderSheet();
    }

    $('#mode-cards').addEventListener('click', function () { view.mode = 'cards'; render(); });
    $('#mode-sheet').addEventListener('click', function () { view.mode = 'sheet'; render(); });

    $('#shuffle').addEventListener('click', function () {
        const order = view.order.slice();
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = order[i]; order[i] = order[j]; order[j] = t;
        }
        view.order = order;
        view.index = 0;
        render();
        $('#announce').textContent = 'Cards shuffled.';
    });

    $('#only-learning').addEventListener('click', function () {
        view.onlyLearning = !view.onlyLearning;
        this.setAttribute('aria-pressed', String(view.onlyLearning));
        view.index = 0;
        render();
    });

    $('#reset').addEventListener('click', function () {
        if (!window.confirm('Clear your "Got it" and "Still learning" marks for every card?')) return;
        progress = {};
        saveProgress();
        renderProgress();
        render();
    });

    // ---------- Keyboard ----------

    document.addEventListener('keydown', function (e) {
        if (view.mode !== 'cards') return;
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
        else if (e.key === '1') rate('learning');
        else if (e.key === '2') rate('known');
        else if ((e.key === ' ' || e.key === 'Enter') && document.activeElement !== flashcard &&
                 !(document.activeElement && document.activeElement.closest('button, a'))) {
            e.preventDefault();
            flashcard.click();
        }
    });

    renderTopics();
    renderProgress();
    render();
})();
