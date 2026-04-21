/**
 * LUMA — Main Application Entry Point
 * Wires together Universe, AudioEngine, EmotionEngine, Storage, and UI controls
 */

import './styles.css';
import { Universe } from './Universe.js';
import { AudioEngine } from './AudioEngine.js';
import { EmotionEngine } from './EmotionEngine.js';
import { StorageEngine } from './StorageEngine.js';
import { ReflectionEngine } from './ReflectionEngine.js';

// ─── DOM Elements ─────────────────────────────────────────
const introScreen = document.getElementById('intro-screen');
const introEnter = document.getElementById('intro-enter');
const introParticlesContainer = document.getElementById('intro-particles');
const lumaApp = document.getElementById('luma-app');

const bgCanvas = document.getElementById('bg-canvas');
const mainCanvas = document.getElementById('main-canvas');
const fxCanvas = document.getElementById('fx-canvas');

// Check-in Flow
const btnOpenCheckin = document.getElementById('btn-open-checkin');
const checkinModal = document.getElementById('checkin-modal');
const btnCloseCheckin = document.getElementById('btn-close-checkin');
const thoughtInput = document.getElementById('thought-input');
const intensitySlider = document.getElementById('intensity-slider');
const tagsGrid = document.getElementById('tags-grid');
const thoughtSubmit = document.getElementById('thought-submit');

// Dashboard & UI
const btnStats = document.getElementById('btn-stats');
const statsPanel = document.getElementById('stats-panel');
const statThoughts = document.getElementById('stat-thoughts');
const statRatio = document.getElementById('stat-ratio');
const statEmotion = document.getElementById('stat-emotion');
const statTags = document.getElementById('stat-tags');

// Memory Timeline
const btnMemory = document.getElementById('btn-memory');
const memoryTimeline = document.getElementById('memory-timeline');
const memoryList = document.getElementById('memory-list');
const memoryMainReflection = document.getElementById('memory-main-reflection');

// Top Bar
const streakValue = document.getElementById('streak-value');
const dailyPulseText = document.getElementById('daily-pulse-text');

// Floating elements
const floatingThought = document.getElementById('floating-thought');
const creationNotify = document.getElementById('creation-notify');
const notifyType = document.getElementById('notify-type');
const notifyName = document.getElementById('notify-name');
const notifyIcon = document.getElementById('notify-icon');

// Other Controls
const btnMusic = document.getElementById('btn-music');
const btnTrails = document.getElementById('btn-trails');
const btnScreenshot = document.getElementById('btn-screenshot');

// ─── Engines ──────────────────────────────────────────────
let universe = null;
const audio = new AudioEngine();
const emotion = new EmotionEngine();
const storage = new StorageEngine();
const reflection = new ReflectionEngine(storage);

let animFrameId = null;
let notifyTimeout = null;
let selectedTags = new Set();
let saveInterval = null;

// ─── Intro Particles ─────────────────────────────────────
function createIntroParticles() {
  for (let i = 0; i < 80; i++) {
    const particle = document.createElement('div');
    particle.className = 'intro-particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (4 + Math.random() * 8) + 's';
    particle.style.animationDelay = Math.random() * 8 + 's';
    particle.style.width = particle.style.height = (1 + Math.random() * 2) + 'px';
    if (Math.random() > 0.7) {
      particle.style.background = `hsl(${Math.random() > 0.5 ? 270 : 190}, 70%, 70%)`;
    }
    introParticlesContainer.appendChild(particle);
  }
}

// ─── Startup Logic & Hydration ────────────────────────────
async function enterUniverse() {
  await audio.init();
  audio.startAmbient();

  introScreen.classList.add('fade-out');
  
  setTimeout(() => {
    introScreen.style.display = 'none';
    lumaApp.classList.remove('hidden');

    universe = new Universe(bgCanvas, mainCanvas, fxCanvas);
    universe.reflection = reflection; 
    
    universe.onEntitySelected = (entity) => {
      audio.playCreation(entity.emotion); 
      const narrative = reflection.getClusterNarrative(entity.emotion, [entity]);
      dailyPulseText.textContent = narrative;
      dailyPulseText.style.color = `hsl(${entity.color.h}, 70%, 70%)`;
      
      // Auto-update stats dashboard to show details of selected
      statEmotion.textContent = entity.emotion.charAt(0).toUpperCase() + entity.emotion.slice(1);
    };

    // Hydrate existing universe state
    hydrateUniverse();

    function loop() {
      universe.update();
      animFrameId = requestAnimationFrame(loop);
    }
    loop();

    updateAllUI();
    
    // Auto-save entity positions sparsely
    saveInterval = setInterval(() => {
      if (universe) {
        storage.updateEntities(universe.getSerializableEntities());
      }
    }, 10000);

  }, 1200);
}

