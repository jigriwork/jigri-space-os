/**
 * ReflectionEngine — Generates quiet, empathetic, and observational insights from data.
 * No chatbot tone. No "I am here for you". Only observational reflections on the user's universe.
 */

export class ReflectionEngine {
  constructor(storageEngine) {
    this.storage = storageEngine;
  }

  generateInsight() {
    const entries = this.storage.getRecentEntries(7); // Last 7 days
    
    if (entries.length === 0) {
      return {
        main: "Your universe is quiet right now. Let your thoughts shape it when you are ready.",
        pattern: "No recent patterns detected.",
        prompt: "Take a moment to breathe and observe the space."
      };
    }

    if (entries.length < 3) {
      return {
        main: "New celestial bodies have started forming in your universe.",
        pattern: `The dominant tone recently is ${entries[entries.length - 1].emotion}.`,
        prompt: "Notice how simply acknowledging your state creates something visible."
      };
    }

    return {
      main: this._generateMainReflection(entries),
      pattern: this._generatePatternNote(entries),
      prompt: this._generateGentlePrompt(entries)
    };
  }

  _generateMainReflection(entries) {
    // Count emotions
    const counts = {};
    let heavyCount = 0;
    let lightCount = 0;

    entries.forEach(e => {
      counts[e.emotion] = (counts[e.emotion] || 0) + 1;
      if (['stress', 'anger', 'fear', 'sadness', 'confusion'].includes(e.emotion)) {
        heavyCount += e.intensity;
      } else {
        lightCount += e.intensity;
      }
    });

    const entriesSorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
    const dominant = entriesSorted[0][0];

    // Evaluate tension vs calm
    if (heavyCount > lightCount * 1.5) {
      return "Your universe has held significant tension and heavy gravity recently.";
    } else if (lightCount > heavyCount * 1.5) {
      return "There is an expanding sense of lightness and stability in your system.";
    } else if (dominant === 'chaos' || dominant === 'confusion') {
      return "Your recent entries have formed rapidly shifting, fragmented clusters.";
    } else if (dominant === 'hope' || dominant === 'wonder') {
      return "New horizons and arcs of light are emerging steadily.";
    }

    return "Your universe is maintaining a steady balance of contrasting forces.";
  }

  _generatePatternNote(entries) {
    // Check tags
    const tagCounts = {};
    const tagHeaviness = {};
    
    entries.forEach(e => {
      e.tags.forEach(t => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
        if (['stress', 'anger', 'fear', 'sadness', 'confusion'].includes(e.emotion)) {
          tagHeaviness[t] = (tagHeaviness[t] || 0) + e.intensity;
        }
      });
    });

    const tagsArr = Object.keys(tagCounts);
    if (tagsArr.length > 0) {
      const topTag = tagsArr.sort((a,b) => tagCounts[b] - tagCounts[a])[0];
      const heaviness = tagHeaviness[topTag] || 0;
      
      if (heaviness > tagCounts[topTag] * 1.5) {
        return `Moments linked to ${topTag} seem particularly dense and heavy lately.`;
      } else {
        return `The theme of ${topTag} has been a frequent gravitational center.`;
      }
    }

    // If no tags, look at day streaks or shifts
    const last3 = entries.slice(-3);
    const allLight = last3.every(e => !['stress', 'anger', 'fear'].includes(e.emotion));
    if (allLight) {
      return "There is a noticeable clearing of darker matter over the past few entries.";
    }

    return "A diverse mix of emotions are orbiting each other.";
  }

  _generateGentlePrompt(entries) {
    const lastEmotion = entries[entries.length - 1].emotion;
    
    if (['stress', 'anger', 'fear'].includes(lastEmotion)) {
      return "Remember that even the most volatile stars eventually collapse into stillness.";
    } else if (['sadness', 'confusion'].includes(lastEmotion)) {
      return "Allow the cosmic dust to settle without forcing it into a shape.";
    } else if (['joy', 'wonder', 'love'].includes(lastEmotion)) {
      return "Bask in the warmth of this stable formation while it lasts.";
    }

  }

  getArchetypeLabel(clusterEntities) {
    if (clusterEntities.length < 3) return null;

    const emotions = clusterEntities.map(e => e.emotion);
    const counts = {};
    emotions.forEach(e => counts[e] = (counts[e]||0)+1);
    
    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
    const dominant = sorted[0][0];

    // Naming Logic
    const archetypes = {
      stress: ['Resilience Belt', 'High-Tension Zone', 'The Pressure Cluster'],
      joy: ['The Radiance Field', 'Basker’s Orbit', 'Golden Sector'],
      calm: ['Serenity Plane', 'The Stillness Arc', 'Pacific Corridor'],
      sadness: ['Echo Canyon', 'Blue Horizon', 'Grief Plateau'],
      hope: ['Horizon of Dawns', 'Emerge Axis', 'Beacon Cluster'],
      wonder: ['Curiosity Nebula', 'Awe Rift', 'The Open Void'],
      anger: ['Forge Sector', 'The Friction Ring', 'Catalyst zone']
    };

    const list = archetypes[dominant] || ['Emotional Outpost', 'Memory Cluster', 'Observation Point'];
    
    // Use first entity id to pick a consistent name from the list
    const index = parseInt(clusterEntities[0].id, 36) % list.length;
    return list[index];
  }

  getClusterNarrative(label, entities) {
    const dominant = entities[0].emotion; // simplified
    const intensity = entities.reduce((acc, e) => acc + e.intensity, 0) / entities.length;

    if (intensity > 0.8) {
      return `A powerful focus on ${dominant} that defines your recent internal landscape.`;
    }
    return `A subtle gathering of ${dominant} thoughts forming a persistent presence.`;
  }
}
