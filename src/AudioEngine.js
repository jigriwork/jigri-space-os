/**
 * AudioEngine — Soothing generative ambient soundscapes
 * Designed to calm and relax; every sound is soft, warm, and slow
 */

const NOTE_FREQUENCIES = {
  'A1': 55.00, 'B1': 61.74,
  'C2': 65.41, 'D2': 73.42, 'E2': 82.41, 'F2': 87.31, 'F#2': 92.50, 'G2': 98.00, 'G#2': 103.83, 'A2': 110.0, 'B2': 123.47,
  'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'A3': 220.0, 'B3': 246.94,
  'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.0, 'B4': 493.88,
  'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'G5': 783.99,
};

// All modes use pentatonic or suspended chords — no tension, pure calm
const AMBIENT_MODES = [
  {
    pad: ['C2', 'G2', 'C3', 'E3'],
    melody: ['C4', 'E4', 'G4', 'C5', 'E5'],
    texture: 'air',
    padLevel: 0.9,
    melodyLevel: 0.8,
    textureLevel: 0.55,
    name: 'sanctuary'
  },
  {
    pad: ['G2', 'D3', 'G3', 'B3'],
    melody: ['G3', 'B3', 'D4', 'G4', 'B4'],
    texture: 'shimmer',
    padLevel: 0.72,
    melodyLevel: 0.92,
    textureLevel: 0.72,
    name: 'moonroom'
  },
  {
    pad: ['D2', 'A2', 'D3', 'F#3'],
    melody: ['D4', 'F#3', 'A3', 'D4', 'A4'],
    texture: 'warmth',
    padLevel: 1,
    melodyLevel: 0.46,
    textureLevel: 0.68,
    name: 'cedar'
  },
  {
    pad: ['A1', 'E2', 'A2', 'C4'],
    melody: ['A3', 'C4', 'E4', 'A4', 'C5'],
    texture: 'rain',
    padLevel: 0.18,
    melodyLevel: 0.12,
    textureLevel: 1,
    name: 'rainhouse'
  },
  {
    pad: ['F2', 'C3', 'F3', 'A3'],
    melody: ['F3', 'A3', 'C4', 'F4', 'A4'],
    texture: 'air',
    padLevel: 0.58,
    melodyLevel: 0.65,
    textureLevel: 0.78,
    name: 'cloudbed'
  },
  {
    pad: ['E2', 'B2', 'E3', 'G3'],
    melody: ['E3', 'G3', 'B3', 'E4', 'G4'],
    texture: 'water',
    padLevel: 0.38,
    melodyLevel: 0.2,
    textureLevel: 1,
    name: 'deepsea'
  },
  {
    pad: ['B1', 'F#2', 'B2', 'D4'],
    melody: ['B3', 'D4', 'F#3', 'B3', 'D4'],
    texture: 'shimmer',
    padLevel: 0.68,
    melodyLevel: 0.72,
    textureLevel: 0.78,
    name: 'twilight'
  },
  {
    pad: ['F2', 'A2', 'C3', 'E3'],
    melody: ['F3', 'A3', 'C4', 'E4', 'F4'],
    texture: 'breath',
    padLevel: 0.3,
    melodyLevel: 0.18,
    textureLevel: 1,
    name: 'exhale'
  },
  {
    pad: ['G#2', 'D#3', 'G#3', 'A#3'],
    melody: ['G#3', 'A#3', 'D#4', 'F4', 'A#4'],
    texture: 'velvet',
    padLevel: 1.05,
    melodyLevel: 0.22,
    textureLevel: 0.86,
    name: 'velvet'
  },
  {
    pad: ['C2', 'F2', 'G2', 'D3'],
    melody: ['C4', 'D4', 'F4', 'G4', 'C5'],
    texture: 'dawn',
    padLevel: 0.48,
    melodyLevel: 1,
    textureLevel: 0.74,
    name: 'dawn'
  }
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.reverbNode = null;
    this.isPlaying = false;
    this.ambientInterval = null;
    this.padOscillators = [];
    this.activeMelodyVoices = [];
    this.textureNodes = [];
    this.initialized = false;
    this.modeIndex = 0;
    this.modeTimer = null;
    this.volumePresets = [0.28, 0.42, 0.58, 1];
    this.volumePresetIndex = 1;
    this.currentEmotion = 'calm';
    this.currentIntensity = 0.4;
    this.melodyIntervalMs = 4200;
    this.textureInterval = null;
  }

  async init() {
    if (this.initialized) return;

    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Master gain — start gentle
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volumePresets[this.volumePresetIndex];

    // Lush reverb (longer tail for spaciousness)
    this.reverbNode = await this._createReverb();
    this.reverbNode.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Dry path — very low for dreaminess
    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 0.18;
    this.dryGain.connect(this.masterGain);

    // Wet path — dominant for spacious feel
    this.wetGain = this.ctx.createGain();
    this.wetGain.gain.value = 0.78;
    this.wetGain.connect(this.reverbNode);

    this.textureGain = this.ctx.createGain();
    this.textureGain.gain.value = 0.32;
    this.textureGain.connect(this.masterGain);

    this.initialized = true;
  }

  _createNoiseBuffer(seconds = 2) {
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  async _createReverb() {
    // Long, lush reverb tail (4.5 seconds)
    const length = this.ctx.sampleRate * 4.5;
    const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        // Slower decay = longer, more spacious reverb tail
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 1.8);
      }
    }

    const convolver = this.ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  startAmbient() {
    if (this.isPlaying || !this.initialized) return;
    this.isPlaying = true;

    this.modeIndex = Math.floor(Math.random() * AMBIENT_MODES.length);

    // Start warm pad drones
    this._startPads();
    this._startTexture();

    // Start slow, floating melody
    this._playAmbientNote();
    this.ambientInterval = setInterval(() => {
      if (this.isPlaying) this._playAmbientNote();
    }, this.melodyIntervalMs);

    // Gently rotate mode every 32 seconds for subtle evolution
    this.modeTimer = setInterval(() => {
      if (!this.isPlaying) return;
      this._rotateMode(true);
    }, 32000);
  }

  _startTexture() {
    if (!this.ctx || !this.textureGain) return;
    this._stopTexture(1.2);
    const mode = AMBIENT_MODES[this.modeIndex];
    const texture = mode.texture || 'air';
    this.textureGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.textureGain.gain.linearRampToValueAtTime(0.32 * (mode.textureLevel ?? 0.7), this.ctx.currentTime + 0.8);

    if (texture === 'rain') {
      this._startRainTexture();
      return;
    }
    if (texture === 'water') {
      this._startWaterTexture();
      return;
    }
    if (texture === 'breath') {
      this._startBreathTexture();
      return;
    }
    if (texture === 'shimmer') {
      this._startShimmerTexture();
      return;
    }
    if (texture === 'warmth') {
      this._startWarmthTexture();
      return;
    }
    if (texture === 'dawn') {
      this._startDawnTexture();
      return;
    }
    this._startAirTexture(texture);
  }

  _startNoiseLayer({ freq = 900, q = 0.7, gainValue = 0.035, type = 'bandpass', fadeIn = 2.2, panValue = 0 }) {
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    const pan = this.ctx.createStereoPanner();

    source.buffer = this._createNoiseBuffer(3);
    source.loop = true;
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(gainValue, now + fadeIn);
    pan.pan.value = panValue;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(this.textureGain);
    source.start(now);
    this.textureNodes.push({ source, gain, filter, pan });
    return { source, gain, filter, pan };
  }

  _startRainTexture() {
    this._startNoiseLayer({ freq: 2600, q: 0.9, gainValue: 0.22, panValue: -0.16, fadeIn: 0.8 });
    this._startNoiseLayer({ freq: 5200, q: 1.2, gainValue: 0.12, panValue: 0.18, fadeIn: 0.8 });
    this._startNoiseLayer({ freq: 900, q: 0.45, gainValue: 0.075, type: 'highpass', fadeIn: 0.8 });
    this.textureInterval = setInterval(() => this._playRainDrop(), 90 + Math.random() * 90);
  }

  _playRainDrop() {
    if (!this.isPlaying || !this.ctx || AMBIENT_MODES[this.modeIndex]?.texture !== 'rain') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.value = 900 + Math.random() * 1400;
    filter.type = 'bandpass';
    filter.frequency.value = 1100 + Math.random() * 1800;
    filter.Q.value = 2.5;
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.022 + Math.random() * 0.026, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22 + Math.random() * 0.18);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.textureGain);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  _startWaterTexture() {
    const layer = this._startNoiseLayer({ freq: 340, q: 0.34, gainValue: 0.18, type: 'lowpass', fadeIn: 0.9 });
    this._startNoiseLayer({ freq: 90, q: 0.22, gainValue: 0.06, type: 'lowpass', fadeIn: 1.2 });
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 230;
    lfo.connect(lfoGain);
    lfoGain.connect(layer.filter.frequency);
    lfo.start();
    this.textureNodes.push({ source: lfo, gain: lfoGain });
  }

  _startBreathTexture() {
    const layer = this._startNoiseLayer({ freq: 720, q: 0.42, gainValue: 0.13, type: 'bandpass', fadeIn: 0.9 });
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.115;
    lfoGain.gain.value = 0.105;
    lfo.connect(lfoGain);
    lfoGain.connect(layer.gain.gain);
    lfo.start();
    this.textureNodes.push({ source: lfo, gain: lfoGain });
  }

  _startShimmerTexture() {
    this._startNoiseLayer({ freq: 3600, q: 1.4, gainValue: 0.065, panValue: -0.2, fadeIn: 0.9 });
    this._startNoiseLayer({ freq: 6200, q: 1.8, gainValue: 0.05, panValue: 0.22, fadeIn: 0.9 });
    this.textureInterval = setInterval(() => this._playShimmerSpark(), 620 + Math.random() * 620);
  }

  _playShimmerSpark() {
    if (!this.isPlaying || !this.ctx || !['shimmer', 'dawn'].includes(AMBIENT_MODES[this.modeIndex]?.texture)) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1200 + Math.random() * 1800;
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.018, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc.connect(gain);
    gain.connect(this.wetGain);
    osc.start(now);
    osc.stop(now + 1.3);
  }

  _startWarmthTexture() {
    this._startNoiseLayer({ freq: 210, q: 0.36, gainValue: 0.14, type: 'lowpass', fadeIn: 1 });
    this._startNoiseLayer({ freq: 620, q: 0.5, gainValue: 0.055, type: 'bandpass', panValue: 0.12, fadeIn: 1.2 });
  }

  _startDawnTexture() {
    this._startNoiseLayer({ freq: 1400, q: 0.8, gainValue: 0.08, panValue: -0.1, fadeIn: 0.9 });
    this._startNoiseLayer({ freq: 2800, q: 1.1, gainValue: 0.055, panValue: 0.18, fadeIn: 1 });
    this.textureInterval = setInterval(() => this._playShimmerSpark(), 760 + Math.random() * 900);
  }

  _startAirTexture(texture = 'air') {
    const settings = {
      velvet: { freq: 260, q: 0.55, gain: 0.15, type: 'lowpass' },
      air: { freq: 980, q: 0.55, gain: 0.09, type: 'bandpass' }
    }[texture] || { freq: 980, q: 0.55, gain: 0.09, type: 'bandpass' };
    this._startNoiseLayer({ freq: settings.freq, q: settings.q, gainValue: settings.gain, type: settings.type });
  }

  _stopTexture(fadeSeconds = 1.8) {
    if (this.textureInterval) {
      clearInterval(this.textureInterval);
      this.textureInterval = null;
    }
    if (!this.textureNodes.length) return;
    const now = this.ctx?.currentTime || 0;
    this.textureNodes.forEach(({ source, gain }) => {
      try {
        gain.gain.linearRampToValueAtTime(0, now + fadeSeconds);
        source.stop(now + fadeSeconds + 0.1);
      } catch (e) { }
    });
    this.textureNodes = [];
  }

  _startPads() {
    const mode = AMBIENT_MODES[this.modeIndex];
    const padLevel = mode.padLevel ?? 0.75;
    mode.pad.forEach((note, i) => {
      const freq = NOTE_FREQUENCIES[note];
      if (!freq) return;

      // Primary oscillator — soft wave for warmth
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;

      // Very low cutoff for that pillowy, muffled warmth
      filter.type = 'lowpass';
      filter.frequency.value = 220 + i * 30;
      filter.Q.value = 0.5;

      // Slow, gentle fade in (4 seconds)
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime((i === 0 ? 0.075 : 0.048) * padLevel, this.ctx.currentTime + 3.4);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.wetGain);
      gain.connect(this.dryGain);

      osc.start();

      // Very slow LFO — gives gentle breathing movement to each drone
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.02 + i * 0.008; // ultra-slow wobble
      lfoGain.gain.value = 1.5; // subtle pitch drift
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();

      // Second detuned oscillator for lush chorus effect
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = freq + 0.4 + i * 0.2; // slight detune = warm chorus
      gain2.gain.value = 0;
      gain2.gain.linearRampToValueAtTime(0.026 * padLevel, this.ctx.currentTime + 3.8);
      osc2.connect(filter);
      osc2.start();

      this.padOscillators.push({ osc, gain, filter, lfo, lfoGain, osc2, gain2 });
    });
    this._startSubPulse();
  }

  _startSubPulse() {
    const mode = AMBIENT_MODES[this.modeIndex];
    const padLevel = mode.padLevel ?? 0.75;
    const root = NOTE_FREQUENCIES[mode.pad[0]];
    if (!root) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.value = root * 0.5;
    filter.type = 'lowpass';
    filter.frequency.value = 120;
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.032 * padLevel, now + 3.8);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.wetGain);
    osc.start(now);
    this.padOscillators.push({ osc, gain, filter });
  }

  _playAmbientNote() {
    if (!this.isPlaying || !this.ctx) return;

    const mode = AMBIENT_MODES[this.modeIndex];
    const melodyLevel = mode.melodyLevel ?? 0.7;
    const note = mode.melody[Math.floor(Math.random() * mode.melody.length)];
    const freq = NOTE_FREQUENCIES[note];
    if (!freq) return;

    const now = this.ctx.currentTime;
    const duration = 6 + Math.random() * 7;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Only sine and triangle — never sawtooth or square
    osc.type = Math.random() > 0.3 ? 'sine' : 'triangle';
    osc.frequency.value = freq;

    // Low filter for softness
    filter.type = 'lowpass';
    filter.frequency.value = 320 + Math.random() * 280;

    // Very slow attack (1.2s), long tail — notes bloom gently
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime((0.022 + Math.random() * 0.018) * melodyLevel, now + 1.8);
    gain.gain.linearRampToValueAtTime(0.02 * melodyLevel, now + duration * 0.6);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.wetGain);

    osc.start(now);
    osc.stop(now + duration);
    this.activeMelodyVoices.push(osc);

    // Soft octave shimmer — very quiet, only sometimes
    if (Math.random() > 0.7) {
      const shimmer = this.ctx.createOscillator();
      const sGain = this.ctx.createGain();
      shimmer.type = 'sine';
      shimmer.frequency.value = freq * 2; // one octave up
      sGain.gain.value = 0;
      sGain.gain.linearRampToValueAtTime(0.012, now + 1.8);
      sGain.gain.linearRampToValueAtTime(0, now + duration * 0.85);
      shimmer.connect(sGain);
      sGain.connect(this.wetGain);
      shimmer.start(now + 0.5);
      shimmer.stop(now + duration * 0.85);
    }

    // Rare gentle fifth harmony — adds depth without tension
    if (Math.random() > 0.82) {
      const fifth = this.ctx.createOscillator();
      const fGain = this.ctx.createGain();
      fifth.type = 'sine';
      fifth.frequency.value = freq * 1.5;
      fGain.gain.value = 0;
      fGain.gain.linearRampToValueAtTime(0.015, now + 2);
      fGain.gain.linearRampToValueAtTime(0, now + duration * 0.7);
      fifth.connect(fGain);
      fGain.connect(this.wetGain);
      fifth.start(now + 0.8);
      fifth.stop(now + duration * 0.7);
    }
  }

  _rotateMode(advance = true) {
    if (advance) {
      this.modeIndex = (this.modeIndex + 1) % AMBIENT_MODES.length;
    }
    const now = this.ctx.currentTime;

    // Slow crossfade out (2.5 seconds) — no abrupt changes
    this.padOscillators.forEach(({ osc, gain, lfo, osc2, gain2 }) => {
      try {
        gain.gain.linearRampToValueAtTime(0, now + 2.5);
        if (gain2) gain2.gain.linearRampToValueAtTime(0, now + 2.5);
        setTimeout(() => {
          try {
            osc.stop();
            if (lfo) lfo.stop();
            if (osc2) osc2.stop();
          } catch (e) { }
        }, 3000);
      } catch (e) { }
    });
    this.padOscillators = [];
    this._stopTexture(2.2);
    // Start new pads after a gentle pause
    setTimeout(() => {
      if (this.isPlaying) {
        this._startPads();
        this._startTexture();
      }
    }, 1200);
  }

  setEmotionState(emotion = 'calm', intensity = 0.4) {
    this.currentEmotion = emotion;
    this.currentIntensity = Math.max(0.2, Math.min(1, intensity));

    // All emotions map to calming modes — no tense soundscapes
    const moodToMode = {
      fear: 3,       // rainfall — gentle, grounding
      sadness: 5,    // ocean — deep, warm
      confusion: 1,  // moonlight — clear, open
      stress: 7,     // breath — focused calm
      anger: 2,      // forest — nature, steady
      calm: 0        // sanctuary — pure peace
    };
    this.modeIndex = moodToMode[emotion] ?? 0;

    // Always keep melody slow and spacious — calming regardless of emotion
    this.melodyIntervalMs = 5200 + (1 - this.currentIntensity) * 3600;

    if (this.isPlaying) {
      if (this.ambientInterval) clearInterval(this.ambientInterval);
      this.ambientInterval = setInterval(() => {
        if (this.isPlaying) this._playAmbientNote();
      }, this.melodyIntervalMs);
      this._rotateMode(false);
    }
  }

  cycleMode() {
    this.modeIndex = (this.modeIndex + 1) % AMBIENT_MODES.length;
    if (this.isPlaying) {
      this._rotateMode(false);
      this._playModePreview();
    }
    return AMBIENT_MODES[this.modeIndex].name;
  }

  getCurrentModeName() {
    return AMBIENT_MODES[this.modeIndex].name;
  }

  cycleVolumePreset() {
    this.volumePresetIndex = (this.volumePresetIndex + 1) % this.volumePresets.length;
    const value = this.volumePresets[this.volumePresetIndex];
    this.setVolume(value);
    return { value, level: this.volumePresetIndex };
  }

  _playModePreview() {
    if (!this.initialized || !this.ctx) return;
    const mode = AMBIENT_MODES[this.modeIndex];
    if (mode.texture === 'rain') {
      for (let i = 0; i < 8; i++) {
        setTimeout(() => this._playRainDrop(), i * 55);
      }
      return;
    }
    if (mode.texture === 'water') {
      this._playSwellPreview(120, 0.06);
      return;
    }
    if (mode.texture === 'breath') {
      this._playSwellPreview(680, 0.045);
      return;
    }
    if (['shimmer', 'dawn'].includes(mode.texture)) {
      for (let i = 0; i < 4; i++) {
        setTimeout(() => this._playShimmerSpark(), i * 160);
      }
      return;
    }
    const notes = mode.melody.slice(0, 3);
    const now = this.ctx.currentTime;

    notes.forEach((note, i) => {
      const freq = NOTE_FREQUENCIES[note];
      if (!freq) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      osc.type = i === 1 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      filter.type = 'lowpass';
      filter.frequency.value = 560 + i * 120;
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.018, now + 0.25 + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.3 + i * 0.22);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.wetGain);
      osc.start(now + i * 0.16);
      osc.stop(now + 2.6 + i * 0.22);
    });
  }

  _playSwellPreview(freq = 220, level = 0.04) {
    if (!this.initialized || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'sine';
    osc.frequency.value = freq;
    filter.type = 'lowpass';
    filter.frequency.value = 360;
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(level, now + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.6);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.wetGain);
    osc.start(now);
    osc.stop(now + 2.8);
  }

  /**
   * Play a soft creation sound when a new entity appears
   */
  playCreation(emotionData) {
    if (!this.initialized || !this.ctx) return;

    const freq = NOTE_FREQUENCIES[emotionData.audioNote] || 440;
    const now = this.ctx.currentTime;
    const intensity = Math.min(emotionData.intensity || 0.5, 0.52);

    // Soft bloom, not a sharp ping.
    const osc1 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'sine';
    osc1.frequency.value = freq;

    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.frequency.linearRampToValueAtTime(180, now + 3.8);

    // Soft attack, long decay
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.045 * intensity, now + 0.75);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 5.2);

    osc1.connect(filter);
    filter.connect(gain);
    gain.connect(this.wetGain);

    osc1.start(now);
    osc1.stop(now + 5.3);

    // Soft fifth
    const fifth = this.ctx.createOscillator();
    const fGain = this.ctx.createGain();
    fifth.type = 'sine';
    fifth.frequency.value = freq * 1.5;
    fGain.gain.value = 0;
    fGain.gain.linearRampToValueAtTime(0.018 * intensity, now + 1);
    fGain.gain.exponentialRampToValueAtTime(0.001, now + 4.8);
    fifth.connect(fGain);
    fGain.connect(this.wetGain);
    fifth.start(now + 0.15);
    fifth.stop(now + 4.9);

    // Gentle shimmer cascade
    for (let i = 0; i < 1; i++) {
      const shimmer = this.ctx.createOscillator();
      const sGain = this.ctx.createGain();
      shimmer.type = 'sine';
      shimmer.frequency.value = freq * (2 + i) + Math.random() * 5;
      sGain.gain.value = 0;
      sGain.gain.linearRampToValueAtTime(0.007, now + 1.2 + i * 0.3);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + 4.2 + i * 0.4);
      shimmer.connect(sGain);
      sGain.connect(this.wetGain);
      shimmer.start(now + 0.3 + i * 0.2);
      shimmer.stop(now + 4.7 + i * 0.4);
    }
  }

  stopAmbient() {
    this.isPlaying = false;

    if (this.ambientInterval) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }

    if (this.modeTimer) {
      clearInterval(this.modeTimer);
      this.modeTimer = null;
    }

    this.activeMelodyVoices.forEach((osc) => {
      try { osc.stop(); } catch (e) { }
    });
    this.activeMelodyVoices = [];

    const now = this.ctx?.currentTime || 0;
    this.padOscillators.forEach(({ osc, gain, lfo, osc2, gain2 }) => {
      gain.gain.linearRampToValueAtTime(0, now + 2);
      if (gain2) gain2.gain.linearRampToValueAtTime(0, now + 2);
      setTimeout(() => {
        try {
          osc.stop();
          if (lfo) lfo.stop();
          if (osc2) osc2.stop();
        } catch (e) { }
      }, 2500);
    });
    this.padOscillators = [];
    this._stopTexture(2);
  }

  toggle() {
    if (this.isPlaying) {
      this.stopAmbient();
    } else {
      this.startAmbient();
    }
    return this.isPlaying;
  }

  setVolume(v) {
    if (this.masterGain) {
      this.masterGain.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.3);
    }
  }

  destroy() {
    this.stopAmbient();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }
}
