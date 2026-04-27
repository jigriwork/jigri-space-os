import './styles.css';
import { Universe } from './Universe.js';
import { AudioEngine } from './AudioEngine.js';
import { StorageEngine } from './StorageEngine.js';
import { AuthClient } from './AuthClient.js';
import GeminiProvider from './ai/GeminiProvider.js';

const homeScreen = document.getElementById('home-screen');
const homeStars = document.getElementById('home-stars');
const homeCTA = document.getElementById('home-cta');
const homeIntentions = document.getElementById('home-intentions');
const jigriApp = document.getElementById('jigri-app');

const bgCanvas = document.getElementById('bg-canvas');
const mainCanvas = document.getElementById('main-canvas');
const fxCanvas = document.getElementById('fx-canvas');

const dumpInput = document.getElementById('dump-input');
const dumpRelease = document.getElementById('dump-release');
const dumpContainer = document.getElementById('dump-container');

const breathingGuide = document.getElementById('breathing-guide');
const breathLabel = document.getElementById('breath-label');
const conversationThread = document.getElementById('conversation-thread');
const sessionEnd = document.getElementById('session-end');
const presencePanel = document.getElementById('presence-panel');
const presenceKicker = document.getElementById('presence-kicker');
const presenceState = document.getElementById('presence-state');
const controlsPanel = document.getElementById('controls-panel');
const btnMenu = document.getElementById('btn-menu');
const btnHome = document.getElementById('btn-home');
const btnMood = document.getElementById('btn-mood');
const btnMusic = document.getElementById('btn-music');
const btnVolume = document.getElementById('btn-volume');
const btnMode = document.getElementById('btn-mode');
const btnRitual = document.getElementById('btn-ritual');
const ritualPanel = document.getElementById('ritual-panel');
const ritualClose = document.getElementById('ritual-close');
const ritualTabs = document.getElementById('ritual-tabs');
const sparkField = document.getElementById('spark-field');
const ritualProgressFill = document.getElementById('ritual-progress-fill');
const moodPanel = document.getElementById('mood-panel');
const moodClose = document.getElementById('mood-close');
const moodOptions = document.getElementById('mood-options');

const universe = new Universe(bgCanvas, mainCanvas, fxCanvas);
const audio = new AudioEngine();
const ai = new GeminiProvider();
const storage = new StorageEngine();
const auth = new AuthClient(ai, storage);

document.title = 'Jigri | someone to talk to';

let isProcessing = false;
let appStarted = false;
let messageCount = 0;  // tracks how many exchanges have happened
const AUTH_GRACE_MESSAGES = 2;

let authInviteShown = false;
let authPromptInFlight = false;
let authPromptSkippedAt = 0;
let selectedIntention = 'vent';
let ritualActive = false;
let releasedSparks = 0;
let ritualType = 'sparks';
let controlsOpen = false;

const recentTurns = [];
const lightMemory = [];

const INTENTION_COPY = {
    vent: {
        emotion: 'stress',
        intensity: 0.52,
        cta: 'Start talking',
        placeholder: 'Let it out. What happened?',
        greeting: [
            'Okay. Let it out. What happened?',
            'I\'m here. Start with the part that feels loudest.',
            'Chal, bata. No filter needed.'
        ]
    },
    breathe: {
        emotion: 'calm',
        intensity: 0.32,
        cta: 'Breathe with Jigri',
        placeholder: 'Write one thing your body is holding...',
        greeting: [
            'Slow start. What is your body holding right now?',
            'Let\'s make the room quieter. What feels tense?',
            'One breath first. Then tell me what\'s here.'
        ]
    },
    think: {
        emotion: 'confusion',
        intensity: 0.42,
        cta: 'Untangle it',
        placeholder: 'What are you trying to figure out?',
        greeting: [
            'Okay, we\'ll untangle it slowly. What is the main knot?',
            'Put the messy version here. We can sort it together.',
            'What question keeps looping?'
        ]
    },
    celebrate: {
        emotion: 'calm',
        intensity: 0.48,
        cta: 'Share the good',
        placeholder: 'Tell me the good thing...',
        greeting: [
            'Acha, good news first. What happened?',
            'I want to hear the win. Tell me everything.',
            'Let\'s hold the good part for a second. What went right?'
        ]
    }
};

const MODE_LABELS = {
    sanctuary: 'SANC',
    moonroom: 'MOON',
    cedar: 'CEDR',
    rainhouse: 'RAIN',
    cloudbed: 'CLD',
    deepsea: 'SEA',
    twilight: 'TWI',
    exhale: 'EXH',
    velvet: 'VELV',
    dawn: 'DAWN'
};

