/**
 * EmotionEngine — Analyzes text to extract emotional dimensions
 * Maps emotions to celestial entity types and visual properties
 */

const EMOTION_LEXICON = {
  joy: {
    words: ['happy','joy','laugh','smile','fun','amazing','wonderful','great','beautiful',
            'awesome','fantastic','brilliant','sunshine','celebrate','delight','cheerful',
            'ecstasy','euphoria','glad','pleased','thrilled','excited','radiant','bright'],
    color: { h: 45, s: 95, l: 60 },
    entityType: 'star',
    intensity: 0.9,
    weight: 1.0,
    polarity: 1,
    audioNote: 'C5'
  },
  calm: {
    words: ['peace','calm','serene','tranquil','quiet','still','silence','rest','sleep',
            'meditate','zen','harmony','balance','flow','breeze','wind','nature',
            'lake','sunset','sunrise','ground','plant','grow','center','anchor'],
    color: { h: 200, s: 50, l: 45 },
    entityType: 'planet',
    intensity: 0.5,
    weight: 0.5,
    polarity: 0,
    audioNote: 'G3'
  },
  love: {
    words: ['love','heart','kiss','hug','romance','passion','desire','adore','cherish',
            'sweetheart','beloved','soulmate','together','embrace','tender','affection',
            'intimacy','devotion','care','warm','sweet','partner','companion','friend',
            'family','home','comfort','safe','trust','bond'],
    color: { h: 330, s: 90, l: 55 },
    entityType: 'nebula',
    intensity: 0.85,
    weight: 1.0,
    polarity: 1,
    audioNote: 'E4'
  },
  wonder: {
    words: ['wonder','curious','explore','discover','adventure','mystery','enigma',
            'universe','cosmos','space','galaxy','infinite','eternal','quantum',
            'magic','miracle','imagine','transcend','evolve','cosmic','celestial'],
    color: { h: 175, s: 80, l: 50 },
    entityType: 'comet',
    intensity: 0.8,
    weight: 1.0,
    polarity: 1,
    audioNote: 'G4'
  },
  stress: {
    words: ['stress','pressure','tension','overwhelm','heavy','deadline','rush','busy',
            'anxiety','worry','nervous','tense','tight','strain','burden','exhausted',
            'work','frustration','chaos','frenzy','panic','hurry'],
    color: { h: 30, s: 80, l: 60 },
    entityType: 'fastOrbit',
    intensity: 0.8,
    weight: 1.6,
    polarity: -1,
    audioNote: 'F4'
  },
  sadness: {
    words: ['sad','cry','tear','sorrow','grief','mourn','loss','miss','lonely','alone',
            'broken','hurt','pain','suffer','ache','empty','hollow','void',
            'dark','shadow','cold','fade','decay','lost','regret','hopeless',
            'helpless','weak','tired','weary','numb'],
    color: { h: 220, s: 60, l: 30 },
    entityType: 'drifter',
    intensity: 0.7,
    weight: 0.8,
    polarity: -1,
    audioNote: 'D3'
  },
  anger: {
    words: ['angry','rage','fury','hate','destroy','fight','violent','brutal',
            'cruel','burn','explode','crash','smash','break','scream','roar',
            'storm','revenge','toxic','terrible','worst','mad','furious'],
    color: { h: 5, s: 90, l: 50 },
    entityType: 'redGiant',
    intensity: 1.0,
    weight: 2.0,
    polarity: -1,
    audioNote: 'A2'
  },
  fear: {
    words: ['fear','scare','afraid','terror','horror','nightmare','monster',
            'creep','eerie','dread','paranoid','unknown','secret','hidden',
            'abyss','trap','danger','threat','looming'],
    color: { h: 270, s: 40, l: 15 },
    entityType: 'blackHole',
    intensity: 0.95,
    weight: 1.8,
    polarity: -1,
    audioNote: 'F2'
  },
  confusion: {
    words: ['confuse','lost','doubt','blur','haze','mist','fog','unclear',
            'puzzle','complex','maze','tangle','mess','chaotic','scatter',
            'random','unsure','decision','stuck'],
    color: { h: 0, s: 0, l: 50 },
    entityType: 'dustCloud',
    intensity: 0.6,
    weight: 1.2,
    polarity: 0,
    audioNote: 'D4'
  },
  hope: {
    words: ['hope','light','dawn','rise','begin','start','new','spark',
            'future','dream','wish','believe','faith','forward','horizon',
            'promise','clear','better','heal'],
    color: { h: 60, s: 95, l: 75 },
    entityType: 'lightArc',
    intensity: 0.8,
    weight: 1.0,
    polarity: 1,
    audioNote: 'C6'
  }
};