function hydrateUniverse() {
  const history = storage.getEntries();
  const savedEntities = storage.getEntities();

  // If we have saved specific entities, load them
  if (savedEntities && savedEntities.length > 0) {
    universe.loadEntities(savedEntities);
  } else {
    // If we only have entries (from older version perhaps), replay them silently
    // But since it's a new system, this is a fallback.
    history.forEach(entry => {
      const data = emotion.analyze(entry.text);
      data.intensity = entry.intensity;
      universe.addThoughtSilent(data);
    });
  }

  // Pre-load emotion engine stats so dashboard matches
  history.forEach(entry => {
    emotion.emotionCounts[entry.emotion] = (emotion.emotionCounts[entry.emotion] || 0) + 1;
    emotion.history.push({ text: entry.text, emotion: entry.emotion, time: entry.timestamp });
  });
}

// ─── Check-In Logic ───────────────────────────────────────
function openCheckin() {
  checkinModal.classList.remove('hidden');
  thoughtInput.focus();
}

function closeCheckin() {
  checkinModal.classList.add('hidden');
}

tagsGrid.addEventListener('click', (e) => {
  if (e.target.classList.contains('tag-btn')) {
    const tag = e.target.getAttribute('data-tag');
    if (selectedTags.has(tag)) {
      selectedTags.delete(tag);
      e.target.classList.remove('active');
    } else {
      selectedTags.add(tag);
      e.target.classList.add('active');
    }
  }
});

function submitThought() {
  const text = thoughtInput.value.trim();
  if (!text && selectedTags.size === 0) return; // Allow empty text if tags exist

  const analyzedText = text || Array.from(selectedTags).join(' ');
  const emotionData = emotion.analyze(analyzedText);
  // Override intensity with slider
  const userIntensity = parseInt(intensitySlider.value);
  emotionData.intensity = userIntensity === 1 ? 0.4 : userIntensity === 2 ? 0.7 : 1.0;

  // Create in Universe
  const entity = universe.addThought(emotionData);
  
  // Save to Storage
  const saved = storage.saveEntry(
    text, 
    emotionData.intensity, 
    Array.from(selectedTags), 
    emotionData, 
    entity.id
  );

  // FX & UI updates
  audio.playCreation(emotionData);
  if (text) showFloatingThought(text);
  showCreationNotify(emotionData, entity);
  
  // Phase 3: Interactive Perspective
  const insight = reflection.getClusterNarrative(emotionData.emotion, [entity]);
  dailyPulseText.textContent = insight;

  updateAllUI();

  // Reset form
  thoughtInput.value = '';
  selectedTags.clear();
  document.querySelectorAll('.tag-btn.active').forEach(b => b.classList.remove('active'));
  intensitySlider.value = 2;
  closeCheckin();
}

// ─── UI & Visual FX ───────────────────────────────────────

function showFloatingThought(text) {
  floatingThought.textContent = text;
  floatingThought.classList.remove('hidden');
  floatingThought.style.left = '50%';
  floatingThought.style.top = '50%';
  floatingThought.style.animation = 'none';
  floatingThought.offsetHeight; 
  floatingThought.style.animation = 'thought-rise 3s ease-out forwards';
  setTimeout(() => floatingThought.classList.add('hidden'), 3000);
}

const ENTITY_DISPLAY_NAMES = {
  star: '✦ Star',
  nebula: '☁ Nebula',
  blackHole: '◉ Black Hole',
  redGiant: '✶ Red Giant',
  comet: '☄ Comet',
  planet: '● Planet',
  drifter: '◌ Drifter',
  fastOrbit: '⟳ Fragment',
  dustCloud: '〰 Dust Cloud',
  lightArc: '☽ Light Arc'
};

const EMOTION_COLORS = {
  joy: '#f59e0b',
  love: '#ec4899',
  sadness: '#3b82f6',
  anger: '#ef4444',
  fear: '#6d28d9',
  wonder: '#14b8a6',
  calm: '#22c55e',
  stress: '#f97316',
  confusion: '#94a3b8',
  hope: '#fef08a'
};

function showCreationNotify(emotionData, entity) {
  notifyType.textContent = `${emotionData.emotion} Detected`;
  notifyName.textContent = ENTITY_DISPLAY_NAMES[emotionData.entityType] || emotionData.entityType;
  
  const color = EMOTION_COLORS[emotionData.emotion] || '#8b5cf6';
  notifyIcon.style.background = `radial-gradient(circle, ${color}, ${color}88)`;
  notifyIcon.style.boxShadow = `0 0 20px ${color}66`;

  creationNotify.classList.remove('hidden', 'fade-out');
  if (notifyTimeout) clearTimeout(notifyTimeout);
  notifyTimeout = setTimeout(() => {
    creationNotify.classList.add('fade-out');
    setTimeout(() => creationNotify.classList.add('hidden'), 400);
  }, 2500);
}

