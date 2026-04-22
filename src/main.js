import './styles.css';
import { Universe } from './Universe.js';
import { AudioEngine } from './AudioEngine.js';
import { StorageEngine } from './StorageEngine.js';
import GeminiProvider from './ai/GeminiProvider.js';

const homeScreen = document.getElementById('home-screen');
const homeStars = document.getElementById('home-stars');
const homeCTA = document.getElementById('home-cta');
const lumaApp = document.getElementById('luma-app');

const bgCanvas = document.getElementById('bg-canvas');
const mainCanvas = document.getElementById('main-canvas');
const fxCanvas = document.getElementById('fx-canvas');

const dumpInput = document.getElementById('dump-input');
const dumpRelease = document.getElementById('dump-release');
const dumpContainer = document.getElementById('dump-container');

const breathingGuide = document.getElementById('breathing-guide');
const defusionPanel = document.getElementById('defusion-panel');
const defusionText = document.getElementById('defusion-text');
const sessionEnd = document.getElementById('session-end');
const btnMusic = document.getElementById('btn-music');
const btnVolume = document.getElementById('btn-volume');
const btnMode = document.getElementById('btn-mode');

const universe = new Universe(bgCanvas, mainCanvas, fxCanvas);
const audio = new AudioEngine();
const ai = new GeminiProvider();
const storage = new StorageEngine();

let isProcessing = false;
let appStarted = false;

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

    const echoes = storage.getEchoes();
    if (echoes.length) {
        universe.loadMemoryEchoes(echoes);
    }

    dumpInput.focus();
    loop();
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function resetSession() {
    dumpInput.value = '';
    dumpRelease.classList.remove('active');
    dumpContainer.classList.remove('hidden');
    defusionPanel.classList.add('hidden');
    sessionEnd.classList.add('hidden');
    breathingGuide.classList.add('hidden');
    isProcessing = false;
    dumpInput.focus();
}

async function releaseThought() {
    if (isProcessing) return;
    const userText = dumpInput.value.trim();
    if (!userText) return;

    isProcessing = true;
    const startedAt = performance.now();

    const thoughtType = ai.detectThoughtType(userText);
    const emotion = ai.detectEmotion(userText);
    const intensity = ai.estimateIntensity(userText);
    audio.setEmotionState(emotion, intensity);

    dumpContainer.classList.add('hidden');

    const entity = universe.addDefusionEntity({
        text: userText,
        emotion,
        intensity,
        thoughtType,
        timestamp: Date.now()
    });

    audio.playCreation({
        intensity,
        audioNote: emotion === 'fear' ? 'D3' : emotion === 'anger' ? 'E3' : 'C4'
    });

    const aiPromise = ai.defuse(userText, thoughtType);

    breathingGuide.classList.remove('hidden');
    await sleep(3800);
    breathingGuide.classList.add('hidden');

    const defusion = await aiPromise;
    defusionText.textContent = defusion;
    defusionPanel.classList.remove('hidden');

    await universe.defuseEntity(entity.id, 170);
    await sleep(5200);

    defusionPanel.classList.add('hidden');
    const endLabel = thoughtType === 'positive' ? 'State anchored.' : 'Thought released.';
    const sessionEndText = document.getElementById('session-end-text');
    if (sessionEndText) sessionEndText.textContent = endLabel;
    sessionEnd.classList.remove('hidden');
    await sleep(1600);
    sessionEnd.classList.add('hidden');

    storage.saveEcho(universe.toEcho(entity.id));

    const elapsed = performance.now() - startedAt;
    if (elapsed < 60000) {
        await sleep(220);
    }

    resetSession();
}

dumpInput.addEventListener('input', () => {
    dumpRelease.classList.toggle('active', dumpInput.value.trim().length > 0 && !isProcessing);
});

dumpInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        releaseThought();
    }
});

dumpRelease.addEventListener('click', releaseThought);

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
    setTimeout(() => {
        btnMode.classList.remove('active');
        btnMode.textContent = 'MODE';
    }, 700);
});

homeCTA?.addEventListener('click', async () => {
    homeScreen.classList.add('fade-out');
    setTimeout(() => {
        homeScreen.classList.add('hidden');
        lumaApp.classList.remove('hidden');
        init();
    }, 540);
});

mainCanvas?.addEventListener('contextmenu', (e) => e.preventDefault());

createHomeStars();
