// Packet Muncher: a small maze-chase arcade game for the site.
// Eat every data packet, dodge the bugs, and grab a shield to turn the
// tables. Tile-based movement, four bugs with their own chase styles,
// keyboard, swipe and on-screen controls.
(function () {
    'use strict';

    const canvas = document.getElementById('game');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // # wall   . packet   o shield   - bug-house door   (space) empty
    const MAP = [
        '###################',
        '#........#........#',
        '#o##.###.#.###.##o#',
        '#.................#',
        '#.##.#.#####.#.##.#',
        '#....#...#...#....#',
        '####.###.#.###.####',
        '   #.#       #.#   ',
        '####.# ##-## #.####',
        '    .  #   #  .    ',
        '####.# ##### #.####',
        '   #.#       #.#   ',
        '####.# ##### #.####',
        '#........#........#',
        '#.##.###.#.###.##.#',
        '#o.#...........#.o#',
        '##.#.#.#####.#.#.##',
        '#....#...#...#....#',
        '#.######.#.######.#',
        '#.................#',
        '###################'
    ];

    const COLS = MAP[0].length;
    const ROWS = MAP.length;
    const T = 20; // tile size in canvas pixels
    const TUNNEL_ROW = 9;

    const UP = { x: 0, y: -1 }, DOWN = { x: 0, y: 1 }, LEFT = { x: -1, y: 0 }, RIGHT = { x: 1, y: 0 };
    const DIR_ORDER = [UP, LEFT, DOWN, RIGHT]; // tie-break order when bugs choose a turn

    const PLAYER_START = { x: 9, y: 15 };
    const EXIT = { x: 9, y: 7 };   // just outside the bug-house door
    const HOUSE = { x: 9, y: 9 };  // middle of the bug house

    const BUGS = [
        { name: 'red',    color: '#f43f5e', start: { x: 9, y: 7 },  release: 0, corner: { x: 18, y: -2 } },
        { name: 'pink',   color: '#f472b6', start: { x: 9, y: 9 },  release: 1, corner: { x: 0, y: -2 } },
        { name: 'cyan',   color: '#22d3ee', start: { x: 8, y: 9 },  release: 4, corner: { x: 18, y: 22 } },
        { name: 'orange', color: '#fb923c', start: { x: 10, y: 9 }, release: 7, corner: { x: 0, y: 22 } }
    ];

    // Scatter / chase rhythm in seconds (bugs head to corners, then hunt)
    const MODE_TIMES = [7, 20, 7, 20, 5, Infinity];

    // ---------- DOM ----------

    const $ = function (id) { return document.getElementById(id); };
    const overlay = $('g-overlay');
    const titleEl = $('g-title');
    const msgEl = $('g-msg');
    const startBtn = $('g-start');
    const arcade = $('arcade');

    // Crisp drawing on high-DPI screens
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = COLS * T * dpr;
    canvas.height = ROWS * T * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ---------- Game state ----------

    let state = 'ready';   // ready | playing | paused | dying | cleared | over
    let score = 0, lives = 3, level = 1;
    let best = 0;
    try { best = Number(localStorage.getItem('packet-muncher-best')) || 0; } catch (e) {}

    let dots, dotsLeft;
    let player, bugs;
    let clock = 0;          // seconds of play since this life or level began
    let modeIndex = 0, modeTimer = 0;
    let frightUntil = 0, combo = 200;
    let pauseTimer = 0;     // used for the short pauses after dying / clearing
    let popups = [];        // floating score numbers

    function tileAt(x, y) {
        if (y < 0 || y >= ROWS) return '#';
        if (x < 0 || x >= COLS) return y === TUNNEL_ROW ? ' ' : '#';
        return MAP[y][x];
    }

    function isOpen(x, y, canUseDoor) {
        const c = tileAt(x, y);
        if (c === '#') return false;
        if (c === '-') return !!canUseDoor;
        return true;
    }

    function wrapX(x) {
        return (x + COLS) % COLS;
    }

    function resetDots() {
        dots = MAP.map(function (row) {
            return row.split('').map(function (c) { return c === '.' ? 1 : c === 'o' ? 2 : 0; });
        });
        dotsLeft = dots.reduce(function (n, row) {
            return n + row.filter(Boolean).length;
        }, 0);
    }

    function makeMover(tile, dir) {
        return { from: { x: tile.x, y: tile.y }, to: { x: tile.x, y: tile.y }, p: 1, dir: dir, moving: false };
    }

    function position(e) {
        return {
            x: e.from.x + (e.to.x - e.from.x) * e.p,
            y: e.from.y + (e.to.y - e.from.y) * e.p
        };
    }

    function resetActors() {
        player = makeMover(PLAYER_START, LEFT);
        player.next = LEFT;
        player.facing = LEFT;

        bugs = BUGS.map(function (b, i) {
            const bug = makeMover(b.start, LEFT);
            bug.info = b;
            bug.state = i === 0 ? 'active' : 'house';
            bug.frightened = false;
            bug.bob = Math.random() * Math.PI * 2;
            return bug;
        });

        clock = 0;
        modeIndex = 0;
        modeTimer = 0;
        frightUntil = 0;
        popups = [];
    }

    // ---------- Speeds (tiles per second) ----------

    function playerSpeed() {
        return Math.min(7.5 * (1 + (level - 1) * 0.05), 9.5);
    }

    function bugSpeed(bug) {
        const base = Math.min(6.9 * (1 + (level - 1) * 0.06), 9.2);
        if (bug.state === 'eyes') return 15;
        if (bug.state === 'leaving') return base * 0.55;
        if (bug.frightened) return base * 0.6;
        const p = position(bug);
        if (Math.round(p.y) === TUNNEL_ROW && (p.x < 4 || p.x > 14)) return base * 0.5;
        return base;
    }

    // ---------- Movement ----------

    // Moves an actor along the grid. At each tile centre `choose` picks
    // the next direction (or null to stop) and `arrive` runs.
    function advance(e, dist, choose, arrive) {
        let guard = 0;
        while (dist > 0 && guard++ < 10) {
            if (e.p >= 1) {
                e.from = { x: wrapX(e.to.x), y: e.to.y };
                e.to = { x: e.from.x, y: e.from.y };
                if (arrive) arrive(e);
                const d = choose(e);
                if (!d) {
                    e.p = 1;
                    e.moving = false;
                    return;
                }
                e.dir = d;
                e.moving = true;
                e.to = { x: e.from.x + d.x, y: e.from.y + d.y };
                e.p = 0;
            }
            const remaining = 1 - e.p;
            if (dist >= remaining) {
                e.p = 1;
                dist -= remaining;
            } else {
                e.p += dist;
                dist = 0;
            }
        }
    }

    function reverse(e) {
        if (!e.moving) return;
        const from = e.from;
        e.from = e.to;
        e.to = from;
        e.p = 1 - e.p;
        e.dir = { x: -e.dir.x, y: -e.dir.y };
    }

    function same(a, b) {
        return a && b && a.x === b.x && a.y === b.y;
    }

    function opposite(a, b) {
        return a && b && a.x === -b.x && a.y === -b.y;
    }

    // ---------- Player ----------

    function choosePlayer(e) {
        const f = e.from;
        if (e.next && isOpen(f.x + e.next.x, f.y + e.next.y)) return e.next;
        if (e.dir && isOpen(f.x + e.dir.x, f.y + e.dir.y)) return e.dir;
        return null;
    }

    function eatAt(e) {
        const x = e.from.x, y = e.from.y;
        const d = dots[y] && dots[y][x];
        if (!d) return;
        dots[y][x] = 0;
        dotsLeft--;
        if (d === 1) {
            score += 10;
        } else {
            score += 50;
            frighten();
        }
        if (dotsLeft === 0) {
            state = 'cleared';
            pauseTimer = 1.6;
        }
    }

    function frighten() {
        const duration = Math.max(7 - (level - 1) * 0.75, 2.5);
        frightUntil = clock + duration;
        combo = 200;
        bugs.forEach(function (b) {
            if (b.state === 'active' || b.state === 'leaving') {
                if (!b.frightened && b.state === 'active') reverse(b);
                b.frightened = true;
            }
        });
    }

    // ---------- Bugs ----------

    function playerTile() {
        const p = position(player);
        return { x: Math.round(p.x), y: Math.round(p.y) };
    }

    function chaseTarget(bug) {
        const pt = playerTile();
        const pd = player.dir || LEFT;
        const scatter = MODE_TIMES[modeIndex] !== Infinity && modeIndex % 2 === 0;
        if (scatter) return bug.info.corner;

        switch (bug.info.name) {
            case 'red':
                // Straight for you
                return pt;
            case 'pink':
                // Tries to cut you off 4 tiles ahead
                return { x: pt.x + pd.x * 4, y: pt.y + pd.y * 4 };
            case 'cyan': {
                // Works with red to box you in
                const red = position(bugs[0]);
                const ahead = { x: pt.x + pd.x * 2, y: pt.y + pd.y * 2 };
                return { x: ahead.x * 2 - Math.round(red.x), y: ahead.y * 2 - Math.round(red.y) };
            }
            default: {
                // Orange gets shy when close
                const p = position(bug);
                const far = Math.hypot(p.x - pt.x, p.y - pt.y) > 8;
                return far ? pt : bug.info.corner;
            }
        }
    }

    function chooseBug(bug) {
        const f = bug.from;

        if (bug.state === 'house') return null;

        if (bug.state === 'leaving') {
            if (f.x !== EXIT.x) return f.x < EXIT.x ? RIGHT : LEFT;
            if (f.y > EXIT.y) return UP;
            bug.state = 'active';
            bug.dir = RIGHT; // so the first choice can't be "reverse back in"
        }

        const useDoor = bug.state === 'eyes';
        let options = DIR_ORDER.filter(function (d) {
            return !opposite(d, bug.dir) && isOpen(f.x + d.x, f.y + d.y, useDoor);
        });
        if (!options.length) {
            options = DIR_ORDER.filter(function (d) { return isOpen(f.x + d.x, f.y + d.y, useDoor); });
        }
        if (!options.length) return null;

        if (bug.frightened && bug.state === 'active') {
            return options[Math.floor(Math.random() * options.length)];
        }

        const target = bug.state === 'eyes' ? EXIT : chaseTarget(bug);
        let bestDir = options[0], bestDist = Infinity;
        options.forEach(function (d) {
            const dist = Math.pow(f.x + d.x - target.x, 2) + Math.pow(f.y + d.y - target.y, 2);
            if (dist < bestDist) {
                bestDist = dist;
                bestDir = d;
            }
        });
        return bestDir;
    }

    function bugArrived(bug) {
        // Eyes made it home: respawn inside and head back out
        if (bug.state === 'eyes' && same(bug.from, EXIT)) {
            bug.from = { x: HOUSE.x, y: HOUSE.y };
            bug.to = { x: HOUSE.x, y: HOUSE.y };
            bug.state = 'leaving';
            bug.frightened = false;
            bug.dir = UP;
        }
    }

    // ---------- Update ----------

    function update(dt) {
        if (state === 'dying' || state === 'cleared') {
            pauseTimer -= dt;
            if (pauseTimer <= 0) {
                if (state === 'dying') {
                    if (lives <= 0) return gameOver();
                    resetActors();
                } else {
                    level++;
                    resetDots();
                    resetActors();
                }
                state = 'playing';
                updateHud();
            }
            return;
        }
        if (state !== 'playing') return;

        clock += dt;

        // Scatter / chase switching (paused while bugs are frightened)
        if (clock >= frightUntil) {
            modeTimer += dt;
            if (modeTimer >= MODE_TIMES[modeIndex]) {
                modeTimer = 0;
                modeIndex = Math.min(modeIndex + 1, MODE_TIMES.length - 1);
                bugs.forEach(function (b) { if (b.state === 'active') reverse(b); });
            }
        }

        // Shields wear off
        if (frightUntil && clock >= frightUntil) {
            frightUntil = 0;
            bugs.forEach(function (b) { b.frightened = false; });
        }

        // Release bugs from the house over time
        bugs.forEach(function (b) {
            if (b.state === 'house' && clock >= b.info.release) {
                b.state = 'leaving';
                b.dir = UP;
            }
        });

        // Player turns instantly when reversing, otherwise at the next junction
        if (player.next && opposite(player.next, player.dir)) {
            reverse(player);
        }
        advance(player, playerSpeed() * dt, choosePlayer, eatAt);
        if (player.dir) player.facing = player.dir;
        if (state !== 'playing') return;

        bugs.forEach(function (b) {
            advance(b, bugSpeed(b) * dt, chooseBug, bugArrived);
        });

        // Collisions
        const pp = position(player);
        for (let i = 0; i < bugs.length; i++) {
            const b = bugs[i];
            if (b.state === 'house' || b.state === 'eyes') continue;
            const bp = position(b);
            if (Math.hypot(bp.x - pp.x, bp.y - pp.y) > 0.65) continue;

            if (b.frightened) {
                b.state = 'eyes';
                b.frightened = false;
                score += combo;
                popups.push({ x: bp.x, y: bp.y, text: String(combo), t: 1 });
                combo *= 2;
            } else {
                lives--;
                state = 'dying';
                pauseTimer = 1.4;
                updateHud();
                return;
            }
        }

        popups.forEach(function (p) { p.t -= dt; });
        popups = popups.filter(function (p) { return p.t > 0; });

        updateHud();
    }

    // ---------- Drawing ----------

    const COLORS = {
        bg: '#070d26',
        wallFill: '#0f1d52',
        wallEdge: '#3cc1c4',
        door: '#f472b6',
        packet: '#c9d8e2',
        shield: '#66bfbf',
        player: '#facc15',
        scared: '#2563eb'
    };

    function isWall(x, y) {
        return tileAt(x, y) === '#';
    }

    // Pre-render the maze once; it never changes
    const mazeCanvas = document.createElement('canvas');
    mazeCanvas.width = canvas.width;
    mazeCanvas.height = canvas.height;
    (function drawMaze() {
        const m = mazeCanvas.getContext('2d');
        m.setTransform(dpr, 0, 0, dpr, 0, 0);
        m.fillStyle = COLORS.bg;
        m.fillRect(0, 0, COLS * T, ROWS * T);

        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const c = MAP[y][x];
                if (c === '-') {
                    m.fillStyle = COLORS.door;
                    m.fillRect(x * T, y * T + T / 2 - 2, T, 4);
                }
                if (c !== '#') continue;

                m.fillStyle = COLORS.wallFill;
                m.fillRect(x * T, y * T, T, T);

                // Glowing edge wherever a wall meets the playfield
                m.strokeStyle = COLORS.wallEdge;
                m.lineWidth = 2;
                m.lineCap = 'round';
                m.beginPath();
                const inset = 1;
                const L = x * T + inset, R = (x + 1) * T - inset, Tp = y * T + inset, B = (y + 1) * T - inset;
                if (y > 0 && !isWall(x, y - 1)) { m.moveTo(L, Tp); m.lineTo(R, Tp); }
                if (y < ROWS - 1 && !isWall(x, y + 1)) { m.moveTo(L, B); m.lineTo(R, B); }
                if (x > 0 && !isWall(x - 1, y)) { m.moveTo(L, Tp); m.lineTo(L, B); }
                if (x < COLS - 1 && !isWall(x + 1, y)) { m.moveTo(R, Tp); m.lineTo(R, B); }
                m.stroke();
            }
        }
    })();

    function drawDots(now) {
        const pulse = 0.75 + Math.sin(now * 6) * 0.25;
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const d = dots[y][x];
                if (!d) continue;
                const cx = x * T + T / 2, cy = y * T + T / 2;
                if (d === 1) {
                    // A tiny data packet
                    ctx.fillStyle = COLORS.packet;
                    ctx.fillRect(cx - 2, cy - 2, 4, 4);
                } else {
                    // Shield: a pulsing ring
                    ctx.save();
                    ctx.shadowColor = COLORS.shield;
                    ctx.shadowBlur = 10;
                    ctx.fillStyle = COLORS.shield;
                    ctx.globalAlpha = pulse;
                    ctx.beginPath();
                    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }
        }
    }

    function drawPlayer(now) {
        const p = position(player);
        const cx = p.x * T + T / 2, cy = p.y * T + T / 2;
        let mouth = player.moving ? Math.abs(Math.sin(now * 14)) * 0.28 * Math.PI : 0.12 * Math.PI;

        if (state === 'dying') {
            // Shrink away
            const k = 1 - Math.max(pauseTimer - 0.4, 0) / 1.0;
            mouth = Math.min(k, 1) * Math.PI;
        }

        const f = player.facing || LEFT;
        const angle = Math.atan2(f.y, f.x);

        ctx.fillStyle = COLORS.player;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, T * 0.45, angle + mouth, angle + Math.PI * 2 - mouth);
        ctx.closePath();
        ctx.fill();
    }

    function drawBug(bug, now) {
        const p = position(bug);
        let cx = p.x * T + T / 2, cy = p.y * T + T / 2;
        if (bug.state === 'house') cy += Math.sin(now * 5 + bug.bob) * 2;

        const r = T * 0.45;
        const look = bug.dir || LEFT;

        if (bug.state !== 'eyes') {
            const timeLeft = frightUntil - clock;
            let color = bug.info.color;
            if (bug.frightened) {
                color = timeLeft < 2 && Math.floor(now * 6) % 2 ? '#e5eef0' : COLORS.scared;
            }

            ctx.fillStyle = color;
            ctx.strokeStyle = color;

            // Antennae: they're bugs, after all
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cx - 3, cy - r + 2);
            ctx.lineTo(cx - 6, cy - r - 3);
            ctx.moveTo(cx + 3, cy - r + 2);
            ctx.lineTo(cx + 6, cy - r - 3);
            ctx.stroke();

            // Body with a wavy hem
            ctx.beginPath();
            ctx.arc(cx, cy - 1, r, Math.PI, 0);
            const bottom = cy + r;
            ctx.lineTo(cx + r, bottom);
            const waves = 3, w = (r * 2) / waves;
            const shift = Math.floor(now * 8) % 2 ? 0 : 2;
            for (let i = 0; i < waves; i++) {
                const x1 = cx + r - i * w;
                ctx.lineTo(x1 - w / 2, bottom - 3 - shift + (i % 2) * 2);
                ctx.lineTo(x1 - w, bottom);
            }
            ctx.closePath();
            ctx.fill();

            if (bug.frightened) {
                // Worried face
                ctx.fillStyle = '#fff';
                ctx.fillRect(cx - 4, cy - 3, 2.5, 2.5);
                ctx.fillRect(cx + 1.5, cy - 3, 2.5, 2.5);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(cx - 5, cy + 4);
                ctx.lineTo(cx - 2.5, cy + 2.5);
                ctx.lineTo(cx, cy + 4);
                ctx.lineTo(cx + 2.5, cy + 2.5);
                ctx.lineTo(cx + 5, cy + 4);
                ctx.stroke();
                return;
            }
        }

        // Eyes, looking where the bug is heading
        [-3.5, 3.5].forEach(function (ox) {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.ellipse(cx + ox, cy - 2, 3, 3.6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#1e3a8a';
            ctx.beginPath();
            ctx.arc(cx + ox + look.x * 1.4, cy - 2 + look.y * 1.6, 1.6, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function drawPopups() {
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        popups.forEach(function (p) {
            ctx.globalAlpha = Math.min(p.t * 2, 1);
            ctx.fillStyle = '#66bfbf';
            ctx.fillText(p.text, p.x * T + T / 2, p.y * T + T / 2 - (1 - p.t) * 10);
        });
        ctx.globalAlpha = 1;
    }

    function draw(now) {
        ctx.clearRect(0, 0, COLS * T, ROWS * T);
        ctx.drawImage(mazeCanvas, 0, 0, COLS * T, ROWS * T);
        drawDots(now);

        // Stop drawing actors while the level-cleared flash plays
        if (state === 'cleared' && Math.floor(now * 4) % 2) return;

        if (state !== 'dying' || pauseTimer > 0.4) {
            bugs.forEach(function (b) {
                if (state === 'dying' && pauseTimer < 1.0) return; // bugs vanish as you pop
                drawBug(b, now);
            });
        }
        if (state !== 'dying' || pauseTimer > 0.2) drawPlayer(now);
        drawPopups();
    }

    // ---------- HUD and overlay ----------

    function updateHud() {
        $('g-score').textContent = score;
        if (score > best) {
            best = score;
            try { localStorage.setItem('packet-muncher-best', best); } catch (e) {}
        }
        $('g-best').textContent = best;
        $('g-level').textContent = level;
        const livesEl = $('g-lives');
        livesEl.textContent = '●'.repeat(Math.max(lives, 0)) || '–';
        livesEl.setAttribute('aria-label', lives + (lives === 1 ? ' life' : ' lives'));
    }

    function showOverlay(title, msg, button) {
        titleEl.textContent = title;
        msgEl.textContent = msg;
        startBtn.textContent = button;
        overlay.hidden = false;
    }

    function start() {
        if (state === 'paused') {
            state = 'playing';
            overlay.hidden = true;
            return;
        }
        score = 0;
        lives = 3;
        level = 1;
        resetDots();
        resetActors();
        state = 'playing';
        overlay.hidden = true;
        updateHud();
        canvas.focus({ preventScroll: true });
    }

    function pause() {
        if (state !== 'playing') return;
        state = 'paused';
        showOverlay('Paused', 'Take your time. The bugs will wait.', 'Resume');
    }

    function gameOver() {
        state = 'over';
        updateHud();
        const isBest = score > 0 && score >= best;
        showOverlay(
            'Game over',
            isBest ? 'New high score: ' + score + '! Nice work.' : 'You scored ' + score + '. Best: ' + best + '.',
            'Play again'
        );
    }

    startBtn.addEventListener('click', start);

    // ---------- Controls ----------

    const KEYS = {
        ArrowUp: UP, ArrowDown: DOWN, ArrowLeft: LEFT, ArrowRight: RIGHT,
        w: UP, s: DOWN, a: LEFT, d: RIGHT, W: UP, S: DOWN, A: LEFT, D: RIGHT
    };

    function steer(dir) {
        if (!player) return;
        player.next = dir;
    }

    document.addEventListener('keydown', function (e) {
        const inGame = arcade.contains(document.activeElement);
        if (KEYS[e.key] && (state === 'playing' || inGame)) {
            // Stop the arrow keys scrolling the page mid-game
            e.preventDefault();
            if (state === 'playing') steer(KEYS[e.key]);
        } else if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && state === 'playing') {
            e.preventDefault();
            pause();
        } else if ((e.key === ' ' || e.key === 'Enter') && inGame && document.activeElement === canvas && state !== 'playing') {
            e.preventDefault();
            start();
        }
    });

    // Swipe on the board
    let touchStart = null;
    canvas.addEventListener('touchstart', function (e) {
        const t = e.touches[0];
        touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });

    canvas.addEventListener('touchmove', function (e) {
        if (!touchStart) return;
        const t = e.touches[0];
        const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
        steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : (dy > 0 ? DOWN : UP));
        touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });

    canvas.addEventListener('touchend', function () { touchStart = null; });

    // On-screen pad
    document.querySelectorAll('.dpad button').forEach(function (btn) {
        btn.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            steer({ up: UP, down: DOWN, left: LEFT, right: RIGHT }[btn.dataset.dir]);
        });
    });

    // Pause when the game scrolls out of view or the tab is hidden
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) pause();
    });
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            if (!entries[0].isIntersecting) pause();
        }, { threshold: 0.25 }).observe(canvas);
    }

    // ---------- Loop ----------

    let last = performance.now();
    function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        update(dt);
        draw(now / 1000);
        requestAnimationFrame(frame);
    }

    resetDots();
    resetActors();
    updateHud();
    requestAnimationFrame(frame);
})();