function updateAllUI() {
  // Streak
  streakValue.textContent = `${storage.getStreak()} days`;

  // Memory Layer
  updateMemoryList();

  // Reflections
  const currentInsight = reflection.generateInsight();
  memoryMainReflection.textContent = currentInsight.main;
  dailyPulseText.textContent = storage.hasCheckedInToday() 
    ? "Universe actively expanding today." 
    : "Your universe is quiet today.";

  // Stats Dashboard
  const stats = storage.getStats();
  statThoughts.textContent = stats.totalEntries;
  
  const domE = Object.entries(stats.emotionCounts).sort((a,b)=>b[1]-a[1])[0];
  statEmotion.textContent = domE ? domE[0].charAt(0).toUpperCase() + domE[0].slice(1) : 'Void';

  let heavy = 0; let calm = 0;
  Object.entries(stats.emotionCounts).forEach(([e, c]) => {
    if(['stress','anger','fear'].includes(e)) heavy += c;
    else if(['calm','peace','joy','love','hope'].includes(e)) calm += c;
  });
  statRatio.textContent = (calm>heavy) ? 'Calm-Dominant' : (heavy>calm) ? 'Stress-Dominant' : 'Balanced';

  // Extract top tags
  const tagsMap = {};
  storage.getEntries().forEach(e => {
    e.tags.forEach(t => tagsMap[t] = (tagsMap[t]||0)+1);
  });
  const topTags = Object.entries(tagsMap).sort((a,b)=>b[1]-a[1]).slice(0, 3);
  statTags.innerHTML = topTags.map(t => `<span class="memory-tag">${t[0]}</span>`).join('');
}

function updateMemoryList() {
  memoryList.innerHTML = '';
  const entries = storage.getRecentEntries(30).reverse().slice(0, 50); // Last 50 max for UI
  
  entries.forEach(entry => {
    const li = document.createElement('li');
    
    // Formatting date
    const d = new Date(entry.timestamp);
    const timeStr = `${d.getMonth()+1}/${d.getDate()} · ${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`;
    
    const tagsHtml = entry.tags.map(t => `<span class="memory-tag">${t}</span>`).join('');
    
    li.innerHTML = `
      <div class="memory-meta">
        <span>${timeStr}</span>
        <span style="color: ${EMOTION_COLORS[entry.emotion] || '#fff'}">${entry.emotion}</span>
      </div>
      <p class="memory-text">${escapeHtml(entry.text || '*Silent Check-in*')}</p>
      <div class="memory-tags">${tagsHtml}</div>
    `;
    memoryList.appendChild(li);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Event Listeners ──────────────────────────────────────
introEnter.addEventListener('click', enterUniverse);
btnOpenCheckin.addEventListener('click', openCheckin);
btnCloseCheckin.addEventListener('click', closeCheckin);
thoughtSubmit.addEventListener('click', submitThought);

btnStats.addEventListener('click', () => {
  statsPanel.classList.toggle('hidden');
  if(!statsPanel.classList.contains('hidden') && !memoryTimeline.classList.contains('hidden')){
    memoryTimeline.classList.add('hidden');
    btnMemory.classList.remove('active');
  }
});

btnMemory.addEventListener('click', () => {
  memoryTimeline.classList.toggle('hidden');
  btnMemory.classList.toggle('active');
  if(!memoryTimeline.classList.contains('hidden') && !statsPanel.classList.contains('hidden')){
    statsPanel.classList.add('hidden');
  }
});

btnMusic.addEventListener('click', () => {
  const playing = audio.toggle();
  btnMusic.classList.toggle('active', playing);
});

btnTrails.addEventListener('click', () => {
  if (universe) {
    const on = universe.toggleTrails();
    btnTrails.classList.toggle('active', on);
  }
});

btnScreenshot.addEventListener('click', () => {
  universe?.captureScreenshot();
});

// Avoid triggering spacebar when writing in textareas
document.addEventListener('keydown', (e) => {
  if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') return;
  
  switch (e.key) {
    case 'c':
    case 'C':
      openCheckin();
      break;
    case 'Escape':
      closeCheckin();
      statsPanel.classList.add('hidden');
      memoryTimeline.classList.add('hidden');
      btnMemory.classList.remove('active');
      break;
  }
});

// Prevent context menu on canvas
mainCanvas?.addEventListener('contextmenu', (e) => e.preventDefault());

// ─── Initialize ───────────────────────────────────────────
createIntroParticles();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // handled by vite pwa
  });
}
