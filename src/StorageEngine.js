const STORAGE_KEY = 'luma_defusion_memory';
const MAX_ECHOES = 24;

export class StorageEngine {
    constructor() {
        this.data = this._load();
    }

    _load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return { echoes: [] };
            const parsed = JSON.parse(raw);
            return {
                echoes: Array.isArray(parsed.echoes) ? parsed.echoes.slice(0, MAX_ECHOES) : []
            };
        } catch (e) {
            console.warn('Could not load LUMA memory:', e);
            return { echoes: [] };
        }
    }

    _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn('Could not persist LUMA memory:', e);
        }
    }

    getEchoes() {
        return this.data.echoes;
    }

    saveEcho(echo) {
        if (!echo) return;
        this.data.echoes.push(echo);
        if (this.data.echoes.length > MAX_ECHOES) {
            this.data.echoes = this.data.echoes.slice(-MAX_ECHOES);
        }
        this._persist();
    }

    clearMemory() {
        this.data = { echoes: [] };
        this._persist();
    }
}