const EMOTION_COPY = {
    calm: {
        kicker: 'soft signal',
        state: 'holding the good feeling',
        breath: 'letting the good part land...'
    },
    stress: {
        kicker: 'pressure detected',
        state: 'making room around it',
        breath: 'loosening the knot...'
    },
    anger: {
        kicker: 'heat detected',
        state: 'letting it burn safely',
        breath: 'cooling the edges...'
    },
    fear: {
        kicker: 'fear detected',
        state: 'bringing the ground closer',
        breath: 'finding the floor again...'
    },
    confusion: {
        kicker: 'fog detected',
        state: 'finding one clear thread',
        breath: 'untangling the noise...'
    },
    sadness: {
        kicker: 'heavy weather',
        state: 'staying close and quiet',
        breath: 'sitting with the weight...'
    }
};

// ─── Home stars ───────────────────────────────────────────────

function createHomeStars() {
    if (!homeStars) return;
    for (let i = 0; i < 90; i++) {
        const s = document.createElement('span');
        s.className = 'home-star';
        s.style.left = `${Math.random() * 100}%`;
        s.style.top = `${Math.random() * 100}%`;
        s.style.animationDelay = `${Math.random() * 4.5}s`;
        s.style.animationDuration = `${3.5 + Math.random() * 6}s`;
        s.style.opacity = `${0.2 + Math.random() * 0.8}`;
        homeStars.appendChild(s);
    }
}

function loop() {
    universe.update();
    requestAnimationFrame(loop);
}

