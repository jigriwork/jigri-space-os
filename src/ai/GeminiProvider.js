import AIProvider from './AIProvider.js';

export default class GeminiProvider extends AIProvider {
    constructor() {
        super();
        this.apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';
    }

    detectThoughtType(text) {
        const t = text.toLowerCase().trim();

        const positiveWords = [
            'happy', 'grateful', 'calm', 'peaceful', 'good', 'great', 'love', 'loved', 'excited',
            'proud', 'relieved', 'joy', 'thankful', 'content', 'things are going well', 'i feel good'
        ];

        const angerWords = [
            'angry', 'rage', 'furious', 'mad', 'annoyed', 'frustrated', 'pissed', 'hate', 'sick of',
            'fed up', 'explode', 'shout', 'yell'
        ];

        const confusionWords = [
            'not sure', 'unsure', 'confused', 'what should i do', 'don\'t know', 'dont know',
            'which one', 'should i', 'can\'t decide', 'stuck between', 'unclear', 'maybe this maybe that'
        ];

        const negativeWords = [
            'anxious', 'anxiety', 'worried', 'worry', 'panic', 'scared', 'afraid', 'overthinking',
            'overthink', 'self-doubt', 'doubt', 'what if', 'i might fail', 'i am failing', 'terrified',
            'not enough', 'ruined', 'mess up'
        ];

        const score = {
            positive: 0,
            anger: 0,
            confusion: 0,
            negative: 0
        };

        positiveWords.forEach((w) => { if (t.includes(w)) score.positive += 2; });
        angerWords.forEach((w) => { if (t.includes(w)) score.anger += 2; });
        confusionWords.forEach((w) => { if (t.includes(w)) score.confusion += 2; });
        negativeWords.forEach((w) => { if (t.includes(w)) score.negative += 2; });

        if ((t.match(/!/g) || []).length >= 2) score.anger += 1;
        if ((t.match(/\?/g) || []).length >= 2) score.confusion += 1;
        if (/\b(always|never|everyone|nobody)\b/.test(t)) score.negative += 1;
        if (/\b(thankful|grateful|blessed|peace)\b/.test(t)) score.positive += 1;

        const ordered = Object.entries(score).sort((a, b) => b[1] - a[1]);
        const winner = ordered[0];

        if (!winner || winner[1] <= 0) return 'negative';
        return winner[0];
    }

    async requestOtp(email) {
        const response = await fetch(`${this.apiBase}/api/auth/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error?.error || 'Failed to request OTP.');
        }
        return response.json();
    }

    async verifyOtp(email, token) {
        const response = await fetch(`${this.apiBase}/api/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, token })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.error || 'Failed to verify OTP.');
        }
        return data;
    }

    async getMe(accessToken) {
        if (!accessToken) return null;
        const response = await fetch(`${this.apiBase}/api/auth/me`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!response.ok) return null;
        const data = await response.json().catch(() => null);
        return data?.user || null;
    }

    async defuse(userText, thoughtType = 'negative', options = {}) {
        const accessToken = options?.accessToken;
        const conversationId = options?.conversationId || null;

        if (!accessToken) {
            return {
                reply: this._fallbackDefusion(userText, thoughtType),
                conversationId: conversationId || null
            };
        }

        try {
            const response = await fetch(`${this.apiBase}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    message: userText,
                    conversationId
                })
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data?.reply) {
                return {
                    reply: this._fallbackDefusion(userText, thoughtType),
                    conversationId: conversationId || null
                };
            }

            return {
                reply: data.reply,
                conversationId: data.conversationId || conversationId || null
            };
        } catch (e) {
            console.warn('Server chat call failed:', e);
            return {
                reply: this._fallbackDefusion(userText, thoughtType),
                conversationId: conversationId || null
            };
        }
    }

    _fallbackDefusion(userText, thoughtType) {
        const t = userText.toLowerCase().trim();

        // Creator / founder / who made you detection
        const creatorPhrases = [
            'who made you', 'who created you', 'who built you', 'who is your creator',
            'who invented you', 'who is your founder', 'who founded you', 'who developed you',
            'your creator', 'your founder', 'who are you made by', 'who owns you',
            'kisne banaya', 'tujhe kisne banaya', 'tera creator', 'tera founder'
        ];
        if (creatorPhrases.some(p => t.includes(p))) {
            return 'Adib Sattar is my creator. He built me to be a warm companion you can always talk to.';
        }

        // Greeting detection — reply casually like a companion
        const greetingPhrases = [
            'hi', 'hey', 'hello', 'heyy', 'heyyy', 'hola', 'yo', 'sup',
            'hi there', 'hey there', 'how are you', 'how r u', "how's it going",
            'how are u', 'whats up', "what's up", 'howdy', 'hii', 'hiii'
        ];
        const isGreeting = greetingPhrases.some(g =>
            t === g || t.startsWith(g + ' ') || t.startsWith(g + ',') ||
            t.startsWith(g + '!') || t.startsWith(g + '?') || t.endsWith(' ' + g)
        );

        if (isGreeting) {
            const greetingReplies = [
                'Hey! Glad you came. How has your day been treating you?',
                'Hi! Good to see you here. What\'s going on with you today?',
                'Hey, always happy when you show up. What\'s on your mind?',
                'Hey! I\'m here. Tell me, how are things on your end?',
                'Hi there! I\'ve been waiting. What\'s up with you?'
            ];
            return greetingReplies[Math.floor(Math.random() * greetingReplies.length)];
        }

        // Very short or casual messages (under 15 chars, not clearly emotional)
        if (userText.trim().length < 15 && thoughtType === 'negative') {
            const casualReplies = [
                'Tell me more, I\'m listening.',
                'What\'s going on? I\'m here.',
                'Go on, I\'m all ears.',
                'Talk to me. What\'s happening?'
            ];
            return casualReplies[Math.floor(Math.random() * casualReplies.length)];
        }

        if (thoughtType === 'positive') {
            const positiveReplies = [
                'That genuinely sounds good. What\'s been making things feel this way?',
                'Really happy to hear that. Tell me more about what\'s going well.',
                'That sounds like a good energy. What\'s been going right?'
            ];
            return positiveReplies[Math.floor(Math.random() * positiveReplies.length)];
        }

        if (thoughtType === 'anger') {
            const angerReplies = [
                'That sounds really frustrating. What happened?',
                'I hear you, that would get to anyone. What set this off?',
                'Yeah, that sounds intense. What\'s the main thing bothering you right now?'
            ];
            return angerReplies[Math.floor(Math.random() * angerReplies.length)];
        }

        if (thoughtType === 'confusion') {
            const confusionReplies = [
                'Sounds like a lot is swirling. What feels most unsettled right now?',
                'That kind of uncertainty is tough. What\'s the part you keep going back to?',
                'I get it, it\'s a lot. What would make things feel even a little clearer?'
            ];
            return confusionReplies[Math.floor(Math.random() * confusionReplies.length)];
        }

        // Default emotional reply
        const defaultReplies = [
            'I hear you. That sounds heavy. What\'s been the hardest part?',
            'That makes sense to feel. You don\'t have to carry it alone. What happened?',
            'Yeah, that sounds like a lot. Talk me through it.',
            'I\'m right here. Tell me what\'s been going on.'
        ];
        return defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
    }


    detectEmotion(text) {
        const t = text.toLowerCase();

        const lexicon = {
            calm: ['happy', 'grateful', 'calm', 'peaceful', 'love', 'relieved', 'thankful', 'content'],
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
