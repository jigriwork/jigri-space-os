/**
 * StorageEngine — Manages persistent emotional memory for LUMA
 */

const STORAGE_KEY = 'luma_universe_data';
const MAX_ENTRIES = 500;

export class StorageEngine {
  constructor() {
    this.data = this._loadData();
  }

  _loadData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Could not load LUMA data:', e);
    }
    return this._getDefaultData();
  }

  _getDefaultData() {
    return {
      entries: [],
      entities: [],
      streak: 0,
      lastCheckIn: null,
      stats: {
        totalEntries: 0,
        emotionCounts: {}
      }
    };
  }

  saveEntry(text, intensity, tags, emotionData, entityId) {
    const now = Date.now();
    const entry = {
      id: Math.random().toString(36).slice(2, 10),
      text,
      intensity,
      tags,
      emotion: emotionData.emotion,
      score: emotionData.score,
      timestamp: now,
      entityId
    };

    this.data.entries.push(entry);
    this.data.stats.totalEntries++;
    
    if (!this.data.stats.emotionCounts[emotionData.emotion]) {
      this.data.stats.emotionCounts[emotionData.emotion] = 0;
    }
    this.data.stats.emotionCounts[emotionData.emotion]++;

    this._updateStreak(now);
    this._enforceLimit();
    this._persist();

    return entry;
  }

  saveEntity(entityState) {
    this.data.entities.push(entityState);
    this._persist();
  }

  updateEntities(currentEntitiesState) {
    this.data.entities = currentEntitiesState;
    this._persist();
  }

  _updateStreak(now) {
    if (!this.data.lastCheckIn) {
      this.data.streak = 1;
    } else {
      const lastCheckInDate = new Date(this.data.lastCheckIn);
      const nowDate = new Date(now);
      
      // Zero out time to compare days easily
      lastCheckInDate.setHours(0, 0, 0, 0);
      nowDate.setHours(0, 0, 0, 0);
      
      const diffTime = Math.abs(nowDate - lastCheckInDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      if (diffDays === 1) {
        this.data.streak++;
      } else if (diffDays > 1) {
        this.data.streak = 1;
      }
    }
    this.data.lastCheckIn = now;
  }

  _enforceLimit() {
    if (this.data.entries.length > MAX_ENTRIES) {
      this.data.entries = this.data.entries.slice(-MAX_ENTRIES);
    }
    if (this.data.entities.length > MAX_ENTRIES) {
      this.data.entities = this.data.entities.slice(-MAX_ENTRIES);
    }
  }

  _persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Could not save LUMA data:', e);
    }
  }
  
  getEntries() {
    return this.data.entries;
  }

  getRecentEntries(days = 7) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    return this.data.entries.filter(e => e.timestamp >= cutoff);
  }

  getEntities() {
    return this.data.entities;
  }

  getStats() {
    return this.data.stats;
  }

  getStreak() {
    return this.data.streak;
  }

  hasCheckedInToday() {
    if (!this.data.lastCheckIn) return false;
    const lastCheckInDate = new Date(this.data.lastCheckIn);
    const nowDate = new Date();
    return lastCheckInDate.toDateString() === nowDate.toDateString();
  }

  clear() {
    this.data = this._getDefaultData();
    this._persist();
  }
}
