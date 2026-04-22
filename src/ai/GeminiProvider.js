import AIProvider from './AIProvider.js';

export default class GeminiProvider extends AIProvider {
    constructor() {
        super();
        this.apiKey = process.env.GEMINI_API_KEY;
        this.endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`;
    }

    async defuse(userText) {
        if (!this.apiKey) {
            return this._fallbackDefusion(userText);
        }

        const prompt = `SYSTEM:
You are a cognitive defusion assistant.

USER INPUT:
${userText}

TASK:
- separate thought from reality
- identify distortion
- reframe as “You are having the thought that…”

RULES:
- no advice
- no emotional language
- no reassurance
- no fluff
- max 3 lines`;

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            if (!response.ok) {
                return this._fallbackDefusion(userText);
            }

            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (!text) return this._fallbackDefusion(userText);

            return text
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .slice(0, 3)
                .join('\n');
        } catch (e) {
            console.warn('Gemini call failed:', e);
            return this._fallbackDefusion(userText);
        }
    }

    _fallbackDefusion(userText) {
        const cleaned = userText.trim().replace(/[.!?]+$/, '');
        return [
            `You are having the thought that ${cleaned}.`,
            'This statement does not confirm objective reality.',
            'Likely distortion: projection or catastrophizing.'
        ].join('\n');
    }

    detectEmotion(text) {
        const t = text.toLowerCase();

        const lexicon = {
            anger: ['angry', 'hate', 'furious', 'rage', 'mad', 'annoyed', 'frustrated', 'idiot'],
            fear: ['scared', 'afraid', 'panic', 'anxious', 'terrified', 'fired', 'ruined', 'lose'],
            confusion: ['confused', 'stuck', 'what if', 'unsure', 'maybe', 'dont know', "don't know"],
            sadness: ['sad', 'empty', 'lonely', 'hopeless', 'worthless', 'down'],
            stress: ['stress', 'stressed', 'overwhelmed', 'pressure', 'deadline', 'too much', 'exhausted']
        };

        let best = 'stress';
        let score = -1;

        for (const [emotion, words] of Object.entries(lexicon)) {
            const current = words.reduce((acc, word) => acc + (t.includes(word) ? 1 : 0), 0);
            if (current > score) {
                score = current;
                best = emotion;
            }
        }

        return best;
    }

    estimateIntensity(text) {
        const t = text.toLowerCase();
        let intensity = 0.45;

        const capsRatio = (text.match(/[A-Z]/g) || []).length / Math.max(1, text.length);
        if (capsRatio > 0.35) intensity += 0.22;

        const punctuationLoad = (text.match(/[!?]/g) || []).length;
        intensity += Math.min(0.18, punctuationLoad * 0.03);

        const absoluteWords = ['always', 'never', 'everyone', 'nobody', 'ruined', 'disaster', 'over'];
        absoluteWords.forEach((word) => {
            if (t.includes(word)) intensity += 0.05;
        });

        if (text.length > 180) intensity += 0.08;
        if (text.length > 340) intensity += 0.08;

        return Math.max(0.25, Math.min(1, intensity));
    }
}