async function init() {
    if (appStarted) return;
    appStarted = true;

    await audio.init();
    audio.startAmbient();
    btnMusic.classList.add('active');
    updateModeButton(audio.getCurrentModeName());
    updateVolumeButton();

    const echoes = storage.getEchoes();
    if (echoes.length) universe.loadMemoryEchoes(echoes);

    await auth.restore();

    // First message placeholder
    const intention = INTENTION_COPY[selectedIntention] || INTENTION_COPY.vent;
    dumpInput.placeholder = intention.placeholder;
    dumpInput.focus();
    loop();

    // Welcome greeting — Jigri speaks first
    setTimeout(() => {
        const greetings = intention.greeting || [
            'Hey. What\'s going on today?',
            'Hi. How\'s your day been?'
        ];
        const pick = greetings[Math.floor(Math.random() * greetings.length)];
        appendJigriMessage(pick);
        trackRecentTurn('assistant', pick, { mode: selectedIntention });
    }, 1200);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickOne(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function setEmotionalState(emotion = 'calm', intensity = 0.35) {
    const state = EMOTION_COPY[emotion] || EMOTION_COPY.stress;
    document.body.dataset.emotion = emotion;
    document.body.style.setProperty('--emotion-intensity', String(Math.max(0.2, Math.min(1, intensity))));
    if (presenceKicker) presenceKicker.textContent = state.kicker;
    if (presenceState) presenceState.textContent = state.state;
    if (breathLabel) breathLabel.textContent = state.breath;
    presencePanel?.classList.add('presence-shift');
    setTimeout(() => presencePanel?.classList.remove('presence-shift'), 760);
    universe.setEmotionalWeather?.(emotion, intensity);
}

function autosizeInput() {
    dumpInput.style.height = 'auto';
    dumpInput.style.height = `${Math.min(dumpInput.scrollHeight, Math.floor(window.innerHeight * 0.28))}px`;
}

function updateModeButton(modeName) {
    if (!btnMode) return;
    const label = MODE_LABELS[modeName] || String(modeName || 'mode').slice(0, 4).toUpperCase();
    btnMode.textContent = label;
    btnMode.title = `Sound mode: ${modeName}`;
    btnMode.setAttribute('aria-label', `Sound mode: ${modeName}`);
}

function updateVolumeButton(level = audio.volumePresetIndex, value = audio.volumePresets?.[audio.volumePresetIndex]) {
    if (!btnVolume) return;
    const safeLevel = Number.isFinite(level) ? level : 0;
    const safeValue = Number.isFinite(value) ? value : 0;
    btnVolume.textContent = `V${safeLevel + 1}`;
    btnVolume.title = `Volume: ${Math.round(safeValue * 100)}%`;
    btnVolume.setAttribute('aria-label', `Volume: ${Math.round(safeValue * 100)}%`);
}

function setControlsOpen(open) {
    controlsOpen = open;
    controlsPanel?.classList.toggle('open', open);
    if (btnMenu) {
        btnMenu.textContent = open ? '×' : '☰';
        btnMenu.title = open ? 'Close menu' : 'Open menu';
        btnMenu.setAttribute('aria-label', btnMenu.title);
        btnMenu.setAttribute('aria-expanded', String(open));
    }
}

function closeControlsOnSmallScreen() {
    if (window.matchMedia?.('(max-width: 760px)').matches) {
        setControlsOpen(false);
    }
}

function chooseIntention(intention) {
    selectedIntention = INTENTION_COPY[intention] ? intention : 'vent';
    const copy = INTENTION_COPY[selectedIntention];
    if (homeScreen) {
        homeScreen.dataset.intention = selectedIntention;
        homeScreen.classList.remove('intention-shift');
        requestAnimationFrame(() => homeScreen.classList.add('intention-shift'));
    }
    homeIntentions?.querySelectorAll('.intention-chip').forEach((chip) => {
        const isActive = chip.dataset.intention === selectedIntention;
        chip.classList.toggle('active', isActive);
        chip.setAttribute('aria-pressed', String(isActive));
    });
    if (homeCTA) homeCTA.textContent = copy.cta;
    moodOptions?.querySelectorAll('.mood-option').forEach((option) => {
        const isActive = option.dataset.intention === selectedIntention;
        option.classList.toggle('active', isActive);
        option.setAttribute('aria-pressed', String(isActive));
    });
    if (dumpInput && appStarted) dumpInput.placeholder = copy.placeholder;
    setEmotionalState(copy.emotion, copy.intensity);
}

function initHomeParallax() {
    if (!homeScreen) return;
    let raf = 0;
    const setParallax = (clientX, clientY) => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
            const x = (clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
            const y = (clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
            homeScreen.style.setProperty('--home-bg-x', `${(x * 18).toFixed(1)}px`);
            homeScreen.style.setProperty('--home-bg-y', `${(y * 14).toFixed(1)}px`);
            homeScreen.style.setProperty('--home-aurora-x', `${(x * -10).toFixed(1)}px`);
            homeScreen.style.setProperty('--home-aurora-y', `${(y * -8).toFixed(1)}px`);
            homeScreen.style.setProperty('--home-orb-x', `${(x * 8).toFixed(1)}px`);
            homeScreen.style.setProperty('--home-orb-y', `${(y * 8).toFixed(1)}px`);
            homeScreen.style.setProperty('--home-ring-x', `${(x * 12).toFixed(1)}px`);
            homeScreen.style.setProperty('--home-ring-y', `${(y * 10).toFixed(1)}px`);
            homeScreen.style.setProperty('--home-content-x', `${(x * 4).toFixed(1)}px`);
            homeScreen.style.setProperty('--home-content-y', `${(y * 3).toFixed(1)}px`);
        });
    };

    homeScreen.addEventListener('pointermove', (e) => setParallax(e.clientX, e.clientY));
    homeScreen.addEventListener('pointerleave', () => setParallax(window.innerWidth / 2, window.innerHeight / 2));
    homeScreen.addEventListener('touchmove', (e) => {
        const touch = e.touches?.[0];
        if (touch) setParallax(touch.clientX, touch.clientY);
    }, { passive: true });
}

function switchMood(intention) {
    chooseIntention(intention);
    const copy = INTENTION_COPY[selectedIntention] || INTENTION_COPY.vent;
    closeMoodPanel();
    universe.addRipple?.({ emotion: copy.emotion, intensity: copy.intensity });
    appendJigriMessage(pickOne(copy.greeting));
    trackRecentTurn('assistant', `Switched to ${selectedIntention} mode.`, { mode: selectedIntention });
    dumpInput?.focus();
}

function trackLightMemory(userText, emotion = 'stress') {
    const text = userText.trim();
    if (!text || text.length < 12) return;

    const lowered = text.toLowerCase();
    const markers = [
        { key: 'business_pressure', test: /(business|startup|client|sales|revenue|work pressure|target|deadline)/i },
        { key: 'night_heavy', test: /(night|nights|late night|can.?t sleep|insomnia|sleep)/i },
        { key: 'relationship', test: /(breakup|partner|relationship|gf|bf|wife|husband)/i },
        { key: 'lonely', test: /(lonely|alone|no one|isolated)/i },
        { key: 'family', test: /(family|parents|mother|father|home)/i }
    ];

    const marker = markers.find((m) => m.test.test(lowered));
    const summary = text.length > 96 ? `${text.slice(0, 93)}...` : text;

    const entry = {
        id: marker?.key || `note_${Date.now()}`,
        emotion,
        summary,
        createdAt: Date.now()
    };

    const existingIndex = marker ? lightMemory.findIndex((m) => m.id === marker.key) : -1;
    if (existingIndex >= 0) {
        lightMemory[existingIndex] = entry;
    } else {
        lightMemory.push(entry);
        if (lightMemory.length > 5) lightMemory.shift();
    }
}

function trackRecentTurn(role, content, meta = {}) {
    recentTurns.push({ role, content, ...meta, ts: Date.now() });
    if (recentTurns.length > 12) recentTurns.shift();
}

function maybeShowAuthInvite() {
    if (authInviteShown) return;
    authInviteShown = true;
    // Delay the auth invite so it doesn't stack right after a reply
    setTimeout(() => {
        const invites = [
            'By the way, if you want me to remember our conversations, I can do that. Just need your email.',
            'Hey, quick thing. I can remember what we talk about if you sign in. No pressure though.',
            'If you want me to actually remember this stuff next time, drop your email. Otherwise, no worries.'
        ];
        appendJigriMessage(invites[Math.floor(Math.random() * invites.length)]);
    }, 3500);
}

function maybeTriggerAuthAfterReply() {
    const hasSession = !!auth.getAccessToken();
    if (hasSession || authPromptInFlight) return;

    const now = Date.now();
    const cooldownMs = 60 * 1000;
    if (now - authPromptSkippedAt < cooldownMs) return;
    if (messageCount < AUTH_GRACE_MESSAGES) return;

    authPromptInFlight = true;
    setTimeout(async () => {
        try {
            await auth.ensureSession();
        } catch (_e) {
            authPromptSkippedAt = Date.now();
            console.info('Jigri: auth skipped, continuing conversation.');
        } finally {
            authPromptInFlight = false;
        }
    }, 220);
}

function initKeyboardSafeLayout() {
    const root = document.documentElement;
    const setOffset = () => {
        const vv = window.visualViewport;
        if (!vv) {
            root.style.setProperty('--keyboard-offset', '0px');
            return;
        }

        const keyboardHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        const offset = keyboardHeight > 90 ? keyboardHeight : 0;
        root.style.setProperty('--keyboard-offset', `${offset}px`);
    };

    setOffset();
    window.addEventListener('resize', setOffset);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', setOffset);
        window.visualViewport.addEventListener('scroll', setOffset);
    }
}

