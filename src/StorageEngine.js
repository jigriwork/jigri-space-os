const STORAGE_KEY = 'jigri_memory';
const MAX_ECHOES = 24;

export class StorageEngine {
    constructor() {
        this.data = this._load();
    }

    _load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return { echoes: [], session: null, conversationId: null };
            const parsed = JSON.parse(raw);
            return {
                echoes: Array.isArray(parsed.echoes) ? parsed.echoes.slice(0, MAX_ECHOES) : [],
                session: parsed.session && typeof parsed.session === 'object' ? parsed.session : null,
                conversationId: typeof parsed.conversationId === 'string' ? parsed.conversationId : null
            };
        } catch (e) {
            console.warn('Could not load Jigri memory:', e);
            return { echoes: [], session: null, conversationId: null };
        }
    }

    _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn('Could not persist Jigri memory:', e);
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
        this.data = { echoes: [], session: this.data.session || null, conversationId: this.data.conversationId || null };
        this._persist();
    }

    getSession() {
        return this.data.session || null;
    }

    saveSession(session) {
        this.data.session = session || null;
        this._persist();
    }

    clearSession() {
        this.data.session = null;
        this.data.conversationId = null;
        this._persist();
    }

    getConversationId() {
        return this.data.conversationId || null;
    }

    saveConversationId(conversationId) {
        this.data.conversationId = conversationId || null;
        this._persist();
    }
}
