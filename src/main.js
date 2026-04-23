import './styles.css';
import { Universe } from './Universe.js';
import { AudioEngine } from './AudioEngine.js';
import { StorageEngine } from './StorageEngine.js';
import { AuthClient } from './AuthClient.js';
import GeminiProvider from './ai/GeminiProvider.js';

const homeScreen    = document.getElementById('home-screen');
const homeStars     = document.getElementById('home-stars');
const homeCTA       = document.getElementById('home-cta');
const jigriApp      = document.getElementById('luma-app');

const bgCanvas      = document.getElementById('bg-canvas');
const mainCanvas    = document.getElementById('main-canvas');
const fxCanvas      = document.getElementById('fx-canvas');

const dumpInput     = document.getElementById('dump-input');
const dumpRelease   = document.getElementById('dump-release');
const dumpContainer = document.getElementById('dump-container');

const breathingGuide   = document.getElementById('breathing-guide');
const conversationThread = document.getElementById('conversation-thread');
const sessionEnd       = document.getElementById('session-end');
const btnMusic  = document.getElementById('btn-music');
const btnVolume = document.getElementById('btn-volume');
const btnMode   = document.getElementById('btn-mode');

const universe = new Universe(bgCanvas, mainCanvas, fxCanvas);
const audio    = new AudioEngine();
const ai       = new GeminiProvider();
const storage  = new StorageEngine();
const auth     = new AuthClient(ai, storage);

document.title = 'Jigri | someone to talk to';

let isProcessing    = false;
let appStarted      = false;
let messageCount    = 0;  // tracks how many exchanges have happened

// ─── Home stars ───────────────────────────────────────────────

function createHomeStars() {
    if (!homeStars) return;
    for (let i = 0; i < 90; i++) {
        const s = document.createElement('span');
        s.className = 'home-star';
        s.style.left            = `${Math.random() * 100}%`;
        s.style.top             = `${Math.random() * 100}%`;
        s.style.animationDelay  = `${Math.random() * 4.5}s`;
        s.style.animationDuration = `${3.5 + Math.random() * 6}s`;
        s.style.opacity         = `${0.2 + Math.random() * 0.8}`;
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
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Conversation thread helpers ──────────────────────────────

function appendUserMessage(text) {
    if (!conversationThread) return;
    const el = document.createElement('div');
    el.className     = 'msg-user';
    el.textContent   = text;
    conversationThread.appendChild(el);
    conversationThread.scrollTop = conversationThread.scrollHeight;
}

function appendTypingBubble() {
    if (!conversationThread) return null;
    const wrap = document.createElement('div');
    wrap.className = 'msg-jigri msg-typing';

    const label = document.createElement('span');
    label.className   = 'msg-jigri-label';
    label.textContent = 'Jigri';

    const bubble = document.createElement('div');
    bubble.className = 'msg-jigri-text';

    const dots = document.createElement('div');
    dots.className   = 'typing-dots';
    dots.innerHTML   = '<span></span><span></span><span></span>';

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
    label.className   = 'msg-jigri-label';
    label.textContent = 'Jigri';

    const bubble = document.createElement('p');
    bubble.className   = 'msg-jigri-text';
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
    const emotion     = ai.detectEmotion(userText);
    const intensity   = ai.estimateIntensity(userText);
    audio.setEmotionState(emotion, intensity);

    const entity = universe.addDefusionEntity({
        text: userText, emotion, intensity, thoughtType, timestamp: Date.now()
    });

    audio.playCreation({
        intensity,
        audioNote: emotion === 'fear' ? 'D3' : emotion === 'anger' ? 'E3' : 'C4'
    });

    // Fire AI call before auth so it races in parallel
    let session = null;
    try {
        session = await auth.ensureSession();
    } catch (e) {
        console.info('Jigri: continuing without memory.');
    }

    const aiPromise = ai.defuse(userText, thoughtType, {
        accessToken:    session?.access_token || null,
        conversationId: auth.getConversationId()
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

    if (defusionResult.conversationId) {
        auth.saveConversationId(defusionResult.conversationId);
    }

    // Background: dissolve the canvas entity + save echo
    universe.defuseEntity(entity.id, 120);
    storage.saveEcho(universe.toEcho(entity.id));

    isProcessing = false;
    messageCount++;
    // After first reply, switch to conversation-mode placeholder
    if (messageCount === 1) {
        dumpInput.placeholder = 'Reply to Jigri...';
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