// ─── Conversation thread helpers ──────────────────────────────

function appendUserMessage(text) {
    if (!conversationThread) return;
    const el = document.createElement('div');
    el.className = 'msg-user';
    el.textContent = text;
    conversationThread.appendChild(el);
    conversationThread.scrollTop = conversationThread.scrollHeight;
}

function appendTypingBubble() {
    if (!conversationThread) return null;
    const wrap = document.createElement('div');
    wrap.className = 'msg-jigri msg-typing';

    const label = document.createElement('span');
    label.className = 'msg-jigri-label';
    label.textContent = 'Jigri';

    const bubble = document.createElement('div');
    bubble.className = 'msg-jigri-text';

    const dots = document.createElement('div');
    dots.className = 'typing-dots';
    dots.innerHTML = '<span></span><span></span><span></span>';

    bubble.appendChild(dots);
    wrap.appendChild(label);
    wrap.appendChild(bubble);
    conversationThread.appendChild(wrap);
    conversationThread.scrollTop = conversationThread.scrollHeight;
    return wrap;
}

function appendJigriMessage(text) {
    if (!conversationThread) return;
    const wrap = document.createElement('div');
    wrap.className = 'msg-jigri';

    const label = document.createElement('span');
    label.className = 'msg-jigri-label';
    label.textContent = 'Jigri';

    const bubble = document.createElement('p');
    bubble.className = 'msg-jigri-text';
    bubble.textContent = text;

    wrap.appendChild(label);
    wrap.appendChild(bubble);
    conversationThread.appendChild(wrap);
    conversationThread.scrollTop = conversationThread.scrollHeight;
    requestAnimationFrame(() => wrap.classList.add('settled'));
}

function closeRitual() {
    ritualActive = false;
    ritualPanel?.classList.add('hidden');
    btnRitual?.classList.remove('active');
}

function openMoodPanel() {
    closeRitual();
    chooseIntention(selectedIntention);
    moodPanel?.classList.remove('hidden');
    btnMood?.classList.add('active');
    closeControlsOnSmallScreen();
}

function closeMoodPanel() {
    moodPanel?.classList.add('hidden');
    btnMood?.classList.remove('active');
}

function showHome() {
    closeRitual();
    closeMoodPanel();
    jigriApp.classList.add('hidden');
    homeScreen.classList.remove('hidden', 'fade-out');
    chooseIntention(selectedIntention);
    closeControlsOnSmallScreen();
}

function finishRitual() {
    const closingLines = ritualType === 'orbit'
        ? [
            'Good. Your breath found a slower lane.',
            'There. The room softened a little.',
            'Nice. You gave your body a calmer rhythm.'
        ]
        : ritualType === 'threads'
            ? [
                'There. One thread at a time. That is enough.',
                'Good. The knot is not the whole story.',
                'Nice. The mess has edges now.'
            ]
            : ritualType === 'flame'
                ? [
                    'Good. The heat has somewhere softer to go now.',
                    'There. Still strong, just less sharp.',
                    'Nice. You cooled the edge without swallowing it.'
                ]
                : ritualType === 'flow'
                    ? [
                        'Nice. Your focus found a path through the noise.',
                        'Good. One small step at a time can still move the whole room.',
                        'There. The scattered parts lined up for a second.'
                    ]
                    : ritualType === 'balance'
                        ? [
                            'Good catch. Your timing is softer now.',
                            'Nice. You found the calm window a few times.',
                            'There. The body got a small rhythm back.'
                        ]
        : [
            'There. A little lighter. Not fixed, just less clenched.',
            'Nice. You gave the pressure somewhere to go.',
            'Good. The room feels a bit quieter now.'
        ];
    const closingLine = pickOne(closingLines);
    universe.addRipple?.({ emotion: 'calm', intensity: 0.5 });
    setEmotionalState('calm', 0.36);
    appendJigriMessage(closingLine);
    trackRecentTurn('assistant', closingLine, { mode: 'ritual' });
    setTimeout(closeRitual, 720);
}

