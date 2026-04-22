class ThoughtEntity {
    constructor({ x, y, emotion, intensity, text, memory = false }) {
        this.id = Math.random().toString(36).slice(2, 10);
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.emotion = emotion;
        this.intensity = intensity;
        this.text = text;
        this.memory = memory;

        this.baseRadius = memory ? 10 + intensity * 12 : 90 + intensity * 170;
        this.radius = this.baseRadius;
        this.targetRadius = this.radius;
        this.alpha = memory ? 0.14 : 0.95;
        this.targetAlpha = this.alpha;
        this.mass = Math.max(10, this.radius * 0.7);

        this.noise = Math.random() * Math.PI * 2;
        this.spin = (Math.random() - 0.5) * 0.04;
        this.phase = Math.random() * Math.PI * 2;
        this.defusing = false;
    }
}

export class Universe {
    constructor(bgCanvas, mainCanvas, fxCanvas) {
        this.bgCanvas = bgCanvas;
        this.mainCanvas = mainCanvas;
        this.fxCanvas = fxCanvas;
        this.bgCtx = bgCanvas.getContext('2d');
        this.ctx = mainCanvas.getContext('2d');
        this.fxCtx = fxCanvas.getContext('2d');

        this.width = 0;
        this.height = 0;
        this.time = 0;

        this.entities = [];
        this.stars = [];

        this._resize();
        this._initStars();

        window.addEventListener('resize', () => {
            this._resize();
            this._initStars();
        });
    }

