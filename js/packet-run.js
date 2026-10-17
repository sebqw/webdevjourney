// Packet Run: a small maze-chase game for the site.
// You're a data packet in a network. Collect every bit, dodge the viruses,
// and grab a firewall to quarantine them for a few seconds.
// Arrow keys / WASD, swipe on the board, or the on-screen pad on phones.
(function () {
    'use strict';

    const canvas = document.getElementById('game');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // ---------- The network (maze) ----------
    // #  wall      .  data bit      o  firewall
    // -  gate (only viruses leaving quarantine can pass)
    // V  quarantine room              P  packet start
    const MAP = [
        '#####################',
        '#.........#.........#',
        '#.###.###.#.###.###.#',
        '#o###.###.#.###.###o#',
        '#...................#',
        '#.###.#.##-##.#.###.#',
        '#.....#.#VVV#.#.....#',
        '#.###.#.#####.#.###.#',
        '#...................#',
        '#o###.###.#.###.###o#',
        '#.###.###.#.###.###.#',
        '#.........P.........#',
        '#####################'
    ];
    const COLS = MAP[0].length, ROWS = MAP.length;
    const T = 30;                       // tile size in canvas pixels
    const W = COLS * T, H = ROWS * T;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const $ = function (id) { return document.getElementById(id); };
    const overlay = $('g-overlay');

    const DIRS = {
        up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
        left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
    };
    const NONE = { x: 0, y: 0 };

    const COLOURS = {
        bg: '#070d26',
        wall: '#0d2142',
        edge: '#3cc1c4',
        bit: '#66bfbf',
        firewall: '#facc15',
        packet: '#e8f6f6',
        packetAccent: '#11999e',
        quarantined: '#475569',
        viruses: ['#ef4444', '#f97316', '#a855f7']
    };

    // ---------- State ----------

    let state = 'ready';   // ready | playing | dying | cleared | paused | over
    let pausedFrom = null;
    let grid, bitsLeft;
    let packet, viruses;
    let score = 0, lives = 3, level = 1, best = 0;
    let firewallTimer = 0, combo = 0;
    let stateTimer = 0;
    let popups = [];
    let clock = 0;

    try { best = Number(localStorage.getItem('packet-run-best')) || 0; } catch (e) {}

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function cell(x, y) {
        if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return '#';
        return grid[y][x];
    }

    function findTile(ch) {
        for (let y = 0; y < ROWS; y++) {
            const x = MAP[y].indexOf(ch);
            if (x !== -1) return { x: x, y: y };
        }
        return null;
    }

    const START = findTile('P');
    const GATE = findTile('-');
    const ROOM = [];
    MAP.forEach(function (row, y) {
        for (let x = 0; x < COLS; x++) if (row[x] === 'V') ROOM.push({ x: x, y: y });
    });

    function resetMaze() {
        grid = MAP.map(function (row) { return row.split(''); });
        bitsLeft = 0;
        grid.forEach(function (row) {
            row.forEach(function (c) { if (c === '.' || c === 'o') bitsLeft++; });
        });
    }

    // Speeds in tiles per second; everything gets a little quicker each level
    function packetSpeed() { return 5.2 + (level - 1) * 0.25; }
    function virusSpeed(v) {
        if (v.quarantined) return 2.6;
        if (firewallTimer > 0) return 3 + (level - 1) * 0.1;
        return 4.2 + (level - 1) * 0.35;
    }

    function makeMover(tile) {
        return { x: tile.x, y: tile.y, tx: tile.x, ty: tile.y, t: 1, dir: NONE };
    }

    function resetActors() {
        packet = makeMover(START);
        packet.want = NONE;
        packet.facing = DIRS.left;
        viruses = COLOURS.viruses.map(function (colour, i) {
            const v = makeMover(ROOM[i % ROOM.length]);
            v.colour = colour;
            v.style = i;                 // 0 hunts you, 1 cuts you off, 2 roams
            v.inRoom = true;
            v.release = 1 + i * 2.5;     // seconds before leaving quarantine
            v.quarantined = false;
            v.spin = Math.random() * Math.PI;
            return v;
        });
        firewallTimer = 0;
        combo = 0;
    }

    function newGame() {
        score = 0;
        lives = 3;
        level = 1;
        resetMaze();
        resetActors();
        popups = [];
        updateHud();
        state = 'playing';
        hideOverlay();
        canvas.focus({ preventScroll: true });
    }

    // ---------- Movement ----------

    function passable(x, y, mover) {
        const c = cell(x, y);
        if (c === '#') return false;
        if (c === '-') return mover !== packet && mover.inRoom;   // only viruses leaving quarantine
        if (c === 'V') return mover !== packet;
        return true;
    }

    function isOpposite(a, b) { return a.x === -b.x && a.y === -b.y && (a.x || a.y); }

    // Movers travel tile to tile. `t` is progress from (x,y) to (tx,ty).
    function step(m, speed, dt, chooseNext) {
        let move = speed * dt;
        while (move > 0) {
            if (m.t >= 1) {
                m.x = m.tx; m.y = m.ty; m.t = 1;
                onArrive(m);
                const d = chooseNext(m);
                if (!d || (!d.x && !d.y)) { m.dir = NONE; return; }
                m.dir = d;
                m.tx = m.x + d.x; m.ty = m.y + d.y; m.t = 0;
            }
            const used = Math.min(move, 1 - m.t);
            m.t += used;
            move -= used;
        }
    }

    function pos(m) {
        return { x: m.x + (m.tx - m.x) * m.t, y: m.y + (m.ty - m.y) * m.t };
    }

    function onArrive(m) {
        if (m === packet) {
            const c = cell(m.x, m.y);
            if (c === '.') { grid[m.y][m.x] = ' '; bitsLeft--; addScore(10); }
            else if (c === 'o') { grid[m.y][m.x] = ' '; bitsLeft--; addScore(50); startFirewall(); }
        } else if (m.inRoom && cell(m.x, m.y) !== 'V' && cell(m.x, m.y) !== '-') {
            m.inRoom = false;   // out of quarantine and into the network
        }
    }

    function choosePacketDir(m) {
        if ((m.want.x || m.want.y) && passable(m.x + m.want.x, m.y + m.want.y, m)) {
            m.facing = m.want;
            return m.want;
        }
        if ((m.dir.x || m.dir.y) && passable(m.x + m.dir.x, m.y + m.dir.y, m)) return m.dir;
        return NONE;
    }

    function chooseVirusDir(v) {
        if (v.inRoom && v.release > 0) return NONE;
        const options = Object.keys(DIRS).map(function (k) { return DIRS[k]; }).filter(function (d) {
            return passable(v.x + d.x, v.y + d.y, v) && !isOpposite(d, v.dir);
        });
        if (!options.length) {
            const back = { x: -v.dir.x, y: -v.dir.y };
            return passable(v.x + back.x, v.y + back.y, v) ? back : NONE;
        }

        let target;
        const p = { x: packet.tx, y: packet.ty };
        if (v.inRoom) target = { x: GATE.x, y: GATE.y - 1 };
        else if (v.style === 0) target = p;
        else if (v.style === 1) target = { x: p.x + packet.facing.x * 3, y: p.y + packet.facing.y * 3 };
        else target = null;

        // A little randomness keeps them from moving like clockwork
        if (!target || (!v.inRoom && Math.random() < 0.12)) {
            return options[Math.floor(Math.random() * options.length)];
        }

        const fleeing = (v.quarantined || firewallTimer > 0) && !v.inRoom;
        let bestDir = options[0], bestScore = fleeing ? -Infinity : Infinity;
        options.forEach(function (d) {
            const dx = v.x + d.x - target.x, dy = v.y + d.y - target.y;
            const dist = dx * dx + dy * dy;
            if (fleeing ? dist > bestScore : dist < bestScore) { bestScore = dist; bestDir = d; }
        });
        return bestDir;
    }

    // ---------- Rules ----------

    function addScore(n, at) {
        score += n;
        if (score > best) {
            best = score;
            try { localStorage.setItem('packet-run-best', String(best)); } catch (e) {}
        }
        if (at) popups.push({ x: at.x, y: at.y, text: String(n), life: 1 });
        updateHud();
    }

    function startFirewall() {
        firewallTimer = Math.max(3, 7 - (level - 1) * 0.6);
        combo = 0;
        viruses.forEach(function (v) {
            if (!v.inRoom) {
                v.quarantined = true;
                // Turn around straight away so it's obvious they're running
                if (v.t < 1 && (v.dir.x || v.dir.y)) {
                    const fx = v.x, fy = v.y;
                    v.x = v.tx; v.y = v.ty; v.tx = fx; v.ty = fy; v.t = 1 - v.t;
                    v.dir = { x: -v.dir.x, y: -v.dir.y };
                }
            }
        });
    }

    function sendToQuarantine(v) {
        const home = ROOM[v.style % ROOM.length];
        v.x = v.tx = home.x; v.y = v.ty = home.y; v.t = 1; v.dir = NONE;
        v.inRoom = true;
        v.quarantined = false;
        v.release = 2.5;
    }

    function checkCollisions() {
        const p = pos(packet);
        for (const v of viruses) {
            const q = pos(v);
            if (Math.hypot(p.x - q.x, p.y - q.y) > 0.6) continue;
            if (v.quarantined) {
                combo++;
                addScore(100 * Math.pow(2, combo), { x: q.x, y: q.y });
                sendToQuarantine(v);
            } else if (!v.inRoom) {
                lives--;
                updateHud();
                state = 'dying';
                stateTimer = 1.4;
                return;
            }
        }
    }

    // ---------- Loop ----------

    function update(dt) {
        clock += dt;
        popups.forEach(function (pp) { pp.life -= dt; pp.y -= dt * 0.8; });
        popups = popups.filter(function (pp) { return pp.life > 0; });

        if (state === 'dying') {
            stateTimer -= dt;
            if (stateTimer <= 0) {
                if (lives <= 0) return gameOver();
                resetActors();
                state = 'playing';
            }
            return;
        }

        if (state === 'cleared') {
            stateTimer -= dt;
            if (stateTimer <= 0) {
                level++;
                resetMaze();
                resetActors();
                updateHud();
                state = 'playing';
            }
            return;
        }

        if (state !== 'playing') return;

        if (firewallTimer > 0) {
            firewallTimer -= dt;
            if (firewallTimer <= 0) {
                firewallTimer = 0;
                viruses.forEach(function (v) { v.quarantined = false; });
            }
        }

        // Turning round is instant, without waiting for the next junction
        if (isOpposite(packet.want, packet.dir) && packet.t < 1) {
            const fx = packet.x, fy = packet.y;
            packet.x = packet.tx; packet.y = packet.ty; packet.tx = fx; packet.ty = fy;
            packet.t = 1 - packet.t;
            packet.dir = packet.want;
            packet.facing = packet.want;
        }

        step(packet, packetSpeed(), dt, choosePacketDir);
        checkCollisions();
        if (state !== 'playing') return;

        viruses.forEach(function (v) {
            if (v.inRoom && v.release > 0) { v.release -= dt; return; }
            v.spin += dt * (v.quarantined ? 1 : 2.5);
            step(v, virusSpeed(v), dt, chooseVirusDir);
        });
        checkCollisions();

        if (state === 'playing' && bitsLeft <= 0) {
            addScore(500);
            state = 'cleared';
            stateTimer = 1.6;
        }
    }

    // ---------- Drawing ----------

    function drawMaze() {
        ctx.fillStyle = COLOURS.bg;
        ctx.fillRect(0, 0, W, H);

        // Walls with a glowing edge wherever they meet a path, like circuit tracks
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const c = MAP[y][x];
                const px = x * T, py = y * T;
                if (c === '#') {
                    ctx.fillStyle = COLOURS.wall;
                    ctx.fillRect(px, py, T, T);
                    ctx.strokeStyle = COLOURS.edge;
                    ctx.globalAlpha = 0.75;
                    ctx.beginPath();
                    if (cell(x, y - 1) !== '#' && y > 0) { ctx.moveTo(px + 1, py + 1); ctx.lineTo(px + T - 1, py + 1); }
                    if (cell(x, y + 1) !== '#' && y < ROWS - 1) { ctx.moveTo(px + 1, py + T - 1); ctx.lineTo(px + T - 1, py + T - 1); }
                    if (cell(x - 1, y) !== '#' && x > 0) { ctx.moveTo(px + 1, py + 1); ctx.lineTo(px + 1, py + T - 1); }
                    if (cell(x + 1, y) !== '#' && x < COLS - 1) { ctx.moveTo(px + T - 1, py + 1); ctx.lineTo(px + T - 1, py + T - 1); }
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                } else if (c === '-') {
                    ctx.fillStyle = 'rgba(239, 68, 68, 0.55)';
                    ctx.fillRect(px + 3, py + T / 2 - 2, T - 6, 4);
                } else if (c === 'V') {
                    ctx.fillStyle = 'rgba(239, 68, 68, 0.06)';
                    ctx.fillRect(px, py, T, T);
                }
            }
        }

        // Data bits and firewalls
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const c = grid[y][x];
                const cx = x * T + T / 2, cy = y * T + T / 2;
                if (c === '.') {
                    ctx.fillStyle = COLOURS.bit;
                    ctx.fillRect(cx - 2.5, cy - 2.5, 5, 5);
                } else if (c === 'o') {
                    drawShield(cx, cy, reduceMotion ? 1 : 0.85 + Math.sin(clock * 5) * 0.15);
                }
            }
        }
    }

    function drawShield(cx, cy, scale) {
        const s = 10 * scale;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.fillStyle = COLOURS.firewall;
        ctx.shadowColor = COLOURS.firewall;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.85, -s * 0.6);
        ctx.quadraticCurveTo(s * 0.8, s * 0.6, 0, s);
        ctx.quadraticCurveTo(-s * 0.8, s * 0.6, -s * 0.85, -s * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = COLOURS.bg;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-s * 0.35, 0);
        ctx.lineTo(-s * 0.05, s * 0.3);
        ctx.lineTo(s * 0.4, -s * 0.3);
        ctx.stroke();
        ctx.restore();
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function drawPacket() {
        const p = pos(packet);
        const cx = p.x * T + T / 2, cy = p.y * T + T / 2;
        let alpha = 1;
        if (state === 'dying') alpha = Math.max(0, stateTimer / 1.4);

        ctx.save();
        ctx.globalAlpha = alpha;

        // Short trail behind the packet while it moves
        if (packet.dir.x || packet.dir.y) {
            ctx.fillStyle = COLOURS.packetAccent;
            for (let i = 1; i <= 3; i++) {
                ctx.globalAlpha = alpha * (0.35 - i * 0.09);
                ctx.fillRect(cx - packet.dir.x * i * 6 - 2, cy - packet.dir.y * i * 6 - 2, 4, 4);
            }
            ctx.globalAlpha = alpha;
        }

        // Envelope-shaped data packet
        const w = T * 0.72, h = T * 0.52;
        ctx.shadowColor = COLOURS.edge;
        ctx.shadowBlur = 12;
        ctx.fillStyle = COLOURS.packet;
        roundRect(cx - w / 2, cy - h / 2, w, h, 3);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = COLOURS.packetAccent;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cx - w / 2 + 2, cy - h / 2 + 2);
        ctx.lineTo(cx, cy + 1);
        ctx.lineTo(cx + w / 2 - 2, cy - h / 2 + 2);
        ctx.stroke();

        // Small arrow showing which way it's heading
        const f = packet.facing;
        ctx.fillStyle = COLOURS.packetAccent;
        ctx.beginPath();
        const ax = cx + f.x * (w / 2 + 5), ay = cy + f.y * (h / 2 + 5);
        ctx.moveTo(ax + f.x * 4, ay + f.y * 4);
        ctx.lineTo(ax - f.y * 4, ay + f.x * 4);
        ctx.lineTo(ax + f.y * 4, ay - f.x * 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function drawVirus(v) {
        const p = pos(v);
        const cx = p.x * T + T / 2, cy = p.y * T + T / 2;
        const r = T * 0.3;
        let colour = v.colour;
        if (v.quarantined) {
            // Flash white as the firewall is about to run out
            colour = firewallTimer < 1.5 && Math.floor(clock * 8) % 2 ? '#e2e8f0' : COLOURS.quarantined;
        }

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(reduceMotion ? 0 : v.spin);
        ctx.strokeStyle = colour;
        ctx.fillStyle = colour;
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const a = (Math.PI * 2 * i) / 8;
            const x1 = Math.cos(a) * r, y1 = Math.sin(a) * r;
            const x2 = Math.cos(a) * (r + 5), y2 = Math.sin(a) * (r + 5);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x2, y2, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowColor = colour;
        ctx.shadowBlur = v.quarantined ? 0 : 10;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();

        // Padlock on quarantined viruses
        if (v.quarantined) {
            ctx.fillStyle = COLOURS.bg;
            ctx.fillRect(cx - 4, cy - 1, 8, 6);
            ctx.strokeStyle = COLOURS.bg;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cx, cy - 1, 3, Math.PI, 0);
            ctx.stroke();
        }
    }

    function drawBanner(text, sub) {
        ctx.fillStyle = 'rgba(7, 13, 38, 0.7)';
        ctx.fillRect(0, H / 2 - 34, W, 68);
        ctx.textAlign = 'center';
        ctx.fillStyle = COLOURS.firewall;
        ctx.font = '700 24px Sora, "Segoe UI", sans-serif';
        ctx.fillText(text, W / 2, H / 2 + (sub ? -2 : 8));
        if (sub) {
            ctx.fillStyle = '#c9d8e2';
            ctx.font = '500 13px Roboto, sans-serif';
            ctx.fillText(sub, W / 2, H / 2 + 20);
        }
    }

    function draw() {
        drawMaze();
        viruses.forEach(drawVirus);
        drawPacket();

        ctx.textAlign = 'center';
        ctx.font = '700 13px "JetBrains Mono", monospace';
        popups.forEach(function (pp) {
            ctx.globalAlpha = Math.max(0, pp.life);
            ctx.fillStyle = COLOURS.firewall;
            ctx.fillText(pp.text, pp.x * T + T / 2, pp.y * T + T / 2);
        });
        ctx.globalAlpha = 1;

        if (state === 'cleared') drawBanner('Network clean!', 'Level ' + (level + 1) + ' coming up');
        else if (state === 'dying' && lives > 0) drawBanner('Infected!', lives + (lives === 1 ? ' life' : ' lives') + ' left');
    }

    let last = 0;
    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000 || 0);
        last = now;
        update(dt);
        draw();
        requestAnimationFrame(frame);
    }

    // ---------- HUD and overlay ----------

    function updateHud() {
        $('g-score').textContent = score;
        $('g-lives').textContent = lives;
        $('g-level').textContent = level;
        $('g-best').textContent = best;
    }

    function showOverlay(title, msg, button) {
        $('g-title').textContent = title;
        $('g-msg').textContent = msg;
        $('g-start').textContent = button;
        overlay.hidden = false;
    }

    function hideOverlay() { overlay.hidden = true; }

    function gameOver() {
        state = 'over';
        showOverlay('Game over', 'You scored ' + score + ' and reached level ' + level + '. Best: ' + best + '.', 'Play again');
    }

    function pause() {
        if (state !== 'playing' && state !== 'dying' && state !== 'cleared') return;
        pausedFrom = state;
        state = 'paused';
        showOverlay('Paused', 'Take a breather. Your packet will wait.', 'Resume');
    }

    function resume() {
        state = pausedFrom || 'playing';
        pausedFrom = null;
        hideOverlay();
        canvas.focus({ preventScroll: true });
    }

    $('g-start').addEventListener('click', function () {
        if (state === 'paused') resume(); else newGame();
    });

    // ---------- Controls ----------

    const KEYMAP = {
        ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
        ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right'
    };

    function steer(name) {
        if (state === 'ready' || state === 'over') return;
        packet.want = DIRS[name];
    }

    document.addEventListener('keydown', function (e) {
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (e.code === 'KeyP' && (state === 'playing' || state === 'paused' || state === 'dying' || state === 'cleared')) {
            if (state === 'paused') resume(); else pause();
            return;
        }
        const name = KEYMAP[e.code];
        if (!name) return;
        // Only take over the arrow keys while a game is running
        if (state === 'playing' || state === 'dying' || state === 'cleared') {
            e.preventDefault();
            steer(name);
        }
    });

    // Swipe on the board
    let swipe = null;
    canvas.addEventListener('pointerdown', function (e) {
        swipe = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerup', function (e) {
        if (!swipe) return;
        const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
        swipe = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
        if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 'right' : 'left');
        else steer(dy > 0 ? 'down' : 'up');
    });

    // On-screen pad for phones
    document.querySelectorAll('[data-steer]').forEach(function (btn) {
        btn.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            steer(btn.dataset.steer);
        });
        btn.addEventListener('click', function () { steer(btn.dataset.steer); });
    });

    // Pause if the visitor switches tab or scrolls the game away
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) pause();
    });
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            if (!entries[0].isIntersecting) pause();
        }, { threshold: 0.25 }).observe(canvas);
    }

    // ---------- Start ----------

    resetMaze();
    resetActors();
    updateHud();
    requestAnimationFrame(frame);
})();