function releaseSpark(spark) {
    if (!ritualActive || spark.classList.contains('released')) return;
    spark.classList.add('released');
    releasedSparks += 1;
    const total = sparkField?.querySelectorAll('.spark').length || 1;
    const progress = Math.min(1, releasedSparks / total);
    if (ritualProgressFill) ritualProgressFill.style.transform = `scaleX(${progress})`;
    universe.addRipple?.({ emotion: releasedSparks % 2 ? 'stress' : 'calm', intensity: 0.28 + progress * 0.32 });
    audio.playCreation?.({ intensity: 0.32, audioNote: releasedSparks % 2 ? 'C4' : 'G4' });
    if (releasedSparks >= total) finishRitual();
}

function releaseOrbitStep(orb) {
    if (!ritualActive || ritualType !== 'orbit') return;
    releasedSparks += 1;
    const total = 5;
    const progress = Math.min(1, releasedSparks / total);
    if (ritualProgressFill) ritualProgressFill.style.transform = `scaleX(${progress})`;
    orb.classList.remove('pulse-now');
    requestAnimationFrame(() => orb.classList.add('pulse-now'));
    universe.addRipple?.({ emotion: 'calm', intensity: 0.25 + progress * 0.26 });
    audio.playCreation?.({ intensity: 0.25, audioNote: releasedSparks % 2 ? 'C4' : 'G4' });
    if (releasedSparks >= total) finishRitual();
}

function releaseThreadKnot(knot) {
    if (!ritualActive || ritualType !== 'threads' || knot.classList.contains('released')) return;
    knot.classList.add('released');
    releasedSparks += 1;
    const total = sparkField?.querySelectorAll('.thread-knot').length || 1;
    const progress = Math.min(1, releasedSparks / total);
    if (ritualProgressFill) ritualProgressFill.style.transform = `scaleX(${progress})`;
    sparkField?.style.setProperty('--thread-calm', String(progress));
    universe.addRipple?.({ emotion: 'confusion', intensity: 0.22 + progress * 0.3 });
    audio.playCreation?.({ intensity: 0.26, audioNote: releasedSparks % 2 ? 'D4' : 'A3' });
    if (releasedSparks >= total) finishRitual();
}

function coolFlameStep(target) {
    if (!ritualActive || ritualType !== 'flame' || target.classList.contains('cooled')) return;
    target.classList.add('cooled');
    releasedSparks += 1;
    const total = sparkField?.querySelectorAll('.flame-cool-point').length || 1;
    const progress = Math.min(1, releasedSparks / total);
    if (ritualProgressFill) ritualProgressFill.style.transform = `scaleX(${progress})`;
    sparkField?.style.setProperty('--flame-calm', String(progress));
    universe.addRipple?.({ emotion: releasedSparks >= total ? 'calm' : 'anger', intensity: 0.28 + progress * 0.28 });
    audio.playCreation?.({ intensity: 0.24, audioNote: releasedSparks % 2 ? 'E3' : 'G3' });
    if (releasedSparks >= total) finishRitual();
}

function releaseFlowStep(node) {
    if (!ritualActive || ritualType !== 'flow' || node.classList.contains('complete')) return;
    const expected = releasedSparks + 1;
    const step = Number(node.dataset.step || 0);
    if (step !== expected) {
        node.classList.remove('miss');
        requestAnimationFrame(() => node.classList.add('miss'));
        audio.playCreation?.({ intensity: 0.14, audioNote: 'C3' });
        return;
    }

    node.classList.add('complete');
    releasedSparks += 1;
    const total = sparkField?.querySelectorAll('.flow-node').length || 1;
    const progress = Math.min(1, releasedSparks / total);
    sparkField?.style.setProperty('--flow-progress', String(progress));
    if (ritualProgressFill) ritualProgressFill.style.transform = `scaleX(${progress})`;
    universe.addRipple?.({ emotion: 'confusion', intensity: 0.22 + progress * 0.28 });
    audio.playCreation?.({ intensity: 0.24, audioNote: releasedSparks % 2 ? 'E4' : 'A4' });
    if (releasedSparks >= total) finishRitual();
}

function catchBalanceBeat(target) {
    if (!ritualActive || ritualType !== 'balance') return;
    const duration = Number(target.dataset.duration || 2200);
    const startedAt = Number(target.dataset.startedAt || performance.now());
    const phase = ((performance.now() - startedAt) % duration) / duration;
    const position = 0.5 + Math.sin(phase * Math.PI * 2) * 0.42;
    const hit = Math.abs(position - 0.5) <= 0.105;

    if (!hit) {
        target.classList.remove('hit', 'miss');
        requestAnimationFrame(() => target.classList.add('miss'));
        audio.playCreation?.({ intensity: 0.12, audioNote: 'D3' });
        return;
    }

    releasedSparks += 1;
    const total = 5;
    const progress = Math.min(1, releasedSparks / total);
    sparkField?.style.setProperty('--balance-calm', String(progress));
    if (ritualProgressFill) ritualProgressFill.style.transform = `scaleX(${progress})`;
    target.querySelector('strong').textContent = `${total - releasedSparks} more`;
    universe.addRipple?.({ emotion: 'calm', intensity: 0.24 + progress * 0.28 });
    audio.playCreation?.({ intensity: 0.25, audioNote: releasedSparks % 2 ? 'G4' : 'C5' });
    target.classList.remove('hit', 'miss');
    requestAnimationFrame(() => target.classList.add('hit'));
    if (releasedSparks >= total) finishRitual();
}

