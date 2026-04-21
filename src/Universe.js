/**
 * Universe — The core rendering & physics engine for COSMOS
 * Manages entities, gravitational simulation, particle effects,
 * background star fields, nebula rendering, and camera controls.
 */

// ─── Entity Class ───────────────────────────────────────────
class Entity {
  constructor(x, y, type, emotionData) {
    this.id = Math.random().toString(36).slice(2, 10);
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.type = type;
    this.emotion = emotionData.emotion;
    this.text = emotionData.text;
    this.color = emotionData.color; // {h, s, l}
    this.intensity = emotionData.intensity;
    this.weight = emotionData.weight || 1.0;
    this.polarity = emotionData.polarity !== undefined ? emotionData.polarity : 0;
    this.age = 0;
    this.creationTime = emotionData.timestamp || Date.now();
    this.stage = 'seed'; // seed, main_sequence, giant, ancient, dwarf
    this.alive = true;
    this.historyRings = [];

    // Type-specific properties
    switch (type) {
      case 'star':
        this.mass = 40 + Math.random() * 60;
        this.radius = 3 + Math.random() * 4;
        this.pulseSpeed = 1 + Math.random() * 2;
        this.luminosity = 0.8 + Math.random() * 0.4;
        break;
      case 'nebula':
        this.mass = 20 + Math.random() * 30;
        this.radius = 40 + Math.random() * 60;
        this.cloudParticles = this._generateCloudParticles();
        this.rotationSpeed = (Math.random() - 0.5) * 0.002;
        this.rotation = Math.random() * Math.PI * 2;
        break;
      case 'blackHole':
        this.mass = 200 + Math.random() * 300;
        this.radius = 8 + Math.random() * 5;
        this.accretionAngle = 0;
        this.accretionSpeed = 0.02 + Math.random() * 0.02;
        break;
      case 'redGiant':
        this.mass = 80 + Math.random() * 120;
        this.radius = 8 + Math.random() * 8;
        this.pulseSpeed = 0.5 + Math.random();
        this.flareTimer = 0;
        break;
      case 'comet':
        this.mass = 60 + Math.random() * 40;
        this.radius = 3 + Math.random() * 2;
        this.beamAngle = Math.random() * Math.PI * 2;
        this.beamSpeed = 0.03 + Math.random() * 0.03;
        this.beamLength = 80 + Math.random() * 120;
        break;
      case 'planet':
        this.mass = 15 + Math.random() * 25;
        this.radius = 5 + Math.random() * 6;
        this.hasRing = Math.random() > 0.5;
        this.ringAngle = Math.random() * Math.PI;
        break;
      case 'drifter':
        this.mass = 30 + Math.random() * 50;
        this.radius = 20 + Math.random() * 30;
        this.particles = [];
        for (let i = 0; i < 20; i++) {
          this.particles.push({
            angle: Math.random() * Math.PI * 2,
            dist: Math.random() * this.radius,
            speed: (Math.random() - 0.5) * 0.01,
            size: 1 + Math.random() * 2
          });
        }
        break;
      case 'fastOrbit':
        this.mass = 10 + Math.random() * 10;
        this.radius = 2 + Math.random() * 3;
        this.rotationSpeed = (Math.random() - 0.5) * 0.2;
        this.rotation = Math.random() * Math.PI * 2;
        break;
      case 'dustCloud':
        this.mass = 15 + Math.random() * 20;
        this.radius = 30 + Math.random() * 40;
        this.cloudParticles = this._generateCloudParticles();
        this.rotationSpeed = (Math.random() - 0.5) * 0.001;
        this.rotation = Math.random() * Math.PI * 2;
        break;
      case 'lightArc':
        this.mass = 25 + Math.random() * 30;
        this.radius = 15 + Math.random() * 20;
        this.arcPulse = 0;
        this.arcSpeed = 0.02 + Math.random() * 0.03;
        break;
      default:
        this.mass = 30;
        this.radius = 4;
    }

    // Trail
    this.trail = [];
    this.maxTrail = 40;

    // Birth animation
    this.birthScale = 0;
    this.birthDuration = 60; // frames
    this.birthFrame = 0;
  }

