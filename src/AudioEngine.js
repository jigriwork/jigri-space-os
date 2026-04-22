/**
 * AudioEngine — Generative ambient music and sound effects
 * Creates evolving soundscapes that respond to the universe state
 */

const NOTE_FREQUENCIES = {
  'C2': 65.41, 'D2': 73.42, 'E2': 82.41, 'F2': 87.31, 'G2': 98.00, 'A2': 110.0, 'B2': 123.47,
  'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.0, 'B3': 246.94,
  'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.0, 'B4': 493.88,
  'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.0, 'B5': 987.77,
};

const AMBIENT_MODES = [
  {
    pad: ['C2', 'G2', 'C3'],
    melody: ['C3', 'E3', 'G3', 'B3', 'C4', 'E4', 'G4'],
    name: 'neutral'
  },
  {
    pad: ['D2', 'A2', 'D3'],
    melody: ['D3', 'F3', 'A3', 'C4', 'D4', 'F4', 'A4'],
    name: 'deep'
  },
  {
    pad: ['E2', 'B2', 'E3'],
    melody: ['E3', 'G3', 'B3', 'D4', 'E4', 'G4', 'B4'],
    name: 'lift'
  },
  {
    pad: ['A1', 'E2', 'A2'],
    melody: ['A2', 'C3', 'E3', 'G3', 'A3', 'C4', 'E4'],
    name: 'night'
  },
  {
    pad: ['F2', 'C3', 'F3'],
    melody: ['F3', 'A3', 'C4', 'E4', 'F4', 'A4', 'C5'],
    name: 'warm'
  },
  {
    pad: ['G2', 'D3', 'G3'],
    melody: ['G3', 'A3', 'B3', 'D4', 'E4', 'G4', 'A4'],
    name: 'drift'
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
    this.initialized = false;
    this.modeIndex = 0;
    this.modeTimer = null;
    this.volumePresets = [0.4, 0.58, 0.75];
    this.volumePresetIndex = 1;
    this.currentEmotion = 'stress';
    this.currentIntensity = 0.6;
    this.melodyIntervalMs = 2600;
  }

  async init() {
    if (this.initialized) return;

    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Master gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volumePresets[this.volumePresetIndex];

    // Create reverb
    this.reverbNode = await this._createReverb();
    this.reverbNode.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Dry path
    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 0.4;
    this.dryGain.connect(this.masterGain);

    // Wet path (reverb)
    this.wetGain = this.ctx.createGain();
    this.wetGain.gain.value = 0.6;
    this.wetGain.connect(this.reverbNode);

    this.initialized = true;
  }

  async _createReverb() {
    const length = this.ctx.sampleRate * 3;
    const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
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

    // Start pad drones
    this._startPads();

    // Start ambient melody
    this._playAmbientNote();
    this.ambientInterval = setInterval(() => {
      if (this.isPlaying) this._playAmbientNote();
    }, this.melodyIntervalMs);

    // Rotate ambient mode for more musical variation
    this.modeTimer = setInterval(() => {
      if (!this.isPlaying) return;
      this._rotateMode();
    }, 24000);
  }

  _startPads() {
    const mode = AMBIENT_MODES[this.modeIndex];
    mode.pad.forEach((note, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.value = NOTE_FREQUENCIES[note];

      filter.type = 'lowpass';
      filter.frequency.value = 400;
      filter.Q.value = 1;

      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 2.3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.wetGain);
      gain.connect(this.dryGain);

      osc.start();

      // Subtle LFO for movement
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.05 + i * 0.02;
      lfoGain.gain.value = 3;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();

      this.padOscillators.push({ osc, gain, filter, lfo, lfoGain });
    });
  }

  _playAmbientNote() {
    if (!this.isPlaying || !this.ctx) return;

    const mode = AMBIENT_MODES[this.modeIndex];
    const note = mode.melody[Math.floor(Math.random() * mode.melody.length)];
    const freq = NOTE_FREQUENCIES[note];
    const now = this.ctx.currentTime;
    const duration = 1.2 + Math.random() * 2.2;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = Math.random() > 0.4 ? 'sine' : (Math.random() > 0.5 ? 'triangle' : 'sawtooth');
    osc.frequency.value = freq;

    filter.type = 'lowpass';
    filter.frequency.value = 620 + Math.random() * 780;

    gain.gain.value = 0;
    const emotionBoost = this.currentEmotion === 'anger' || this.currentEmotion === 'stress' ? 0.03 : 0;
    gain.gain.linearRampToValueAtTime(0.07 + Math.random() * 0.06 + emotionBoost, now + 0.3);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.wetGain);

    osc.start(now);
    osc.stop(now + duration);
    this.activeMelodyVoices.push(osc);

    // Occasional shimmer harmony note
    if (Math.random() > 0.62) {
      const harmony = this.ctx.createOscillator();
      const hGain = this.ctx.createGain();
      harmony.type = 'sine';
      harmony.frequency.value = freq * (Math.random() > 0.5 ? 1.5 : 2);
      hGain.gain.value = 0;
      hGain.gain.linearRampToValueAtTime(0.028, now + 0.2);
      hGain.gain.linearRampToValueAtTime(0, now + duration * 0.9);
      harmony.connect(hGain);
      hGain.connect(this.wetGain);
      harmony.start(now);
      harmony.stop(now + duration * 0.9);
    }

    // Sparse secondary note for richer ambient motion
    if (Math.random() > 0.78) {
      const note2 = mode.melody[Math.floor(Math.random() * mode.melody.length)];
      const freq2 = NOTE_FREQUENCIES[note2] * (Math.random() > 0.5 ? 0.5 : 1);
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      const filter2 = this.ctx.createBiquadFilter();

      osc2.type = 'triangle';
      osc2.frequency.value = freq2;
      filter2.type = 'lowpass';
      filter2.frequency.value = 520 + Math.random() * 520;

      gain2.gain.value = 0;
      gain2.gain.linearRampToValueAtTime(0.028, now + 0.22);
      gain2.gain.linearRampToValueAtTime(0, now + duration * 0.75);

      osc2.connect(filter2);
      filter2.connect(gain2);
      gain2.connect(this.wetGain);

      osc2.start(now + 0.07);
      osc2.stop(now + duration * 0.75);
    }
  }

  _rotateMode() {
    this.modeIndex = (this.modeIndex + 1) % AMBIENT_MODES.length;
    const now = this.ctx.currentTime;

    this.padOscillators.forEach(({ osc, gain, lfo }) => {
      try {
        gain.gain.linearRampToValueAtTime(0, now + 0.8);
        setTimeout(() => {
          try {
            osc.stop();
            lfo.stop();
          } catch (e) { }
        }, 1100);
      } catch (e) { }
    });
    this.padOscillators = [];
    this._startPads();
  }

  setEmotionState(emotion = 'stress', intensity = 0.6) {
    this.currentEmotion = emotion;
    this.currentIntensity = Math.max(0.2, Math.min(1, intensity));

    const moodToMode = {
      fear: 1,
      sadness: 1,
      confusion: 0,
      stress: 2,
      anger: 2
    };
    this.modeIndex = moodToMode[emotion] ?? 0;

    const fast = emotion === 'anger' || emotion === 'stress';
    const slower = emotion === 'fear' || emotion === 'sadness';
    this.melodyIntervalMs = fast
      ? 1500 + (1 - this.currentIntensity) * 900
      : slower
        ? 2800 + (1 - this.currentIntensity) * 1300
        : 2100 + (1 - this.currentIntensity) * 1200;

    if (this.isPlaying) {
      if (this.ambientInterval) clearInterval(this.ambientInterval);
      this.ambientInterval = setInterval(() => {
        if (this.isPlaying) this._playAmbientNote();
      }, this.melodyIntervalMs);
      this._rotateMode();
    }
  }

  cycleMode() {
    this.modeIndex = (this.modeIndex + 1) % AMBIENT_MODES.length;
    if (this.isPlaying) {
      this._rotateMode();
    }
    return AMBIENT_MODES[this.modeIndex].name;
  }

  cycleVolumePreset() {
    this.volumePresetIndex = (this.volumePresetIndex + 1) % this.volumePresets.length;
    const value = this.volumePresets[this.volumePresetIndex];
    this.setVolume(value);
    return { value, level: this.volumePresetIndex };
  }

  /**
   * Play a creation sound when a new entity is born
   */
  playCreation(emotionData) {
    if (!this.initialized || !this.ctx) return;

    const freq = NOTE_FREQUENCIES[emotionData.audioNote] || 440;
    const now = this.ctx.currentTime;
    const intensity = emotionData.intensity || 0.8;

    // Main tone
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'sine';
    osc1.frequency.value = freq;

    osc2.type = 'triangle';
    osc2.frequency.value = freq * 1.5; // fifth

    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    filter.frequency.linearRampToValueAtTime(400, now + 2);

    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.15 * intensity, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.wetGain);
    gain.connect(this.dryGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 2.5);
    osc2.stop(now + 2.5);

    // Sub bass hit
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.value = freq / 4;
    sub.frequency.linearRampToValueAtTime(freq / 8, now + 1);
    subGain.gain.value = 0.12 * intensity;
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    sub.connect(subGain);
    subGain.connect(this.dryGain);
    sub.start(now);
    sub.stop(now + 1.5);

    // Shimmer
    for (let i = 0; i < 3; i++) {
      const shimmer = this.ctx.createOscillator();
      const sGain = this.ctx.createGain();
      shimmer.type = 'sine';
      shimmer.frequency.value = freq * (2 + i) + Math.random() * 20;
      sGain.gain.value = 0;
      sGain.gain.linearRampToValueAtTime(0.03, now + 0.2 + i * 0.1);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + 2 + i * 0.3);
      shimmer.connect(sGain);
      sGain.connect(this.wetGain);
      shimmer.start(now + i * 0.1);
      shimmer.stop(now + 2.5 + i * 0.3);
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
    this.padOscillators.forEach(({ osc, gain, lfo }) => {
      gain.gain.linearRampToValueAtTime(0, now + 1);
      setTimeout(() => {
        try { osc.stop(); lfo.stop(); } catch (e) { }
      }, 1500);
    });
    this.padOscillators = [];
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
      this.masterGain.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.1);
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