function renderRitual() {
    if (!sparkField || !ritualPanel) return;
    releasedSparks = 0;
    sparkField.textContent = '';
    if (ritualProgressFill) ritualProgressFill.style.transform = 'scaleX(0)';
    ritualTabs?.querySelectorAll('.ritual-tab').forEach((tab) => {
        const isActive = tab.dataset.ritual === ritualType;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-pressed', String(isActive));
    });

    if (ritualType === 'orbit') {
        const kicker = document.getElementById('ritual-kicker');
        const title = document.querySelector('#ritual-card h2');
        const subtitle = document.getElementById('ritual-subtitle');
        if (kicker) kicker.textContent = 'breathing orbit';
        if (title) title.textContent = 'Tap with each slow exhale.';
        if (subtitle) subtitle.textContent = 'Five soft taps. No rush.';
        sparkField.className = 'orbit-field';

        const orb = document.createElement('button');
        orb.type = 'button';
        orb.className = 'breath-orbit';
        orb.setAttribute('aria-label', 'Tap with each slow exhale');
        orb.innerHTML = '<span></span>';
        orb.addEventListener('click', () => releaseOrbitStep(orb));
        sparkField.appendChild(orb);
        setEmotionalState('calm', 0.34);
        return;
    }

    if (ritualType === 'threads') {
        const kicker = document.getElementById('ritual-kicker');
        const title = document.querySelector('#ritual-card h2');
        const subtitle = document.getElementById('ritual-subtitle');
        if (kicker) kicker.textContent = 'untangle threads';
        if (title) title.textContent = 'Tap the knots one by one.';
        if (subtitle) subtitle.textContent = 'No solving everything. Just finding edges.';
        sparkField.className = 'thread-field';
        sparkField.style.setProperty('--thread-calm', '0');
        setEmotionalState('confusion', 0.44);

        for (let i = 0; i < 5; i++) {
            const thread = document.createElement('span');
            thread.className = 'thread-line';
            thread.style.setProperty('--thread-top', `${18 + i * 14 + Math.random() * 5}%`);
            thread.style.setProperty('--thread-rotate', `${-15 + Math.random() * 30}deg`);
            thread.style.setProperty('--thread-delay', `${Math.random() * 1.2}s`);
            sparkField.appendChild(thread);
        }

        for (let i = 0; i < 6; i++) {
            const knot = document.createElement('button');
            knot.type = 'button';
            knot.className = 'thread-knot';
            knot.setAttribute('aria-label', 'Untangle knot');
            knot.style.left = `${13 + Math.random() * 74}%`;
            knot.style.top = `${16 + Math.random() * 64}%`;
            knot.style.animationDelay = `${Math.random() * 1.4}s`;
            knot.addEventListener('click', () => releaseThreadKnot(knot));
            sparkField.appendChild(knot);
        }
        return;
    }

    if (ritualType === 'flame') {
        const kicker = document.getElementById('ritual-kicker');
        const title = document.querySelector('#ritual-card h2');
        const subtitle = document.getElementById('ritual-subtitle');
        if (kicker) kicker.textContent = 'cool the flame';
        if (title) title.textContent = 'Tap the hot edges.';
        if (subtitle) subtitle.textContent = 'Keep the strength. Cool the sting.';
        sparkField.className = 'flame-field';
        sparkField.style.setProperty('--flame-calm', '0');
        setEmotionalState('anger', 0.5);

        const flame = document.createElement('div');
        flame.className = 'cool-flame';
        flame.innerHTML = '<span></span><span></span><span></span>';
        sparkField.appendChild(flame);

        for (let i = 0; i < 7; i++) {
            const point = document.createElement('button');
            point.type = 'button';
            point.className = 'flame-cool-point';
            point.setAttribute('aria-label', 'Cool hot edge');
            point.style.left = `${18 + Math.random() * 64}%`;
            point.style.top = `${18 + Math.random() * 62}%`;
            point.style.animationDelay = `${Math.random() * 1.1}s`;
            point.addEventListener('click', () => coolFlameStep(point));
            sparkField.appendChild(point);
        }
        return;
    }

    if (ritualType === 'flow') {
        const kicker = document.getElementById('ritual-kicker');
        const title = document.querySelector('#ritual-card h2');
        const subtitle = document.getElementById('ritual-subtitle');
        if (kicker) kicker.textContent = 'focus flow';
        if (title) title.textContent = 'Follow the glowing path.';
        if (subtitle) subtitle.textContent = 'Tap 1 to 8 in order. Let your attention land.';
        sparkField.className = 'flow-field';
        sparkField.style.setProperty('--flow-progress', '0');
        setEmotionalState('confusion', 0.38);

        const positions = [
            [15, 72], [28, 42], [43, 62], [56, 28],
            [69, 50], [80, 24], [67, 76], [47, 44]
        ];

        positions.forEach(([left, top], index) => {
            const node = document.createElement('button');
            node.type = 'button';
            node.className = 'flow-node';
            node.dataset.step = String(index + 1);
            node.style.left = `${left}%`;
            node.style.top = `${top}%`;
            node.setAttribute('aria-label', `Flow step ${index + 1}`);
            node.textContent = String(index + 1);
            node.addEventListener('click', () => releaseFlowStep(node));
            sparkField.appendChild(node);
        });
        return;
    }

    if (ritualType === 'balance') {
        const kicker = document.getElementById('ritual-kicker');
        const title = document.querySelector('#ritual-card h2');
        const subtitle = document.getElementById('ritual-subtitle');
        if (kicker) kicker.textContent = 'calm timing';
        if (title) title.textContent = 'Catch the calm window.';
        if (subtitle) subtitle.textContent = 'Tap when the light crosses the center.';
        sparkField.className = 'balance-field';
        sparkField.style.setProperty('--balance-calm', '0');
        setEmotionalState('calm', 0.34);

        const game = document.createElement('button');
        game.type = 'button';
        game.className = 'balance-game';
        game.dataset.startedAt = String(performance.now());
        game.dataset.duration = '2200';
        game.setAttribute('aria-label', 'Catch the calm window');
        game.innerHTML = '<span class="balance-track"><i></i><b></b></span><strong>5 more</strong>';
        game.addEventListener('click', () => catchBalanceBeat(game));
        sparkField.appendChild(game);
        return;
    }

    const kicker = document.getElementById('ritual-kicker');
    const title = document.querySelector('#ritual-card h2');
    const subtitle = document.getElementById('ritual-subtitle');
    if (kicker) kicker.textContent = 'release sparks';
    if (title) title.textContent = 'Tap what feels heavy.';
    if (subtitle) subtitle.textContent = 'No score. Just a few tiny releases.';
    sparkField.className = '';
    setEmotionalState('stress', 0.48);

    for (let i = 0; i < 9; i++) {
        const spark = document.createElement('button');
        spark.type = 'button';
        spark.className = 'spark';
        spark.setAttribute('aria-label', 'Release spark');
        spark.style.left = `${8 + Math.random() * 78}%`;
        spark.style.top = `${10 + Math.random() * 70}%`;
        spark.style.animationDelay = `${Math.random() * 1.8}s`;
        spark.style.setProperty('--spark-size', `${15 + Math.random() * 18}px`);
        spark.addEventListener('click', () => releaseSpark(spark));
        sparkField.appendChild(spark);
    }
}