    _resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        [this.bgCanvas, this.mainCanvas, this.fxCanvas].forEach((canvas) => {
            canvas.width = this.width * dpr;
            canvas.height = this.height * dpr;
            canvas.style.width = `${this.width}px`;
            canvas.style.height = `${this.height}px`;
            canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
        });
    }

    _initStars() {
        const count = Math.min(180, Math.floor((this.width * this.height) / 9000));
        this.stars = Array.from({ length: count }, () => ({
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            size: 0.5 + Math.random() * 1.4,
            twinkle: 0.2 + Math.random() * 0.8,
            phase: Math.random() * Math.PI * 2
        }));
    }

    _emotionColor(emotion) {
        const colors = {
            stress: { h: 24, s: 96, l: 56 },
            anger: { h: 2, s: 88, l: 54 },
            fear: { h: 265, s: 78, l: 45 },
            confusion: { h: 200, s: 45, l: 54 },
            sadness: { h: 214, s: 55, l: 52 }
        };
        return colors[emotion] || { h: 34, s: 80, l: 55 };
    }

    _renderBackground() {
        const ctx = this.bgCtx;
        const grad = ctx.createRadialGradient(
            this.width * 0.5,
            this.height * 0.45,
            0,
            this.width * 0.5,
            this.height * 0.5,
            Math.max(this.width, this.height) * 0.75
        );
        grad.addColorStop(0, 'rgba(16, 20, 40, 1)');
        grad.addColorStop(1, 'rgba(3, 5, 12, 1)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);

        for (const s of this.stars) {
            const a = (0.2 + Math.sin(this.time * 0.008 + s.phase) * 0.25) * s.twinkle;
            ctx.fillStyle = `rgba(220, 230, 255, ${Math.max(0.04, a)})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    _applyBehavior(entity) {
        const cx = this.width * 0.5;
        const cy = this.height * 0.45;
        const dx = cx - entity.x;
        const dy = cy - entity.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;

        // Baseline damping
        entity.vx *= 0.985;
        entity.vy *= 0.985;

        if (entity.emotion === 'fear') {
            // Heavy gravity pull toward center
            const grav = 0.08 + entity.intensity * 0.09;
            entity.vx += nx * grav;
            entity.vy += ny * grav;
        } else if (entity.emotion === 'stress' || entity.emotion === 'anger') {
            // Chaotic burst movement
            const chaos = 0.12 + entity.intensity * 0.2;
            entity.vx += (Math.random() - 0.5) * chaos;
            entity.vy += (Math.random() - 0.5) * chaos;
            entity.vx += nx * 0.01;
            entity.vy += ny * 0.01;
        } else if (entity.emotion === 'confusion') {
            // Unstable orbit around center
            const tx = -ny;
            const ty = nx;
            const orbit = 0.05 + Math.sin(this.time * 0.06 + entity.phase) * 0.03;
            entity.vx += tx * orbit;
            entity.vy += ty * orbit;
            entity.vx += nx * 0.015;
            entity.vy += ny * 0.015;
        } else {
            entity.vx += nx * 0.01;
            entity.vy += ny * 0.01;
        }

        entity.x += entity.vx;
        entity.y += entity.vy;

        // Soft bounds
        if (entity.x < 0 || entity.x > this.width) entity.vx *= -0.8;
        if (entity.y < 0 || entity.y > this.height) entity.vy *= -0.8;

        // Interpolate visual properties
        entity.radius += (entity.targetRadius - entity.radius) * 0.04;
        entity.alpha += (entity.targetAlpha - entity.alpha) * 0.05;
    }

    _renderEntities() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        for (const entity of this.entities) {
            const c = this._emotionColor(entity.emotion);
            const pulse = entity.defusing
                ? 1 + Math.sin(this.time * 0.03 + entity.phase) * 0.02
                : 1 + Math.sin(this.time * (0.09 + entity.intensity * 0.1) + entity.phase) * (0.08 + entity.intensity * 0.1);
            const radius = Math.max(2, entity.radius * pulse);

            ctx.save();
            ctx.translate(entity.x, entity.y);
            ctx.rotate(entity.spin);

            const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 2.8);
            glow.addColorStop(0, `hsla(${c.h}, ${c.s}%, ${c.l + 12}%, ${entity.alpha * (entity.memory ? 0.45 : 0.65)})`);
            glow.addColorStop(0.4, `hsla(${c.h}, ${c.s}%, ${c.l}%, ${entity.alpha * (entity.memory ? 0.2 : 0.28)})`);
            glow.addColorStop(1, `hsla(${c.h}, ${c.s}%, ${c.l - 10}%, 0)`);
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(0, 0, radius * 2.8, 0, Math.PI * 2);
            ctx.fill();

            const core = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 0, 0, 0, radius);
            core.addColorStop(0, `hsla(${c.h}, ${Math.min(100, c.s + 10)}%, ${Math.min(90, c.l + 26)}%, ${entity.alpha})`);
            core.addColorStop(1, `hsla(${c.h}, ${c.s}%, ${Math.max(20, c.l - 16)}%, ${entity.alpha * 0.8})`);
            ctx.fillStyle = core;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    _renderOverlay() {
        const ctx = this.fxCtx;
        ctx.clearRect(0, 0, this.width, this.height);
        const vignette = ctx.createRadialGradient(
            this.width * 0.5,
            this.height * 0.5,
            this.width * 0.25,
            this.width * 0.5,
            this.height * 0.5,
            this.width * 0.7
        );
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0, 0, 0, 0.52)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, this.width, this.height);
    }

    update() {
        this.time += 1;
        this._renderBackground();

        for (const entity of this.entities) {
            this._applyBehavior(entity);
        }

        this._renderEntities();
        this._renderOverlay();
    }

    addDefusionEntity({ text, emotion, intensity, timestamp }) {
        const entity = new ThoughtEntity({
            x: this.width * 0.5,
            y: this.height * 0.45,
            emotion,
            intensity,
            text,
            timestamp
        });
        this.entities.push(entity);
        return entity;
    }

    async defuseEntity(entityId, durationFrames = 170) {
        const entity = this.entities.find((e) => e.id === entityId);
        if (!entity) return;

        entity.defusing = true;
        const startRadius = entity.radius;
        const startAlpha = entity.alpha;
        const targetRadius = Math.max(10, startRadius * 0.18);
        const targetAlpha = 0.22;
        const cx = this.width * 0.5;
        const cy = this.height * 0.45;
        const dx = entity.x - cx;
        const dy = entity.y - cy;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const outX = (dx / d) * (120 + entity.intensity * 220);
        const outY = (dy / d) * (80 + entity.intensity * 160);

        await new Promise((resolve) => {
            let frame = 0;
            const timer = setInterval(() => {
                frame += 1;
                const t = Math.min(1, frame / durationFrames);
                const eased = t * t * (3 - 2 * t);

                entity.targetRadius = startRadius + (targetRadius - startRadius) * eased;
                entity.targetAlpha = startAlpha + (targetAlpha - startAlpha) * eased;
                entity.vx *= 0.92;
                entity.vy *= 0.92;
                entity.x = entity.x + (cx + outX - entity.x) * 0.008;
                entity.y = entity.y + (cy + outY - entity.y) * 0.008;

                if (t >= 1) {
                    clearInterval(timer);
                    entity.memory = true;
                    entity.defusing = false;
                    entity.intensity = Math.min(0.18, entity.intensity * 0.2);
                    entity.targetRadius = Math.max(8, entity.targetRadius);
                    entity.targetAlpha = 0.14;
                    resolve();
                }
            }, 16);
        });
    }

    toEcho(entityId) {
        const entity = this.entities.find((e) => e.id === entityId);
        if (!entity) return null;
        return {
            id: entity.id,
            x: entity.x,
            y: entity.y,
            emotion: entity.emotion,
            intensity: Math.min(0.22, entity.intensity),
            text: '',
            memory: true,
            savedAt: Date.now()
        };
    }

    loadMemoryEchoes(echoes) {
        echoes.forEach((echo) => {
            const e = new ThoughtEntity({
                x: typeof echo.x === 'number' ? echo.x : Math.random() * this.width,
                y: typeof echo.y === 'number' ? echo.y : Math.random() * this.height,
                emotion: echo.emotion || 'stress',
                intensity: Math.max(0.08, Math.min(0.24, echo.intensity || 0.12)),
                text: '',
                memory: true
            });
            e.alpha = 0.1;
            e.targetAlpha = 0.1;
            e.targetRadius = e.radius;
            this.entities.push(e);
        });
    }
}