  _generateCloudParticles() {
    const particles = [];
    const count = 30 + Math.floor(Math.random() * 30);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * this.radius;
      particles.push({
        ox: Math.cos(angle) * dist,
        oy: Math.sin(angle) * dist,
        size: 5 + Math.random() * 20,
        opacity: 0.05 + Math.random() * 0.12,
        hueShift: (Math.random() - 0.5) * 30
      });
    }
    return particles;
  }

  update(dt) {
    this.age += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Lifecycle Transitions
    const activeAge = this.age; // in frames
    const chronoAgeDays = (Date.now() - this.creationTime) / (1000 * 60 * 60 * 24);

    if (this.stage === 'seed' && activeAge > 600) this.stage = 'main_sequence';
    
    // For demo/testing, we'll use activeAge for faster evolution, 
    // but in real use we'd weight ChronoAge more.
    if (this.stage === 'main_sequence' && (activeAge > 5000 || chronoAgeDays > 2)) {
      this.stage = 'giant';
      this.radius *= 1.0001; // slow expansion
    }
    if (this.stage === 'giant' && (activeAge > 15000 || chronoAgeDays > 7)) {
      this.stage = 'ancient';
    }

    // Anchor slowly and fade gracefully over time
    if (this.stage === 'ancient') {
      if (this.mass < 300) this.mass += dt * 0.01;
      if (this.luminosity && this.luminosity > 0.3) this.luminosity -= dt * 0.0002;
      
      // History Rings
      if (this.historyRings.length < 3 && Math.random() < 0.001) {
        this.historyRings.push({ radius: this.radius * (2 + this.historyRings.length), opacity: 0.2 });
      }
    }

    // Birth animation
    if (this.birthFrame < this.birthDuration) {
      this.birthFrame++;
      this.birthScale = this._easeOutBack(this.birthFrame / this.birthDuration);
    } else {
      this.birthScale = 1;
    }

    // Trail
    if (this.type !== 'nebula' && this.type !== 'drifter' && this.type !== 'dustCloud' && this.type !== 'lightArc') {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrail) this.trail.shift();
    }

    // Type-specific updates
    if (this.type === 'nebula') {
      this.rotation += this.rotationSpeed * dt;
    }
    if (this.type === 'blackHole') {
      this.accretionAngle += this.accretionSpeed * dt;
    }
    if (this.type === 'comet') {
      this.beamAngle += this.beamSpeed * dt;
    }
    if (this.type === 'redGiant') {
      this.flareTimer += dt;
    }
    if (this.type === 'drifter') {
      this.particles.forEach(p => {
        p.angle += p.speed * dt;
      });
    }
    if (this.type === 'fastOrbit') {
      this.rotation += this.rotationSpeed * dt;
    }
    if (this.type === 'dustCloud') {
      this.rotation += this.rotationSpeed * dt;
    }
    if (this.type === 'lightArc') {
      this.arcPulse += this.arcSpeed * dt;
    }
  }

  _easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  getDisplayRadius() {
    return this.radius * this.birthScale;
  }
}


// ─── Particle (for explosions / creation effects) ───────────
class Particle {
  constructor(x, y, color, speed, angle, life) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = 1 + Math.random() * 3;
    this.alive = true;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.99;
    this.vy *= 0.99;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }

  getOpacity() {
    return Math.max(0, this.life / this.maxLife);
  }
}


// ─── Background Star ────────────────────────────────────────
class BackgroundStar {
  constructor(canvasW, canvasH) {
    this.x = Math.random() * canvasW;
    this.y = Math.random() * canvasH;
    this.size = Math.random() * 1.8 + 0.2;
    this.baseOpacity = Math.random() * 0.6 + 0.2;
    this.twinkleSpeed = Math.random() * 0.02 + 0.005;
    this.twinkleOffset = Math.random() * Math.PI * 2;
    this.hue = Math.random() > 0.85 ? (Math.random() > 0.5 ? 220 : 30) : 0;
    this.saturation = this.hue ? 40 : 0;
  }

  getOpacity(time) {
    return this.baseOpacity * (0.6 + 0.4 * Math.sin(time * this.twinkleSpeed + this.twinkleOffset));
  }
}