function openRitual(type = ritualType) {
    if (!sparkField || !ritualPanel) return;
    closeMoodPanel();
    ritualType = ['orbit', 'threads', 'flame', 'flow', 'balance'].includes(type) ? type : 'sparks';
    ritualActive = true;
    ritualPanel.classList.remove('hidden');
    btnRitual?.classList.add('active');
    renderRitual();
    closeControlsOnSmallScreen();
}

// ─── Send message (conversation flow) ────────────────────────

async function sendMessage() {
    if (isProcessing) return;
    const userText = dumpInput.value.trim();
    if (!userText) return;

    isProcessing = true;
    dumpContainer.classList.add('is-processing');
    conversationThread?.classList.add('is-processing');

    // Clear input immediately so user feels it was accepted
    dumpInput.value = '';
    autosizeInput();
    dumpRelease.classList.remove('active');

    // Show user message in thread right away
    appendUserMessage(userText);

    const thoughtType = ai.detectThoughtType(userText);
    const emotion = ai.detectEmotion(userText);
    const intensity = ai.estimateIntensity(userText);
    const conversationMode = ai.detectConversationMode(userText, thoughtType, emotion);
    setEmotionalState(emotion, intensity);
    audio.setEmotionState(emotion, intensity);

    const entity = universe.addDefusionEntity({
        text: userText, emotion, intensity, thoughtType, timestamp: Date.now()
    });
    universe.addRipple?.({ emotion, intensity });

    audio.playCreation({
        intensity,
        audioNote: emotion === 'fear' ? 'D3' : emotion === 'anger' ? 'E3' : 'C4'
    });
    trackRecentTurn('user', userText, { emotion, thoughtType, mode: conversationMode });
    trackLightMemory(userText, emotion);

    const accessToken = auth.getAccessToken();

    const aiPromise = ai.defuse(userText, thoughtType, {
        accessToken: accessToken || null,
        conversationId: auth.getConversationId(),
        mode: conversationMode,
        recentTurns: recentTurns.slice(-8),
        lightMemory: lightMemory.slice(-3)
    });

    // Brief breathing moment
    breathingGuide.classList.remove('hidden');
    await sleep(2000);
    breathingGuide.classList.add('hidden');

    // Show typing bubble while waiting for reply
    const typingEl = appendTypingBubble();

    const defusionResult = await aiPromise;
    await sleep(480); // let typing dots breathe briefly

    typingEl?.remove();
    appendJigriMessage(defusionResult.reply);
    universe.addRipple?.({ emotion: 'calm', intensity: Math.max(0.28, intensity * 0.45) });
    trackRecentTurn('assistant', defusionResult.reply, { mode: conversationMode });

    if (defusionResult.conversationId) {
        auth.saveConversationId(defusionResult.conversationId);
    }

    // Background: dissolve the canvas entity + save echo
    universe.defuseEntity(entity.id, 120);
    storage.saveEcho(universe.toEcho(entity.id));

    isProcessing = false;
    dumpContainer.classList.remove('is-processing');
    conversationThread?.classList.remove('is-processing');
    messageCount++;
    if (presenceKicker) presenceKicker.textContent = messageCount > 2 ? 'memory trail' : 'Jigri is here';
    if (presenceState) presenceState.textContent = lightMemory.length ? `${Math.min(lightMemory.length, 5)} things held gently` : 'listening softly';

    if (messageCount === 3 && !auth.getAccessToken()) {
        maybeShowAuthInvite();
    }
    maybeTriggerAuthAfterReply();

    // After first reply, switch to conversation-mode placeholder
    if (messageCount === 1) {
        dumpInput.placeholder = pickOne([
            'Reply to Jigri...',
            'Tell Jigri more...',
            'Keep going, I\'m here...'
        ]);
    }
    dumpInput.focus();
}

