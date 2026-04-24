import './styles.css';
import { Universe } from './Universe.js';
import { AudioEngine } from './AudioEngine.js';
import { StorageEngine } from './StorageEngine.js';
import { AuthClient } from './AuthClient.js';
import GeminiProvider from './ai/GeminiProvider.js';

const homeScreen = document.getElementById('home-screen');
const homeStars = document.getElementById('home-stars');
const homeCTA = document.getElementById('home-cta');
const jigriApp = document.getElementById('jigri-app');

const bgCanvas = document.getElementById('bg-canvas');
const mainCanvas = document.getElementById('main-canvas');
const fxCanvas = document.getElementById('fx-canvas');

const dumpInput = document.getElementById('dump-input');
const dumpRelease = document.getElementById('dump-release');
const dumpContainer = document.getElementById('dump-container');

const breathingGuide = document.getElementById('breathing-guide');
const conversationThread = document.getElementById('conversation-thread');
const sessionEnd = document.getElementById('session-end');
const btnMusic = document.getElementById('btn-music');
const btnVolume = document.getElementById('btn-volume');
const btnMode = document.getElementById('btn-mode');

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

const recentTurns = [];
const lightMemory = [];

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
    if (btnMode) btnMode.textContent = audio.getCurrentModeName();

    const echoes = storage.getEchoes();
    if (echoes.length) universe.loadMemoryEchoes(echoes);

    await auth.restore();

    // First message placeholder
    dumpInput.placeholder = 'What\'s on your mind...';
    dumpInput.focus();
    loop();

    // Welcome greeting — Jigri speaks first
    setTimeout(() => {
        const greetings = [
            'Hey. What\'s going on today?',
            'Hi. How\'s your day been?',
            'Hey hey. I\'m here. What\'s on your mind?',
            'Hi. Start wherever you want.',
            'Hey. Kya chal raha hai?',
            'Hi. Good to see you.'
        ];
        const pick = greetings[Math.floor(Math.random() * greetings.length)];
        appendJigriMessage(pick);
        trackRecentTurn('assistant', pick, { mode: 'casual' });
    }, 1200);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickOne(list) {
    return list[Math.floor(Math.random() * list.length)];
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
}

// ─── Send message (conversation flow) ────────────────────────

async function sendMessage() {
    if (isProcessing) return;
    const userText = dumpInput.value.trim();
    if (!userText) return;

    isProcessing = true;

    // Clear input immediately so user feels it was accepted
    dumpInput.value = '';
    dumpRelease.classList.remove('active');

    // Show user message in thread right away
    appendUserMessage(userText);

    const thoughtType = ai.detectThoughtType(userText);
    const emotion = ai.detectEmotion(userText);
    const intensity = ai.estimateIntensity(userText);
    const conversationMode = ai.detectConversationMode(userText, thoughtType, emotion);
    audio.setEmotionState(emotion, intensity);

    const entity = universe.addDefusionEntity({
        text: userText, emotion, intensity, thoughtType, timestamp: Date.now()
    });

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
    trackRecentTurn('assistant', defusionResult.reply, { mode: conversationMode });

    if (defusionResult.conversationId) {
        auth.saveConversationId(defusionResult.conversationId);
    }

    // Background: dissolve the canvas entity + save echo
    universe.defuseEntity(entity.id, 120);
    storage.saveEcho(universe.toEcho(entity.id));

    isProcessing = false;
    messageCount++;

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
});

btnVolume?.addEventListener('click', () => {
    const { value, level } = audio.cycleVolumePreset();
    btnVolume.classList.add('active');
    btnVolume.textContent = `V${level + 1}`;
    btnVolume.title = `Volume ${Math.round(value * 100)}%`;
    setTimeout(() => btnVolume.classList.remove('active'), 500);
});

btnMode?.addEventListener('click', () => {
    const mode = audio.cycleMode();
    btnMode.classList.add('active');
    btnMode.textContent = mode.slice(0, 4).toUpperCase();
    btnMode.title = `Mode: ${mode}`;
    setTimeout(() => btnMode.classList.remove('active'), 600);
});

// ─── Home CTA ─────────────────────────────────────────────────

homeCTA?.addEventListener('click', () => {
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