// ─── Universe Engine ────────────────────────────────────────
export class Universe {
  constructor(bgCanvas, mainCanvas, fxCanvas) {
    this.bgCanvas = bgCanvas;
    this.mainCanvas = mainCanvas;
    this.fxCanvas = fxCanvas;
    this.bgCtx = bgCanvas.getContext('2d');
    this.ctx = mainCanvas.getContext('2d');
    this.fxCtx = fxCanvas.getContext('2d');
    this.reflection = null; 
    this.onEntitySelected = null; 

    this.entities = [];
    this.particles = [];
    this.bgStars = [];
    this.constellationLines = [];
    this.hoverData = null;
    this.ripples = [];
    this.archetypes = []; // { x, y, label, entities }

    this.camera = { 
      x: 0, y: 0, zoom: 1, 
      targetX: 0, targetY: 0, targetZoom: 1, 
      isCinematic: true, breathingPhase: 0, manualTimeout: 0 
    };
    this.time = 0;
    this.timeSpeed = 1;
    this.globalTimeSpeedMulti = 1.0;
    this.moodColor = { h: 240, s: 40, l: 8 };
    this.targetMoodColor = { h: 240, s: 40, l: 8 };
    this.gravityStrength = 1;
    this.showTrails = true;
    this.running = true;
    this.universeAge = 0;

    this.width = 0;
    this.height = 0;

    this._isDragging = false;
    this._dragStart = { x: 0, y: 0 };
    this._camStart = { x: 0, y: 0 };
    this._pinchStartDist = 0;
    this._pinchStartZoom = 1;

    this._resize();
    this._initStars();
    this._drawBackground();
    this._bindEvents();
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    [this.bgCanvas, this.mainCanvas, this.fxCanvas].forEach(c => {
      c.width = this.width * dpr;
      c.height = this.height * dpr;
      c.style.width = this.width + 'px';
      c.style.height = this.height + 'px';
      c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  }

  _initStars() {
    this.bgStars = [];
    const count = Math.min(150, Math.floor((this.width * this.height) / 8000));
    for (let i = 0; i < count; i++) {
      this.bgStars.push(new BackgroundStar(this.width, this.height));
    }
  }

  _drawBackground() {
    const ctx = this.bgCtx;
    const { h, s, l } = this.moodColor;
    const grad = ctx.createRadialGradient(
      this.width / 2, this.height / 2, 0,
      this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.7
    );
    grad.addColorStop(0, `hsl(${h}, ${s}%, ${l + 8}%)`);
    grad.addColorStop(0.5, `hsl(${h}, ${s}%, ${l + 3}%)`);
    grad.addColorStop(1, `hsl(${h}, ${Math.max(0, s - 20)}%, ${Math.max(2, l - 5)}%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this._resize();
      this._initStars();
      this._drawBackground();
    });

    this.mainCanvas.addEventListener('mousedown', (e) => {
      this.camera.isCinematic = false;
      this.camera.manualTimeout = Date.now() + 10000;
      this._onPointerDown(e.clientX, e.clientY);
    });
    this.mainCanvas.addEventListener('mousemove', (e) => this._onPointerMove(e.clientX, e.clientY));
    this.mainCanvas.addEventListener('mouseup', () => this._onPointerUp());
    this.mainCanvas.addEventListener('wheel', (e) => {
      this.camera.isCinematic = false;
      this.camera.manualTimeout = Date.now() + 10000;
      e.preventDefault();
      const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
      this.camera.targetZoom = Math.max(0.2, Math.min(5, this.camera.targetZoom * zoomDelta));
    }, { passive: false });

    // Touch events
    this.mainCanvas.addEventListener('touchstart', (e) => {
      this.camera.isCinematic = false;
      this.camera.manualTimeout = Date.now() + 10000;
      if (e.touches.length === 1) {
        this._onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        this._pinchStartDist = this._getTouchDist(e.touches);
        this._pinchStartZoom = this.camera.targetZoom;
      }
    }, { passive: true });

    this.mainCanvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        this._onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        const dist = this._getTouchDist(e.touches);
        const scale = dist / this._pinchStartDist;
        this.camera.targetZoom = Math.max(0.2, Math.min(5, this._pinchStartZoom * scale));
      }
    }, { passive: true });

    this.mainCanvas.addEventListener('touchend', () => this._onPointerUp());
  }

  _onPointerDown(x, y) {
    this._isDragging = true;
    this._dragStart = { x, y };
    this._camStart = { x: this.camera.x, y: this.camera.y };

    // Find nearest entity (Magnetism)
    const rect = this.mainCanvas.getBoundingClientRect();
    const mx = x - rect.left;
    const my = y - rect.top;
    const worldX = (mx - this.width / 2) / this.camera.zoom - this.camera.x + this.width / 2;
    const worldY = (my - this.height / 2) / this.camera.zoom - this.camera.y + this.height / 2;

    let nearest = null;
    let minDist = 40 / this.camera.zoom; // Magnetism radius (px)

    for (const e of this.entities) {
      const d = Math.sqrt((worldX - e.x)**2 + (worldY - e.y)**2);
      if (d < minDist) {
        minDist = d;
        nearest = e;
      }
    }

    if (nearest) {
      this._spawnRipple(nearest.x, nearest.y, nearest.color);
      // Auto-focus logic could go here, but cinematic camera already handles it partially.
      // Let's just trigger a focus if clicked.
      this.camera.targetX = -nearest.x;
      this.camera.targetY = -nearest.y;
      this.camera.isCinematic = true;

      if (this.onEntitySelected) {
        this.onEntitySelected(nearest);
      }
    }
  }

  _onPointerMove(x, y) {
    // Hover hit detection
    const rect = this.mainCanvas.getBoundingClientRect();
    const mx = x - rect.left;
    const my = y - rect.top;
    
    const worldX = (mx - this.width / 2) / this.camera.zoom - this.camera.x + this.width / 2;
    const worldY = (my - this.height / 2) / this.camera.zoom - this.camera.y + this.height / 2;
    
    this.hoverData = null;
    if (!this._isDragging) {
      for (const e of this.entities) {
        const dx = worldX - e.x;
        const dy = worldY - e.y;
        if (dx * dx + dy * dy < (e.radius * e.radius * 9)) {
          this.hoverData = { x: mx, y: my, emotion: e.emotion, text: e.text };
          break;
        }
      }
    }

    if (!this._isDragging) return;
    const dx = (x - this._dragStart.x) / this.camera.zoom;
    const dy = (y - this._dragStart.y) / this.camera.zoom;
    this.camera.x = this._camStart.x + dx;
    this.camera.y = this._camStart.y + dy;
  }

  _onPointerUp() {
    this._isDragging = false;
  }

  _getTouchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ─── Entity Creation ────────────────────────────────────
  addThought(emotionData) {
    const cx = this.width / 2 - this.camera.targetX;
    const cy = this.height / 2 - this.camera.targetY;
    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * 150;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;

    const entity = new Entity(x, y, emotionData.entityType, emotionData);

    const toCenterX = cx - x;
    const toCenterY = cy - y;
    const d = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY) || 1;
    entity.vx = (-toCenterY / d) * 0.3 + (Math.random() - 0.5) * 0.2;
    entity.vy = (toCenterX / d) * 0.3 + (Math.random() - 0.5) * 0.2;

    this._spawnGatherEffect(x, y, emotionData.color, emotionData.intensity);

    this.camera.targetX = -x;
    this.camera.targetY = -y;
    this.camera.targetZoom = 1.2;
    this.camera.isCinematic = true;

    setTimeout(() => {
      this.entities.push(entity);
      this._spawnCreationEffect(x, y, emotionData.color, emotionData.intensity);
      this._updateConstellations();
    }, 800);

    return entity;
  }

  addThoughtSilent(emotionData) {
    const cx = this.width / 2 - this.camera.x;
    const cy = this.height / 2 - this.camera.y;
    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * 150;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;

    const entity = new Entity(x, y, emotionData.entityType, emotionData);

    const toCenterX = cx - x;
    const toCenterY = cy - y;
    const d = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY) || 1;
    entity.vx = (-toCenterY / d) * 0.3 + (Math.random() - 0.5) * 0.2;
    entity.vy = (toCenterX / d) * 0.3 + (Math.random() - 0.5) * 0.2;
    entity.birthScale = 1;
    entity.birthFrame = entity.birthDuration;

    this.entities.push(entity);
    this._updateConstellations();
    return entity;
  }

  getSerializableEntities() {
    return this.entities.map(e => ({
      id: e.id,
      x: e.x, y: e.y, vx: e.vx, vy: e.vy,
      type: e.type, emotion: e.emotion, text: e.text,
      color: e.color, intensity: e.intensity, age: e.age,
      mass: e.mass, radius: e.radius,
      pulseSpeed: e.pulseSpeed, luminosity: e.luminosity,
      rotationSpeed: e.rotationSpeed, rotation: e.rotation,
      beamAngle: e.beamAngle, beamSpeed: e.beamSpeed, beamLength: e.beamLength,
      arcPulse: e.arcPulse, arcSpeed: e.arcSpeed,
      hasRing: e.hasRing, ringAngle: e.ringAngle,
      stage: e.stage, creationTime: e.creationTime, historyRings: e.historyRings
    }));
  }

  loadEntities(entitiesData) {
    this.entities = [];
    this.particles = [];
    entitiesData.forEach(data => {
      // Create new instance to maintain methods
      const e = new Entity(data.x, data.y, data.type, {
        emotion: data.emotion, text: data.text, color: data.color, intensity: data.intensity,
        timestamp: data.creationTime // Maintain chronological link
      });
      // Hydrate state
      Object.assign(e, data);
      e.birthScale = 1; 
      e.birthFrame = e.birthDuration;
      
      // Prevent stale references for large arrays
      if (e.type === 'nebula' || e.type === 'dustCloud') {
        e.cloudParticles = e._generateCloudParticles();
      }
      this.entities.push(e);
    });
    this._updateConstellations();
  }


  _spawnRipple(x, y, color) {
    this.ripples.push({
      x, y, color,
      r: 10,
      opacity: 0.8,
      alive: true
    });
  }

  _spawnGatherEffect(x, y, color, intensity) {
    const count = 20 + Math.floor(intensity * 30);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 60;
      const speed = -1.0 - Math.random() * 2;
      const life = 30 + Math.random() * 20;
      this.particles.push(new Particle(x + Math.cos(angle)*dist, y + Math.sin(angle)*dist, color, speed, angle, life));
    }
  }

  _spawnCreationEffect(x, y, color, intensity) {
    const count = 30 + Math.floor(intensity * 40);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 3 * intensity;
      const life = 40 + Math.random() * 60;
      this.particles.push(new Particle(x, y, color, speed, angle, life));
    }
  }

  _updateConstellations() {
    this.constellationLines = [];
    const entities = this.entities;
    const maxDist = 250;

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const a = entities[i];
        const b = entities[j];
        // Connect entities of same emotion or nearby entities
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist && (a.emotion === b.emotion || dist < 120)) {
          this.constellationLines.push({
            x1: a.x, y1: a.y,
            x2: b.x, y2: b.y,
            opacity: 1 - dist / maxDist,
            color: a.color
          });
        }
      }
    }
  }

  // ─── Physics ────────────────────────────────────────────
  _applyPhysics(dt) {
    const G = 0.08 * this.gravityStrength;
    const entities = this.entities;

    for (let i = 0; i < entities.length; i++) {
      const a = entities[i];
      for (let j = i + 1; j < entities.length; j++) {
        const b = entities[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq) || 1;
        const minDist = (a.getDisplayRadius() + b.getDisplayRadius()) * 2;

        if (dist < minDist) {
          // Soft collision - repel
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          const repel = overlap * 0.05;
          a.vx -= nx * repel;
          a.vy -= ny * repel;
          b.vx += nx * repel;
          b.vy += ny * repel;
        } else {
          // Emotional Gravity
          let affinity = 1.0;
          if (a.emotion === b.emotion) {
            affinity = 1.8; // Cluster strongly
          } else if (a.polarity !== 0 && b.polarity !== 0 && a.polarity !== b.polarity) {
            affinity = -0.5; // Repel conflicting
          }

          let force = G * (a.mass * a.weight) * (b.mass * b.weight) * affinity / (distSq + 500);

          if (a.emotion === 'calm' && dist < 300) {
            b.vx *= 0.99; b.vy *= 0.99; // Stabilize
          }
          if (b.emotion === 'calm' && dist < 300) {
            a.vx *= 0.99; a.vy *= 0.99;
          }

          const fx = force * dx / dist;
          const fy = force * dy / dist;
          a.vx += fx / a.mass * dt;
          a.vy += fy / a.mass * dt;
          b.vx -= fx / b.mass * dt;
          b.vy -= fy / b.mass * dt;
        }
      }

      // Damping to prevent runaway
      a.vx *= 0.9995;
      a.vy *= 0.9995;
    }
  }

  // ─── Archetype Detection ────────────────────────────────
  _updateArchetypes() {
    if (!this.reflection || this.entities.length < 4) return;
    
    // Very simple spatial clustering
    const clusters = [];
    const used = new Set();
    const threshold = 350;

    for (let i = 0; i < this.entities.length; i++) {
      const e1 = this.entities[i];
      if (used.has(e1.id)) continue;
      
      const cluster = [e1];
      for (let j = i + 1; j < this.entities.length; j++) {
        const e2 = this.entities[j];
        const d = Math.sqrt((e1.x-e2.x)**2 + (e1.y-e2.y)**2);
        if (d < threshold) {
          cluster.push(e2);
          used.add(e2.id);
        }
      }

      if (cluster.length >= 3) {
        const label = this.reflection.getArchetypeLabel(cluster);
        if (label) {
          // Calculate center of mass
          const cx = cluster.reduce((acc, e) => acc + e.x, 0) / cluster.length;
          const cy = cluster.reduce((acc, e) => acc + e.y, 0) / cluster.length;
          clusters.push({ x: cx, y: cy, label, entities: cluster });
        }
      }
    }
    this.archetypes = clusters;
  }

  // ─── Rendering ──────────────────────────────────────────
  _renderStars() {
    const ctx = this.bgCtx;
    this._drawBackground();

    for (const star of this.bgStars) {
      const opacity = star.getOpacity(this.time);
      if (star.hue) {
        ctx.fillStyle = `hsla(${star.hue}, ${star.saturation}%, 80%, ${opacity})`;
      } else {
        ctx.fillStyle = `rgba(220, 225, 240, ${opacity})`;
      }
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _renderEntities() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();

    // Apply camera transform
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.width / 2 + this.camera.x, -this.height / 2 + this.camera.y);

    // Draw constellation lines
    for (const line of this.constellationLines) {
      ctx.beginPath();
      ctx.moveTo(line.x1, line.y1);
      ctx.lineTo(line.x2, line.y2);
      ctx.strokeStyle = `hsla(${line.color.h}, ${line.color.s}%, ${line.color.l}%, ${line.opacity * 0.1})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Draw trails
    if (this.showTrails) {
      for (const entity of this.entities) {
        if (entity.trail.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(entity.trail[0].x, entity.trail[0].y);
        for (let i = 1; i < entity.trail.length; i++) {
          ctx.lineTo(entity.trail[i].x, entity.trail[i].y);
        }
        ctx.strokeStyle = `hsla(${entity.color.h}, ${entity.color.s}%, ${entity.color.l}%, 0.15)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Draw entities
    for (const entity of this.entities) {
      this._renderEntity(ctx, entity);
    }

    // Draw particles
    for (const p of this.particles) {
      const opacity = p.getOpacity();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `hsla(${p.color.h}, ${p.color.s}%, ${p.color.l}%, ${opacity * 0.7})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * opacity, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();
  }

  _renderEntity(ctx, entity) {
    const scale = entity.birthScale;
    if (scale <= 0) return;

    const { x, y, color, type, radius, age } = entity;
    const r = radius * scale;
    const hsl = `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
    const hsla = (a) => `hsla(${color.h}, ${color.s}%, ${color.l}%, ${a})`;

    ctx.save();
    ctx.translate(x, y);

    // Draw History Rings for Ancients
    if (entity.stage === 'ancient') {
      ctx.strokeStyle = `hsla(${color.h}, ${color.s}%, 70%, 0.15)`;
      ctx.lineWidth = 0.5;
      for (const ring of entity.historyRings) {
        ctx.beginPath();
        ctx.arc(0, 0, ring.radius * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    switch (type) {
      case 'star': {
        const pulse = 1 + Math.sin(age * entity.pulseSpeed * 0.05) * 0.15;
        const sr = r * pulse;

        // Outer glow
        ctx.globalCompositeOperation = 'lighter';
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, sr * 8);
        glow.addColorStop(0, hsla(0.2));
        glow.addColorStop(0.3, hsla(0.05));
        glow.addColorStop(1, hsla(0));
        ctx.fillStyle = glow;
        ctx.fillRect(-sr * 8, -sr * 8, sr * 16, sr * 16);

        // Core
        const core = ctx.createRadialGradient(0, 0, 0, 0, 0, sr);
        core.addColorStop(0, `hsla(${color.h}, 20%, 95%, ${entity.luminosity})`);
        core.addColorStop(0.4, hsla(0.9));
        core.addColorStop(1, hsla(0));
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(0, 0, sr * 2, 0, Math.PI * 2);
        ctx.fill();

        // Light rays
        ctx.strokeStyle = hsla(0.15);
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI / 2) + age * 0.005;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * sr, Math.sin(a) * sr);
          ctx.lineTo(Math.cos(a) * sr * 4, Math.sin(a) * sr * 4);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        break;
      }

      case 'nebula': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.rotate(entity.rotation);

        for (const p of entity.cloudParticles) {
          const ph = (color.h + p.hueShift + 360) % 360;
          const grad = ctx.createRadialGradient(p.ox, p.oy, 0, p.ox, p.oy, p.size * scale);
          grad.addColorStop(0, `hsla(${ph}, ${color.s}%, ${color.l + 10}%, ${p.opacity * scale})`);
          grad.addColorStop(0.6, `hsla(${ph}, ${color.s}%, ${color.l}%, ${p.opacity * 0.3 * scale})`);
          grad.addColorStop(1, `hsla(${ph}, ${color.s}%, ${color.l}%, 0)`);
          ctx.fillStyle = grad;
          ctx.fillRect(p.ox - p.size, p.oy - p.size, p.size * 2, p.size * 2);
        }

        ctx.globalCompositeOperation = 'source-over';
        break;
      }

      case 'blackHole': {
        // Event horizon
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(0, 0, r * scale, 0, Math.PI * 2);
        ctx.fill();

        // Accretion disk
        ctx.globalCompositeOperation = 'lighter';
        const diskR = r * 4;
        for (let i = 0; i < 60; i++) {
          const a = entity.accretionAngle + (i / 60) * Math.PI * 2;
          const dist = r * 1.2 + Math.sin(i * 0.5 + age * 0.02) * r * 0.5;
          const px = Math.cos(a) * dist * 1.5;
          const py = Math.sin(a) * dist * 0.5;
          const size = 2 + Math.random() * 3;
          const hue = (color.h + i * 2 + 30) % 360;
          ctx.fillStyle = `hsla(${hue}, 90%, 60%, ${0.4 + Math.random() * 0.3})`;
          ctx.beginPath();
          ctx.arc(px, py, size * scale, 0, Math.PI * 2);
          ctx.fill();
        }

        // Gravitational lensing glow
        const lensGlow = ctx.createRadialGradient(0, 0, r, 0, 0, diskR);
        lensGlow.addColorStop(0, `hsla(${color.h + 30}, 80%, 50%, 0.15)`);
        lensGlow.addColorStop(0.5, `hsla(${color.h}, 60%, 40%, 0.05)`);
        lensGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = lensGlow;
        ctx.fillRect(-diskR, -diskR, diskR * 2, diskR * 2);

        ctx.globalCompositeOperation = 'source-over';
        break;
      }

      case 'redGiant': {
        const pulse = 1 + Math.sin(age * entity.pulseSpeed * 0.03) * 0.2;
        const sr = r * pulse;

        ctx.globalCompositeOperation = 'lighter';

        // Outer atmosphere
        const atmo = ctx.createRadialGradient(0, 0, sr * 0.5, 0, 0, sr * 6);
        atmo.addColorStop(0, `hsla(${color.h}, ${color.s}%, 70%, 0.3)`);
        atmo.addColorStop(0.3, `hsla(${color.h + 15}, ${color.s}%, 50%, 0.1)`);
        atmo.addColorStop(1, 'transparent');
        ctx.fillStyle = atmo;
        ctx.fillRect(-sr * 6, -sr * 6, sr * 12, sr * 12);

        // Core
        const coreG = ctx.createRadialGradient(0, 0, 0, 0, 0, sr);
        coreG.addColorStop(0, `hsla(${color.h + 30}, 30%, 90%, 0.95)`);
        coreG.addColorStop(0.3, `hsla(${color.h + 15}, ${color.s}%, 65%, 0.9)`);
        coreG.addColorStop(0.7, `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.7)`);
        coreG.addColorStop(1, 'transparent');
        ctx.fillStyle = coreG;
        ctx.beginPath();
        ctx.arc(0, 0, sr * 2, 0, Math.PI * 2);
        ctx.fill();

        // Flare eruptions
        if (Math.sin(entity.flareTimer * 0.015) > 0.8) {
          for (let i = 0; i < 3; i++) {
            const fa = age * 0.01 + i * 2.09;
            const fx = Math.cos(fa) * sr * 2;
            const fy = Math.sin(fa) * sr * 2;
            ctx.fillStyle = `hsla(${color.h + 30}, 100%, 70%, 0.3)`;
            ctx.beginPath();
            ctx.arc(fx, fy, sr * 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.globalCompositeOperation = 'source-over';
        break;
      }

      case 'comet': {
        const sr = r * scale;

        // Tail
        ctx.globalCompositeOperation = 'lighter';
        ctx.save();
        ctx.rotate(entity.beamAngle);
        const tailGrad = ctx.createLinearGradient(0, 0, entity.beamLength, 0);
        tailGrad.addColorStop(0, hsla(0.8));
        tailGrad.addColorStop(0.2, hsla(0.4));
        tailGrad.addColorStop(1, hsla(0));
        ctx.fillStyle = tailGrad;
        ctx.beginPath();
        ctx.moveTo(0, -sr);
        ctx.lineTo(entity.beamLength, -sr * 0.2);
        ctx.lineTo(entity.beamLength, sr * 0.2);
        ctx.lineTo(0, sr);
        ctx.fill();
        ctx.restore();

        // Core
        const coreG = ctx.createRadialGradient(0, 0, 0, 0, 0, sr * 2);
        coreG.addColorStop(0, 'rgba(255,255,255,0.95)');
        coreG.addColorStop(0.3, hsla(0.7));
        coreG.addColorStop(1, hsla(0));
        ctx.fillStyle = coreG;
        ctx.beginPath();
        ctx.arc(0, 0, sr * 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = 'source-over';
        break;
      }

      case 'planet': {
        const sr = r * scale;

        // Atmosphere glow
        ctx.globalCompositeOperation = 'lighter';
        const atmo = ctx.createRadialGradient(0, 0, sr * 0.8, 0, 0, sr * 2.5);
        atmo.addColorStop(0, hsla(0.1));
        atmo.addColorStop(1, hsla(0));
        ctx.fillStyle = atmo;
        ctx.beginPath();
        ctx.arc(0, 0, sr * 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        // Planet body
        const bodyGrad = ctx.createRadialGradient(-sr * 0.3, -sr * 0.3, 0, 0, 0, sr);
        bodyGrad.addColorStop(0, `hsl(${color.h}, ${color.s - 10}%, ${color.l + 20}%)`);
        bodyGrad.addColorStop(0.7, hsl);
        bodyGrad.addColorStop(1, `hsl(${color.h}, ${color.s}%, ${color.l - 15}%)`);
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(0, 0, sr, 0, Math.PI * 2);
        ctx.fill();

        // Ring
        if (entity.hasRing) {
          ctx.save();
          ctx.rotate(entity.ringAngle);
          ctx.scale(1, 0.3);
          ctx.strokeStyle = hsla(0.35);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, sr * 2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = hsla(0.2);
          ctx.beginPath();
          ctx.arc(0, 0, sr * 2.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        break;
      }

      case 'drifter': {
        ctx.globalCompositeOperation = 'lighter';

        // Ghostly cloud
        const cloud = ctx.createRadialGradient(0, 0, 0, 0, 0, r * scale);
        cloud.addColorStop(0, `hsla(${color.h}, ${color.s}%, ${color.l + 10}%, 0.08)`);
        cloud.addColorStop(0.5, `hsla(${color.h}, ${color.s}%, ${color.l}%, 0.03)`);
        cloud.addColorStop(1, 'transparent');
        ctx.fillStyle = cloud;
        ctx.fillRect(-r * scale, -r * scale, r * scale * 2, r * scale * 2);

        // Floating particles
        for (const p of entity.particles) {
          const px = Math.cos(p.angle) * p.dist * scale;
          const py = Math.sin(p.angle) * p.dist * scale;
          ctx.fillStyle = `hsla(${color.h}, ${color.s}%, ${color.l + 20}%, 0.3)`;
          ctx.beginPath();
          ctx.arc(px, py, p.size * scale, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalCompositeOperation = 'source-over';
        break;
      }

      case 'fastOrbit': {
        const sr = r * scale;
        ctx.globalCompositeOperation = 'lighter';
        ctx.save();
        ctx.rotate(entity.rotation);
        
        // Jagged fast core
        ctx.fillStyle = hsla(0.8);
        ctx.beginPath();
        ctx.moveTo(0, -sr);
        ctx.lineTo(sr * 0.5, 0);
        ctx.lineTo(0, sr);
        ctx.lineTo(-sr * 0.5, 0);
        ctx.fill();

        // High blur tail outline to simulate speed
        ctx.strokeStyle = hsla(0.3);
        ctx.lineWidth = sr;
        ctx.beginPath();
        ctx.arc(0, 0, sr * 2, 0, Math.PI);
        ctx.stroke();

        ctx.restore();
        ctx.globalCompositeOperation = 'source-over';
        break;
      }

      case 'dustCloud': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.rotate(entity.rotation);

        for (const p of entity.cloudParticles) {
          const ph = (color.h + p.hueShift + 360) % 360;
          // Greyish dust
          const grad = ctx.createRadialGradient(p.ox, p.oy, 0, p.ox, p.oy, p.size * scale);
          grad.addColorStop(0, `hsla(${ph}, 10%, 40%, ${p.opacity * scale})`);
          grad.addColorStop(0.6, `hsla(${ph}, 5%, 30%, ${p.opacity * 0.3 * scale})`);
          grad.addColorStop(1, `hsla(${ph}, 0%, 20%, 0)`);
          ctx.fillStyle = grad;
          ctx.fillRect(p.ox - p.size, p.oy - p.size, p.size * 2, p.size * 2);
        }

        ctx.globalCompositeOperation = 'source-over';
        break;
      }

      case 'lightArc': {
        const sr = r * scale;
        ctx.globalCompositeOperation = 'lighter';
        
        ctx.save();
        // A pulsing sweeping arc
        const pulse = Math.sin(entity.arcPulse) * 0.2 + 0.8;
        const outerR = sr * 3 * pulse;
        
        const arcGrad = ctx.createRadialGradient(0, 0, sr, 0, 0, outerR);
        arcGrad.addColorStop(0, `hsla(${color.h}, 90%, 80%, 0.9)`);
        arcGrad.addColorStop(0.5, `hsla(${color.h}, 70%, 60%, 0.4)`);
        arcGrad.addColorStop(1, 'transparent');
        
        ctx.fillStyle = arcGrad;
        ctx.beginPath();
        ctx.arc(0, 0, outerR, Math.PI, Math.PI * 2);
        ctx.fill();
        
        // Core seed
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, sr, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
    }

    // Draw Archetype Labels
    for (const arch of this.archetypes) {
      ctx.textAlign = 'center';
      ctx.font = '300 12px "Outfit", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillText(arch.label.toUpperCase(), arch.x, arch.y - 20);
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      arch.entities.forEach(e => {
        ctx.moveTo(arch.x, arch.y);
        ctx.lineTo(e.x, e.y);
      });
      ctx.stroke();
    }

    ctx.restore();
  }

  _renderFX() {
    const ctx = this.fxCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Vignette
    const vignette = ctx.createRadialGradient(
      this.width / 2, this.height / 2, this.width * 0.3,
      this.width / 2, this.height / 2, this.width * 0.7
    );
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, 'rgba(5, 5, 16, 0.6)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.width, this.height);

    // Hover Label
    if (this.hoverData) {
      ctx.save();
      const lx = this.hoverData.x + 15;
      const ly = this.hoverData.y + 15;
      ctx.textAlign = 'left';
      ctx.font = '600 11px "Outfit", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(this.hoverData.emotion.toUpperCase(), lx, ly);

      if (this.hoverData.text && this.hoverData.text.length > 0) {
        ctx.font = '300 10px "Space Mono", monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        const maxText = this.hoverData.text.length > 50 ? this.hoverData.text.slice(0, 47) + '...' : this.hoverData.text;
        ctx.fillText(maxText, lx, ly + 14);
      }
      ctx.restore();
    }

    // Draw Ripples
    for (const r of this.ripples) {
      ctx.save();
      // Ripples are in world space, so we need to transform
      ctx.translate(this.width / 2, this.height / 2);
      ctx.scale(this.camera.zoom, this.camera.zoom);
      ctx.translate(-this.width / 2 + this.camera.x, -this.height / 2 + this.camera.y);
      
      ctx.strokeStyle = `hsla(${r.color.h}, ${r.color.s}%, 80%, ${r.opacity})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  _updateGlobalMood() {
    if (this.entities.length === 0) return;
    const counts = {};
    for (const e of this.entities) counts[e.emotion] = (counts[e.emotion] || 0) + e.weight * e.intensity;
    
    let dominant = null, maxCount = 0;
    for (const em in counts) {
      if (counts[em] > maxCount) { maxCount = counts[em]; dominant = em; }
    }
    
    const rep = this.entities.find(e => e.emotion === dominant);
    if (rep) this.targetMoodColor = { h: rep.color.h, s: rep.color.s, l: 8 };

    let tension = 0;
    for (const e of this.entities) {
      if (['stress', 'anger', 'fear'].includes(e.emotion)) tension += e.intensity;
      else if (e.emotion === 'calm' || e.emotion === 'sadness') tension -= e.intensity;
    }
    
    const tensionRatio = tension / this.entities.length;
    this.globalTimeSpeedMulti = 1.0 + (tensionRatio * 0.5); // Fast for stress, slow for calm
  }

  // ─── Main Loop ──────────────────────────────────────────
  update() {
    if (!this.running) return;

    if (this.time % 60 === 0) this._updateGlobalMood();

    // Lerp mood colors
    this.moodColor.h += (this.targetMoodColor.h - this.moodColor.h) * 0.01;
    this.moodColor.s += (this.targetMoodColor.s - this.moodColor.s) * 0.01;
    this.moodColor.l += (this.targetMoodColor.l - this.moodColor.l) * 0.01;

    const dt = this.timeSpeed * this.globalTimeSpeedMulti;
    this.time++;
    this.universeAge += dt;

    // Cinematic Camera Control
    if (!this.camera.isCinematic && Date.now() > this.camera.manualTimeout) {
      this.camera.isCinematic = true; // Auto-resume
    }

    if (this.camera.isCinematic) {
      this.camera.x += (this.camera.targetX - this.camera.x) * 0.02;
      this.camera.y += (this.camera.targetY - this.camera.y) * 0.02;
      
      // Breathing effect
      this.camera.breathingPhase += 0.005;
      const breath = Math.sin(this.camera.breathingPhase) * 0.05;
      this.camera.zoom += ((this.camera.targetZoom + breath) - this.camera.zoom) * 0.03;
    } else {
      this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.08;
    }

    // Physics
    this._applyPhysics(dt);

    // Update entities
    for (const entity of this.entities) {
      entity.update(dt);
    }

    // Update particles
    for (const p of this.particles) {
      p.update(dt);
    }
    this.particles = this.particles.filter(p => p.alive);

    // Periodically update constellations & archetypes
    if (this.time % 60 === 0) {
      this._updateConstellations();
      this._updateArchetypes();
    }

    // Render
    if (this.time % 3 === 0) {
      this._renderStars();
    }
    this._renderEntities();
    // Render FX
    if (this.time % 10 === 0) {
      this._renderFX();
    }

    // Update Ripples
    for (const r of this.ripples) {
      r.r += 2;
      r.opacity *= 0.92;
      if (r.opacity < 0.01) r.alive = false;
    }
    this.ripples = this.ripples.filter(r => r.alive);
  }

  // ─── Public API ─────────────────────────────────────────
  getStats() {
    let totalMass = 0;
    let totalEnergy = 0;
    for (const e of this.entities) {
      totalMass += e.mass;
      const speed = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
      totalEnergy += 0.5 * e.mass * speed * speed;
    }
    return {
      entities: this.entities.length,
      mass: Math.round(totalMass),
      energy: Math.round(totalEnergy * 100) / 100
    };
  }

  getFormattedAge() {
    const totalSeconds = Math.floor(this.universeAge / 60);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  setTimeSpeed(v) {
    this.timeSpeed = v;
  }

  setGravity(v) {
    this.gravityStrength = v;
  }

  toggleTrails() {
    this.showTrails = !this.showTrails;
    return this.showTrails;
  }

  captureScreenshot() {
    // Composite all canvases into one
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.bgCanvas, 0, 0, this.width, this.height);
    ctx.drawImage(this.mainCanvas, 0, 0, this.width, this.height);
    ctx.drawImage(this.fxCanvas, 0, 0, this.width, this.height);

    // Watermark
    ctx.font = '12px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textAlign = 'right';
    ctx.fillText('Created with COSMOS', this.width - 16, this.height - 16);

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cosmos-universe-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  reset() {
    this.entities = [];
    this.particles = [];
    this.constellationLines = [];
    this.time = 0;
    this.universeAge = 0;
    this.camera = { 
      x: 0, y: 0, zoom: 1, 
      targetX: 0, targetY: 0, targetZoom: 1, 
      isCinematic: true, breathingPhase: 0, manualTimeout: 0 
    };
  }

  destroy() {
    this.running = false;
  }
}
