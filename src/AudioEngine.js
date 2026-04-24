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
    pad: ['C2', 'G2', 'C3'],
    melody: ['C4', 'E4', 'G4', 'C5', 'E5'],
    name: 'stillness'
  },
  {
    pad: ['G2', 'D3', 'G3'],
    melody: ['G3', 'B3', 'D4', 'G4', 'B4'],
    name: 'moonlight'
  },
  {
    pad: ['D2', 'A2', 'D3'],
    melody: ['D4', 'F#3', 'A3', 'D4', 'A4'],
    name: 'forest'
  },
  {
    pad: ['A1', 'E2', 'A2'],
    melody: ['A3', 'C4', 'E4', 'A4', 'C5'],
    name: 'rainfall'
  },
  {
    pad: ['F2', 'C3', 'F3'],
    melody: ['F3', 'A3', 'C4', 'F4', 'A4'],
    name: 'clouds'
  },
  {
    pad: ['E2', 'B2', 'E3'],
    melody: ['E3', 'G3', 'B3', 'E4', 'G4'],
    name: 'ocean'
  },
  {
    pad: ['B1', 'F#2', 'B2'],
    melody: ['B3', 'D4', 'F#3', 'B3', 'D4'],
    name: 'twilight'
  },
  {
    pad: ['F2', 'A2', 'C3'],
    melody: ['F3', 'A3', 'C4', 'E4', 'F4'],
    name: 'breath'
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
    this.volumePresets = [0.28, 0.42, 0.58];
    this.volumePresetIndex = 1;
    this.currentEmotion = 'calm';
    this.currentIntensity = 0.4;
    this.melodyIntervalMs = 4200;
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

    this.initialized = true;
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

    // Start slow, floating melody
    this._playAmbientNote();
    this.ambientInterval = setInterval(() => {
      if (this.isPlaying) this._playAmbientNote();
    }, this.melodyIntervalMs);

    // Gently rotate mode every 32 seconds for subtle evolution
    this.modeTimer = setInterval(() => {
      if (!this.isPlaying) return;
      this._rotateMode();
    }, 32000);
  }

  _startPads() {
    const mode = AMBIENT_MODES[this.modeIndex];
    mode.pad.forEach((note, i) => {
      const freq = NOTE_FREQUENCIES[note];
      if (!freq) return;

      // Primary oscillator — pure sine for warmth
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.value = freq;

      // Very low cutoff for that pillowy, muffled warmth
      filter.type = 'lowpass';
      filter.frequency.value = 220 + i * 30;
      filter.Q.value = 0.5;

      // Slow, gentle fade in (4 seconds)
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.08, this.ctx.currentTime + 4);

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
      gain2.gain.linearRampToValueAtTime(0.04, this.ctx.currentTime + 5);
      osc2.connect(filter);
      osc2.start();

      this.padOscillators.push({ osc, gain, filter, lfo, lfoGain, osc2, gain2 });
    });
  }

  _playAmbientNote() {
    if (!this.isPlaying || !this.ctx) return;

    const mode = AMBIENT_MODES[this.modeIndex];
    const note = mode.melody[Math.floor(Math.random() * mode.melody.length)];
    const freq = NOTE_FREQUENCIES[note];
    if (!freq) return;

    const now = this.ctx.currentTime;
    const duration = 4.5 + Math.random() * 5; // long, floating notes (4.5-9.5 seconds)

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
    gain.gain.linearRampToValueAtTime(0.035 + Math.random() * 0.025, now + 1.2);
    gain.gain.linearRampToValueAtTime(0.02, now + duration * 0.6);
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

  _rotateMode() {
    this.modeIndex = (this.modeIndex + 1) % AMBIENT_MODES.length;
    const now = this.ctx.currentTime;

    // Slow crossfade out (2.5 seconds) — no abrupt changes
    this.padOscillators.forEach(({ osc, gain, lfo, osc2, gain2 }) => {
      try {
        gain.gain.linearRampToValueAtTime(0, now + 2.5);
        if (gain2) gain2.gain.linearRampToValueAtTime(0, now + 2.5);
        setTimeout(() => {
          try {
            osc.stop();
            lfo.stop();
            if (osc2) osc2.stop();
          } catch (e) { }
        }, 3000);
      } catch (e) { }
    });
    this.padOscillators = [];
    // Start new pads after a gentle pause
    setTimeout(() => {
      if (this.isPlaying) this._startPads();
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
      calm: 0        // stillness — pure peace
    };
    this.modeIndex = moodToMode[emotion] ?? 0;

    // Always keep melody slow and spacious — calming regardless of emotion
    this.melodyIntervalMs = 3600 + (1 - this.currentIntensity) * 2400; // 3.6s to 6s

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

  getCurrentModeName() {
    return AMBIENT_MODES[this.modeIndex].name;
  }

  cycleVolumePreset() {
    this.volumePresetIndex = (this.volumePresetIndex + 1) % this.volumePresets.length;
    const value = this.volumePresets[this.volumePresetIndex];
    this.setVolume(value);
    return { value, level: this.volumePresetIndex };
  }

  /**
   * Play a soft creation sound when a new entity appears
   */
  playCreation(emotionData) {
    if (!this.initialized || !this.ctx) return;

    const freq = NOTE_FREQUENCIES[emotionData.audioNote] || 440;
    const now = this.ctx.currentTime;
    const intensity = Math.min(emotionData.intensity || 0.5, 0.65); // cap intensity

    // Gentle bell-like tone
    const osc1 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'sine';
    osc1.frequency.value = freq;

    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.frequency.linearRampToValueAtTime(200, now + 3);

    // Soft attack, long decay
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.09 * intensity, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 4);

    osc1.connect(filter);
    filter.connect(gain);
    gain.connect(this.wetGain);

    osc1.start(now);
    osc1.stop(now + 4);

    // Soft fifth
    const fifth = this.ctx.createOscillator();
    const fGain = this.ctx.createGain();
    fifth.type = 'sine';
    fifth.frequency.value = freq * 1.5;
    fGain.gain.value = 0;
    fGain.gain.linearRampToValueAtTime(0.035 * intensity, now + 0.6);
    fGain.gain.exponentialRampToValueAtTime(0.001, now + 3.5);
    fifth.connect(fGain);
    fGain.connect(this.wetGain);
    fifth.start(now + 0.15);
    fifth.stop(now + 3.5);

    // Gentle shimmer cascade
    for (let i = 0; i < 2; i++) {
      const shimmer = this.ctx.createOscillator();
      const sGain = this.ctx.createGain();
      shimmer.type = 'sine';
      shimmer.frequency.value = freq * (2 + i) + Math.random() * 5;
      sGain.gain.value = 0;
      sGain.gain.linearRampToValueAtTime(0.015, now + 0.8 + i * 0.3);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + 3 + i * 0.4);
      shimmer.connect(sGain);
      sGain.connect(this.wetGain);
      shimmer.start(now + 0.3 + i * 0.2);
      shimmer.stop(now + 3.5 + i * 0.4);
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
          lfo.stop();
          if (osc2) osc2.stop();
        } catch (e) { }
      }, 2500);
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