// Flatten for quick lookup
const WORD_TO_EMOTION = new Map();
for (const [emotion, data] of Object.entries(EMOTION_LEXICON)) {
  for (const word of data.words) {
    WORD_TO_EMOTION.set(word, emotion);
  }
}

export class EmotionEngine {
  constructor() {
    this.history = [];
    this.emotionCounts = {};
    for (const e of Object.keys(EMOTION_LEXICON)) {
      this.emotionCounts[e] = 0;
    }
  }

  /**
   * Analyze a text string and return emotion data
   * @param {string} text
   * @returns {{ emotion, color, entityType, intensity, audioNote, score, text }}
   */
  analyze(text) {
    const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
    const scores = {};

    for (const e of Object.keys(EMOTION_LEXICON)) {
      scores[e] = 0;
    }

    for (const word of words) {
      const emotion = WORD_TO_EMOTION.get(word);
      if (emotion) {
        scores[emotion] += 1;
      }
    }

    // Find dominant emotion
    let dominant = 'wonder'; // default for neutral/unknown
    let maxScore = 0;

    for (const [emotion, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        dominant = emotion;
      }
    }

    // If no emotion detected, use text characteristics
    if (maxScore === 0) {
      // Use text length and character patterns
      if (text.includes('?')) dominant = 'confusion';
      else if (text.includes('!')) dominant = 'stress';
      else if (text.length > 50) dominant = 'calm';
      else {
        // Hash the text to pick a consistent emotion
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
          hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
        }
        const emotions = Object.keys(EMOTION_LEXICON);
        dominant = emotions[Math.abs(hash) % emotions.length];
      }
    }

    const emotionData = EMOTION_LEXICON[dominant];
    this.emotionCounts[dominant]++;
    this.history.push({ text, emotion: dominant, time: Date.now() });

    // Compute a unique color variation based on the specific text
    let textHash = 0;
    for (let i = 0; i < text.length; i++) {
      textHash = ((textHash << 5) - textHash + text.charCodeAt(i)) | 0;
    }
    const hueVariation = (Math.abs(textHash) % 30) - 15;
    const color = {
      h: (emotionData.color.h + hueVariation + 360) % 360,
      s: emotionData.color.s,
      l: emotionData.color.l
    };

    return {
      emotion: dominant,
      color,
      entityType: emotionData.entityType,
      intensity: emotionData.intensity + (maxScore * 0.05),
      audioNote: emotionData.audioNote,
      score: maxScore,
      weight: EMOTION_LEXICON[dominant].weight,
      polarity: EMOTION_LEXICON[dominant].polarity,
      text
    };
  }

  getDominantEmotion() {
    let dominant = 'Void';
    let max = 0;
    for (const [emotion, count] of Object.entries(this.emotionCounts)) {
      if (count > max) {
        max = count;
        dominant = emotion;
      }
    }
    return dominant.charAt(0).toUpperCase() + dominant.slice(1);
  }

  getTotalThoughts() {
    return this.history.length;
  }

  reset() {
    this.history = [];
    for (const e of Object.keys(this.emotionCounts)) {
      this.emotionCounts[e] = 0;
    }
  }
}
