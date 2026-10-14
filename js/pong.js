// Ping Pong: a small Pong-style game for the site.
// You're the left paddle, the computer is the right. First to 7 wins.
// Keyboard (W/S or arrows), mouse or touch drag to move.
(function () {
    'use strict';

    const canvas = document.getElementById('game');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const W = 640, H = 400;
    const PADDLE_W = 10, PADDLE_H = 70, PADDLE_GAP = 24;
    const BALL = 9;
    const WIN_SCORE = 7;
    const MAX_BOUNCE = Math.PI / 3.2; // steepest angle off a paddle edge

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const $ = function (id) { return document.getElementById(id); };
    const overlay = $('g-overlay');
    const arcade = $('arcade');

    // ---------- State ----------

    let state = 'ready'; // ready | playing | serving | paused | over
    let you, cpu, ball;
    let scoreYou = 0, scoreCpu = 0;
    let rally = 0, bestRally = 0;
    let serveTimer = 0, serveTo = 1;
    let keys = { up: false, down: false };
    let pointerY = null;
    let trail = [];
    let flash = 0;

    try { bestRally = Number(localStorage.getItem('ping-pong-best-rally')) || 0; } catch (e) {}

    function resetPaddles() {
        you = { y: H / 2 - PADDLE_H / 2 };
        cpu = { y: H / 2 - PADDLE_H / 2, aim: 0 };
    }

    function serve() {
        // Ball starts in the middle and heads to whoever just conceded
        const angle = (Math.random() * 0.6 - 0.3);
        const speed = 330;
        ball = {
            x: W / 2,
            y: H / 2 + (Math.random() * 120 - 60),
            vx: Math.cos(angle) * speed * serveTo,
            vy: Math.sin(angle) * speed,
            speed: speed
        };
        rally = 0;
        trail = [];
        cpu.aim = 0;
        state = 'serving';
        serveTimer = 0.8;
    }

    // ---------- Update ----------

    function clampPaddle(p) {
        p.y = Math.max(0, Math.min(H - PADDLE_H, p.y));
    }

    function hitPaddle(paddleX, paddle, dir) {
        // Where on the paddle it hit: -1 (top) to 1 (bottom)
        const rel = (ball.y - (paddle.y + PADDLE_H / 2)) / (PADDLE_H / 2);
        const angle = Math.max(-1, Math.min(1, rel)) * MAX_BOUNCE;
        ball.speed = Math.min(ball.speed * 1.06, 900);
        ball.vx = Math.cos(angle) * ball.speed * dir;
        ball.vy = Math.sin(angle) * ball.speed;
        ball.x = paddleX + (dir > 0 ? PADDLE_W + BALL / 2 : -BALL / 2);
        rally++;
        flash = 0.12;

        if (rally > bestRally) {
            bestRally = rally;
            try { localStorage.setItem('ping-pong-best-rally', bestRally); } catch (e) {}
        }

        // The computer picks a slightly different spot on its paddle each
        // time, so it can be beaten
        if (dir > 0) cpu.aim = (Math.random() - 0.5) * PADDLE_H * 0.9;
        updateHud();
    }

    function step(dt) {
        // Your paddle
        if (pointerY !== null) {
            const target = pointerY - PADDLE_H / 2;
            you.y += (target - you.y) * Math.min(dt * 18, 1);
        } else {
            const move = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
            you.y += move * 430 * dt;
        }
        clampPaddle(you);

        // Computer paddle: tracks the ball when it's coming, drifts home otherwise
        const cpuMax = 255 + Math.min(scoreYou, 6) * 12;
        const targetY = ball.vx > 0 ? ball.y + cpu.aim - PADDLE_H / 2 : H / 2 - PADDLE_H / 2;
        const diff = targetY - cpu.y;
        cpu.y += Math.sign(diff) * Math.min(Math.abs(diff), cpuMax * dt);
        clampPaddle(cpu);

        if (state === 'serving') return;

        // Ball
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        if (ball.y < BALL / 2) {
            ball.y = BALL / 2;
            ball.vy = Math.abs(ball.vy);
        } else if (ball.y > H - BALL / 2) {
            ball.y = H - BALL / 2;
            ball.vy = -Math.abs(ball.vy);
        }

        const leftX = PADDLE_GAP;
        const rightX = W - PADDLE_GAP - PADDLE_W;

        if (ball.vx < 0 && ball.x - BALL / 2 <= leftX + PADDLE_W && ball.x - BALL / 2 >= leftX - 8 &&
            ball.y >= you.y - BALL / 2 && ball.y <= you.y + PADDLE_H + BALL / 2) {
            hitPaddle(leftX, you, 1);
        }

        if (ball.vx > 0 && ball.x + BALL / 2 >= rightX && ball.x + BALL / 2 <= rightX + PADDLE_W + 8 &&
            ball.y >= cpu.y - BALL / 2 && ball.y <= cpu.y + PADDLE_H + BALL / 2) {
            hitPaddle(rightX, cpu, -1);
        }

        // Points
        if (ball.x < -BALL) {
            scoreCpu++;
            point(-1);
        } else if (ball.x > W + BALL) {
            scoreYou++;
            point(1);
        }
    }

    function point(serveDirection) {
        updateHud();
        if (scoreYou >= WIN_SCORE || scoreCpu >= WIN_SCORE) {
            return gameOver();
        }
        serveTo = serveDirection;
        serve();
    }

    function update(dt) {
        if (flash > 0) flash -= dt;
        if (state === 'serving') {
            serveTimer -= dt;
            step(dt);
            if (serveTimer <= 0) state = 'playing';
            return;
        }
        if (state !== 'playing') return;

        // Small sub-steps so a fast ball can't skip through a paddle
        let remaining = dt;
        while (remaining > 0 && state === 'playing') {
            const h = Math.min(remaining, 1 / 240);
            step(h);
            remaining -= h;
        }

        trail.push({ x: ball.x, y: ball.y });
        if (trail.length > 8) trail.shift();
    }

    // ---------- Drawing ----------

    function draw() {
        ctx.fillStyle = '#070d26';
        ctx.fillRect(0, 0, W, H);

        // Big faint scores in the background
        ctx.fillStyle = 'rgba(102, 191, 191, 0.12)';
        ctx.font = '700 96px Sora, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(scoreYou, W / 4, H / 2);
        ctx.fillText(scoreCpu, (W * 3) / 4, H / 2);

        // Centre net
        ctx.fillStyle = 'rgba(201, 216, 226, 0.25)';
        for (let y = 8; y < H; y += 22) ctx.fillRect(W / 2 - 1.5, y, 3, 12);

        // Paddles
        ctx.save();
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#3cc1c4';
        ctx.fillStyle = '#66bfbf';
        roundRect(PADDLE_GAP, you.y, PADDLE_W, PADDLE_H, 5);
        ctx.shadowColor = '#f472b6';
        ctx.fillStyle = '#f472b6';
        roundRect(W - PADDLE_GAP - PADDLE_W, cpu.y, PADDLE_W, PADDLE_H, 5);
        ctx.restore();

        if (!ball) return;

        // Ball trail
        trail.forEach(function (t, i) {
            ctx.globalAlpha = (i + 1) / trail.length * 0.25;
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.arc(t.x, t.y, BALL / 2, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Ball (blinks while waiting to serve)
        if (state !== 'serving' || Math.floor(serveTimer * 6) % 2 === 0) {
            ctx.save();
            ctx.shadowBlur = flash > 0 ? 24 : 12;
            ctx.shadowColor = '#facc15';
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.fill();
    }

    // ---------- HUD and overlay ----------

    function updateHud() {
        $('g-you').textContent = scoreYou;
        $('g-cpu').textContent = scoreCpu;
        $('g-rally').textContent = rally;
        $('g-best').textContent = bestRally;
    }

    function showOverlay(title, msg, button) {
        $('g-title').textContent = title;
        $('g-msg').textContent = msg;
        $('g-start').textContent = button;
        overlay.hidden = false;
    }

    function start() {
        if (state === 'paused') {
            state = 'playing';
            overlay.hidden = true;
            return;
        }
        scoreYou = 0;
        scoreCpu = 0;
        serveTo = 1;
        resetPaddles();
        serve();
        overlay.hidden = true;
        updateHud();
        canvas.focus({ preventScroll: true });
    }

    function pause() {
        if (state !== 'playing' && state !== 'serving') return;
        state = 'paused';
        showOverlay('Paused', 'Ball\'s in your court when you\'re ready.', 'Resume');
    }

    function gameOver() {
        state = 'over';
        const won = scoreYou > scoreCpu;
        showOverlay(
            won ? 'You win!' : 'Request timed out',
            (won ? 'Nice one. ' : 'The computer won this time. ') + scoreYou + '–' + scoreCpu + '. Best rally: ' + bestRally + '.',
            'Play again'
        );
    }

    $('g-start').addEventListener('click', start);

    // ---------- Controls ----------

    const UP_KEYS = ['ArrowUp', 'w', 'W'];
    const DOWN_KEYS = ['ArrowDown', 's', 'S'];

    function playing() {
        return state === 'playing' || state === 'serving';
    }

    document.addEventListener('keydown', function (e) {
        const isUp = UP_KEYS.indexOf(e.key) !== -1;
        const isDown = DOWN_KEYS.indexOf(e.key) !== -1;
        if ((isUp || isDown) && (playing() || arcade.contains(document.activeElement))) {
            // Stop the arrow keys scrolling the page mid-game
            e.preventDefault();
            pointerY = null;
            if (isUp) keys.up = true;
            if (isDown) keys.down = true;
        } else if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && playing()) {
            e.preventDefault();
            pause();
        } else if ((e.key === ' ' || e.key === 'Enter') && document.activeElement === canvas && !playing()) {
            e.preventDefault();
            start();
        }
    });

    document.addEventListener('keyup', function (e) {
        if (UP_KEYS.indexOf(e.key) !== -1) keys.up = false;
        if (DOWN_KEYS.indexOf(e.key) !== -1) keys.down = false;
    });

    // Mouse or finger: the paddle follows the pointer's height on the board
    function trackPointer(e) {
        const rect = canvas.getBoundingClientRect();
        pointerY = ((e.clientY - rect.top) / rect.height) * H;
    }

    canvas.addEventListener('pointermove', trackPointer);
    canvas.addEventListener('pointerdown', function (e) {
        trackPointer(e);
        if (e.pointerType !== 'mouse') canvas.setPointerCapture(e.pointerId);
    });

    // Pause when the game scrolls out of view or the tab is hidden
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) pause();
    });
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            // Only pause once the board actually leaves the screen
            if (!entries[0].isIntersecting && entries[0].intersectionRatio === 0) pause();
        }, { threshold: [0] }).observe(canvas);
    }

    // ---------- Loop ----------

    let last = performance.now();
    function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        update(dt);
        draw();
        requestAnimationFrame(frame);
    }

    resetPaddles();
    updateHud();
    requestAnimationFrame(frame);
})();