// ─── Input events ─────────────────────────────────────────────

dumpInput.addEventListener('input', () => {
    autosizeInput();
    dumpRelease.classList.toggle(
        'active',
        dumpInput.value.trim().length > 0 && !isProcessing
    );
});

dumpInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

dumpRelease.addEventListener('click', sendMessage);

// ─── Audio controls ───────────────────────────────────────────

btnMusic.addEventListener('click', () => {
    const playing = audio.toggle();
    btnMusic.classList.toggle('active', playing);
    btnMusic.title = playing ? 'Ambient sound: on' : 'Ambient sound: off';
    btnMusic.setAttribute('aria-label', btnMusic.title);
});

btnVolume?.addEventListener('click', () => {
    const { value, level } = audio.cycleVolumePreset();
    btnVolume.classList.add('active');
    updateVolumeButton(level, value);
    setTimeout(() => btnVolume.classList.remove('active'), 500);
});

btnMode?.addEventListener('click', () => {
    const mode = audio.cycleMode();
    btnMode.classList.add('active');
    updateModeButton(mode);
    setTimeout(() => btnMode.classList.remove('active'), 600);
});

btnMenu?.addEventListener('click', () => {
    setControlsOpen(!controlsOpen);
});

btnHome?.addEventListener('click', showHome);

btnMood?.addEventListener('click', () => {
    if (moodPanel?.classList.contains('hidden')) openMoodPanel();
    else closeMoodPanel();
});

btnRitual?.addEventListener('click', () => {
    if (ritualActive) closeRitual();
    else openRitual();
    closeControlsOnSmallScreen();
});

ritualClose?.addEventListener('click', closeRitual);

ritualTabs?.addEventListener('click', (e) => {
    const tab = e.target.closest('.ritual-tab');
    if (!tab) return;
    ritualType = ['orbit', 'threads', 'flame', 'flow', 'balance'].includes(tab.dataset.ritual) ? tab.dataset.ritual : 'sparks';
    renderRitual();
});

moodClose?.addEventListener('click', closeMoodPanel);

moodOptions?.addEventListener('click', (e) => {
    const option = e.target.closest('.mood-option');
    if (!option) return;
    switchMood(option.dataset.intention);
});

homeIntentions?.addEventListener('click', (e) => {
    const chip = e.target.closest('.intention-chip');
    if (!chip) return;
    chooseIntention(chip.dataset.intention);
});

// ─── Home CTA ─────────────────────────────────────────────────

homeCTA?.addEventListener('click', () => {
    const intention = INTENTION_COPY[selectedIntention] || INTENTION_COPY.vent;
    setEmotionalState(intention.emotion, intention.intensity);
    homeScreen.classList.add('fade-out');
    setTimeout(() => {
        homeScreen.classList.add('hidden');
        jigriApp.classList.remove('hidden');
        init();
    }, 540);
});

mainCanvas?.addEventListener('contextmenu', (e) => e.preventDefault());

createHomeStars();
initKeyboardSafeLayout();
initHomeParallax();
chooseIntention(selectedIntention);
