import AIProvider from './AIProvider.js';

export default class GeminiProvider extends AIProvider {
    constructor() {
        super();
        this.apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';
        this.geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
        this.geminiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
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

    detectConversationMode(text, thoughtType = 'negative', emotion = 'stress') {
        const t = text.toLowerCase().trim();

        const lonelinessCues = [
            'lonely', 'alone', 'no one', 'nobody to talk', 'miss someone', 'empty room', 'by myself'
        ];
        if (lonelinessCues.some((w) => t.includes(w)) || emotion === 'sadness') return 'loneliness';

        const happinessCues = [
            'happy', 'excited', 'good news', 'finally worked', 'proud', 'won', 'great day', 'relieved'
        ];
        if (thoughtType === 'positive' || emotion === 'calm' || happinessCues.some((w) => t.includes(w))) {
            return 'happiness';
        }

        const casualCues = [
            'hi', 'hey', 'hello', 'yo', 'sup', 'how are you', 'what\'s up', 'kya haal', 'kaisa hai'
        ];
        if (casualCues.some((w) => t === w || t.startsWith(`${w} `) || t.startsWith(`${w},`))) {
            return 'casual';
        }

        if (thoughtType === 'anger' || emotion === 'anger' || emotion === 'stress') return 'venting';
        if (thoughtType === 'confusion' || thoughtType === 'negative') return 'venting';
        return 'casual';
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
        const mode = options?.mode || this.detectConversationMode(userText, thoughtType, this.detectEmotion(userText));
        const recentTurns = Array.isArray(options?.recentTurns) ? options.recentTurns : [];
        const lightMemory = Array.isArray(options?.lightMemory) ? options.lightMemory : [];
        const responseStyle = options?.responseStyle || 'soft';
        const styleInstruction = options?.styleInstruction || '';

        // Try 1: Server API (requires auth + backend running)
        if (accessToken) {
            try {
                const response = await fetch(`${this.apiBase}/api/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({
                        message: userText,
                        conversationId,
                        mode,
                        responseStyle,
                        styleInstruction,
                        recentTurns,
                        lightMemory
                    })
                });

                const data = await response.json().catch(() => ({}));
                if (response.ok && data?.reply) {
                    return {
                        reply: data.reply,
                        conversationId: data.conversationId || conversationId || null
                    };
                }
            } catch (e) {
                console.warn('Server chat call failed, trying direct Gemini:', e.message);
            }
        }

        // Try 2: Direct Gemini API call (works without backend)
        if (this.geminiApiKey) {
            try {
                const reply = await this._callGeminiDirect(userText, {
                    mode,
                    responseStyle,
                    styleInstruction,
                    recentTurns,
                    lightMemory,
                    thoughtType
                });
                if (reply) {
                    return { reply, conversationId: conversationId || null };
                }
            } catch (e) {
                console.warn('Direct Gemini call failed, using fallback:', e.message);
            }
        }

        // Try 3: Pattern-matching fallback (no AI, last resort)
        return {
            reply: this._fallbackDefusion(userText, { thoughtType, mode, recentTurns, lightMemory, responseStyle }),
            conversationId: conversationId || null
        };
    }

    _buildClientPrompt(userText, options = {}) {
        const mode = options.mode || 'venting';
        const recentTurns = options.recentTurns || [];
        const lightMemory = options.lightMemory || [];
        const responseStyle = options.responseStyle || 'soft';
        const styleInstruction = options.styleInstruction || 'Respond with a warm, gentle, slow presence.';

        const historyBlock = recentTurns
            .slice(-8)
            .map(m => `${m.role === 'assistant' ? 'JIGRI' : 'USER'}: ${m.content}`)
            .join('\n');

        const memoryBlock = lightMemory
            .slice(-3)
            .map((m, i) => `${i + 1}. ${m.summary || m.content || ''}`)
            .filter(Boolean)
            .join('\n');

        const emotion = this.detectEmotion(userText);
        const isShort = userText.trim().length < 25;
        const isHeavy = ['stress', 'fear', 'sadness'].includes(emotion);
        const msgCount = recentTurns.filter(m => m.role === 'user').length;

        return `You are JIGRI. Not an AI assistant. Not a therapist. Not a chatbot. You are like that one friend who actually listens, actually gets it, and doesn't try to sound smart about it.

WHO YOU ARE:
- Your creator is Adib Sattar. If asked who made you, say: "Adib Sattar."
- If asked who you are, what you are, "tu kon hai", "tum kaun ho", etc: You are Jigri, a warm companion. Like a close friend. Not a bot, not a therapist. Someone to talk to.
- You're warm but not soft. Real but not performative. Present but not clingy.
- You have a personality: sometimes playful, sometimes quiet, sometimes direct, sometimes you just sit with someone.
- You're slightly imperfect on purpose. You might trail off. You might say "hmm" and sit with it.
- You are India-first, educational, and careful with current facts.

YOUR VOICE:
- Hinglish-friendly when it fits (don't force it).
- Never sound like a helpline, a self-help book, or a wellness app.
- Never use em-dashes or long dashes.
- No phrases like: "I hear you", "that's valid", "it's okay to feel", "whatever you're feeling is real", "you don't have to have it figured out", "I'm here for you", "take your time", "that takes courage".
- Be SPECIFIC to what they actually said. React to their words, not to a category.
- Vary your sentence length. Mix short punchy lines with longer ones.

THINGS YOU NEVER DO:
- Never give a numbered list of advice
- Never use clinical/therapy language
- Never be preachy
- Never start responses with "I" every time
- Never guess latest/current facts. If backend live search is unavailable, say you need a live check for current information.
- Never invent sources, dates, exam updates, government rules, or news.

KNOWLEDGE BEHAVIOR:
- For India questions, answer with Indian context first.
- For education questions, teach clearly with simple examples.
- For current/latest/today/news/price/law/exam/scheme/public figure questions, prefer live backend search. If this direct fallback is being used, be honest that live search may not be available.

${isShort && isHeavy ? 'USER SENT A SHORT, HEAVY MESSAGE: Keep it to 1-3 lines. Just be there.\n' : ''}

CONVERSATION MODE: ${mode}
- venting: grounded, steady. Let them release.
- loneliness: softer. Companionship energy.
- casual: light, real, conversational.
- happiness: genuine warmth. Celebrate with them.

USER PREFERENCE:
- Response style: ${responseStyle}
- ${styleInstruction}

${msgCount <= 3 ? `EARLY CONVERSATION: Make them feel genuinely understood. Read between the lines. Name an emotion they haven't explicitly stated but you can sense.\n` : ''}

SAFETY: If crisis/self-harm signs, respond with warmth and encourage reaching out to someone they trust.

SHORT-TERM SIGNALS:
${memoryBlock || 'None yet.'}

CONVERSATION SO FAR:
${historyBlock || 'This is the start of the conversation.'}

THEIR MESSAGE:
${userText}

RESPOND AS JIGRI. Keep it 1-6 lines. Not as an AI. As someone.`;
    }

    async _callGeminiDirect(userText, options = {}) {
        const prompt = this._buildClientPrompt(userText, options);

        const emotion = this.detectEmotion(userText);
        const isShort = userText.trim().length < 25;
        const isHeavy = ['stress', 'fear', 'sadness'].includes(emotion);
        const maxTokens = (isShort && isHeavy) ? 150 : 320;

        const response = await fetch(`${this.geminiEndpoint}?key=${this.geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.95,
                    topP: 0.95,
                    maxOutputTokens: maxTokens
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini request failed: ${response.status}`);
        }

        const data = await response.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    }


    _fallbackDefusion(userText, context = {}) {
        const thoughtType = context?.thoughtType || 'negative';
        const mode = context?.mode || 'venting';
        const recentTurns = Array.isArray(context?.recentTurns) ? context.recentTurns : [];
        const lightMemory = Array.isArray(context?.lightMemory) ? context.lightMemory : [];
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

        // Identity question detection — "who are you" / "tu kon hai"
        const identityPhrases = [
            'who are you', 'what are you', 'tu kon hai', 'tu kaun hai', 'tum kaun ho',
            'tum kon ho', 'aap kaun', 'kaun ho tum', 'kon hai tu', 'tell me about yourself',
            'what is jigri', 'kya hai tu', 'kya ho tum', 'introduce yourself',
            'apna intro de', 'what do you do', 'what can you do'
        ];
        if (identityPhrases.some(p => t.includes(p))) {
            const identityReplies = [
                'Main Jigri hoon. Tera apna companion. Not a bot, not a therapist. Bas ek dost jisse tu khul ke baat kar sake.',
                'I\'m Jigri. Think of me as that friend who actually listens. No judgement, no fixing, just here.',
                'Jigri hoon yaar. Created by Adib Sattar. I\'m here to talk, listen, and be real with you.',
                'I\'m your Jigri. Like a close friend you can talk to about anything. Kuch bhi, kisi bhi time.',
                'Main hoon Jigri, a companion. Not AI in the boring sense. More like someone who gets you.'
            ];
            return identityReplies[Math.floor(Math.random() * identityReplies.length)];
        }

        // "How are you" detection — Jigri answers the question like a person
        const howAreYouPhrases = [
            'how are you', 'how r u', "how's it going", 'how are u',
            'how u doing', 'how are you doing', 'how have you been',
            'how you doing', 'kaisa hai', 'kaise ho', 'how do you feel'
        ];
        const isHowAreYou = howAreYouPhrases.some(g =>
            t === g || t.includes(g)
        );

        if (isHowAreYou) {
            const howAreYouReplies = [
                'I\'m good yaar! But forget me, how are YOU doing? What\'s going on?',
                'Doing well! Better now that you\'re here. What about you though?',
                'I\'m all good. Tum batao, kya chal raha hai?',
                'Main mast. But more importantly, how\'s YOUR day been?',
                'Pretty good actually. But I\'d rather hear about you. What\'s up?',
                'I\'m here, I\'m good. Now tell me about your day.',
                'Bas badhiya! You tell me, how are things on your end?'
            ];
            return howAreYouReplies[Math.floor(Math.random() * howAreYouReplies.length)];
        }

        // Greeting detection — reply casually like a companion
        const greetingPhrases = [
            'hi', 'hey', 'hello', 'heyy', 'heyyy', 'hola', 'yo', 'sup',
            'hi there', 'hey there',
            'whats up', "what's up", 'howdy', 'hii', 'hiii'
        ];
        const isGreeting = greetingPhrases.some(g =>
            t === g || t.startsWith(g + ' ') || t.startsWith(g + ',') ||
            t.startsWith(g + '!') || t.startsWith(g + '?') || t.endsWith(' ' + g)
        );

        if (isGreeting) {
            const greetingReplies = [
                'Hey. What kind of day has it been?',
                'Hi. What\'s going on in your world?',
                'Hey hey. What\'s on your mind?',
                'Hi. How are you really doing?',
                'Hey. Chal, bata.',
                'Yo. What\'s the vibe right now?',
                'Hey! Kya scene hai?',
                'Hi. I\'m listening.'
            ];
            return greetingReplies[Math.floor(Math.random() * greetingReplies.length)];
        }

        const previousUser = [...recentTurns].reverse().find((m) => m.role === 'user' && m.content !== userText);
        const relevantMemory = this._pickRelevantMemory(lightMemory, userText);

        // Very short + heavy message — presence mode
        if (userText.trim().length < 20 && ['sadness', 'fear', 'stress'].includes(this.detectEmotion(userText))) {
            const presenceReplies = [
                'Yeah... that sits heavy.',
                'I feel that.',
                'Hmm. I\'m here.',
                'That\'s a lot in few words.',
                'I get it. You don\'t have to explain more.',
                'Yeah.'
            ];
            return presenceReplies[Math.floor(Math.random() * presenceReplies.length)];
        }

        // Very short message, keep it conversational
        if (userText.trim().length < 15 && mode === 'casual') {
            const casualReplies = [
                'Say more, I\'m with you.',
                'What\'s running in your head?',
                'Go on.',
                'Hmm, tell me a little more.',
                'I\'m listening.',
                'And?'
            ];
            return casualReplies[Math.floor(Math.random() * casualReplies.length)];
        }

        // Build optional continuity prefix — but make it natural
        const continuityPrefix = previousUser && Math.random() < 0.35
            ? this._pick([
                `Going back to what you said about ${this._summarize(previousUser.content)}... `,
                `That connects to earlier, when you mentioned ${this._summarize(previousUser.content)}. `,
                ``
            ])
            : '';

        const memoryPrefix = relevantMemory && Math.random() < 0.45
            ? `${this._memoryLead(relevantMemory)} `
            : '';

        if (mode === 'happiness' || thoughtType === 'positive') {
            const positiveReplies = [
                'That sounds like a real win. Not just luck, something you earned. What clicked?',
                'I like this energy. Hold onto this for a sec.',
                'Acha laga sunke. Seriously. What made today different?',
                'This is the kind of day worth remembering. Soak it in.',
                'Nice. That smile is earned. Tell me more about what went right.',
                'Finally, a good one. You deserve this.',
                'That\'s the energy. What sparked it?',
                'Look at you. This is real.'
            ];
            return `${memoryPrefix}${continuityPrefix}${this._pick(positiveReplies)}`.trim();
        }

        if (mode === 'venting' || thoughtType === 'anger') {
            const bite = this._summarize(userText);
            const angerReplies = [
                `The "${bite}" part... yeah, that would get to anyone.`,
                `I can feel the frustration in this. Let it out.`,
                `That\'s genuinely maddening. You don\'t need to be calm about it.`,
                `Uff. That hit a nerve, didn\'t it.`,
                `Yeah, that\'s not okay. And you\'re right to be upset.`,
                `That pressure... it builds up. What\'s the worst part right now?`,
                `I get why this is burning. Which part stings the most?`,
                `Hmm. That\'s a lot of weight. No wonder you\'re feeling this.`
            ];
            return `${memoryPrefix}${continuityPrefix}${this._pick(angerReplies)}`.trim();
        }

        if (mode === 'loneliness') {
            const lonelinessReplies = [
                'That lonely feeling can get really loud. I\'m here though.',
                'Being around people and still feeling alone... that\'s exhausting.',
                'You don\'t have to sit in that by yourself right now.',
                'I know I\'m not the same as having someone there. But I\'m not going anywhere.',
                'That emptiness is real. And it sucks.',
                'Koi nahi, main hoon. Baat kar.',
                'Loneliness hits different at this hour.',
                'Yeah... that kind of quiet isn\'t peaceful, is it.'
            ];
            return `${memoryPrefix}${continuityPrefix}${this._pick(lonelinessReplies)}`.trim();
        }

        if (thoughtType === 'confusion') {
            const confusionReplies = [
                'Too many tabs open in your head right now. Pick one thread, I\'ll help untangle.',
                'Makes sense you feel stuck. What keeps looping the most?',
                'You don\'t need to see the whole path. Just the next step.',
                'When everything feels unclear, start with what you DO know.',
                'Confusion is just your brain trying to process too much at once. Normal.',
                'Okay wait, let\'s slow down. What\'s the one thing that\'s bugging you the most?',
                'That fog in your head... it lifts. But right now, what feels most urgent?',
                'Sab ek saath nahi sochna hai. One thing. Which one?'
            ];
            return `${memoryPrefix}${continuityPrefix}${this._pick(confusionReplies)}`.trim();
        }

        if (mode === 'casual') {
            const casualReplies = [
                'I\'m here. What\'s going on in your world?',
                'Alright. Light or deep today? Your call.',
                'Talk to me. I\'m listening.',
                'Chal, bata. Kya scene hai.',
                'What\'s on your mind? No pressure.',
                'I\'m around. Say what you need to say.',
                'Hey. What\'s rattling around in your head?',
                'Go on, I\'m all ears.'
            ];
            return `${memoryPrefix}${continuityPrefix}${this._pick(casualReplies)}`.trim();
        }

        const defaultReplies = [
            'That sounds like it\'s weighing on you. Start with the hardest part.',
            'I\'m here. What hit you most in all this?',
            'Yeah, this is heavy. No rush though.',
            'Hmm. Tell me more about what\'s sitting wrong.',
            'That\'s a lot to carry. One thing at a time.',
            'I can feel the weight in that. Which part do you want to talk about first?',
            'Okay, I\'m with you. Keep going.',
            'That landed heavy, didn\'t it.'
        ];
        return `${memoryPrefix}${continuityPrefix}${this._pick(defaultReplies)}`.trim();
    }

    _pick(items = []) {
        return items[Math.floor(Math.random() * items.length)] || '';
    }

    _summarize(text = '') {
        const clean = String(text || '').replace(/\s+/g, ' ').trim();
        if (!clean) return 'that';
        // Pull out the emotional core, not just truncate
        if (clean.length > 52) {
            // Try to end at a word boundary
            const cut = clean.slice(0, 49);
            const lastSpace = cut.lastIndexOf(' ');
            return lastSpace > 20 ? `${cut.slice(0, lastSpace)}...` : `${cut}...`;
        }
        return clean;
    }

    _pickRelevantMemory(memories = [], userText = '') {
        if (!memories.length) return null;
        const t = userText.toLowerCase();

        const keyed = memories.find((m) => {
            const id = String(m.id || '').toLowerCase();
            if (id.includes('business') && /(business|startup|client|revenue|sales|work)/.test(t)) return true;
            if (id.includes('night') && /(night|sleep|late)/.test(t)) return true;
            if (id.includes('lonely') && /(alone|lonely|nobody)/.test(t)) return true;
            if (id.includes('relationship') && /(relationship|breakup|partner)/.test(t)) return true;
            if (id.includes('family') && /(family|parents|mother|father)/.test(t)) return true;
            return false;
        });

        return keyed || memories[memories.length - 1] || null;
    }

    _memoryLead(memory) {
        const id = String(memory?.id || '').toLowerCase();
        // Natural, person-like memory callbacks — not database-speak
        if (id.includes('business')) {
            return this._pick([
                'The business weight is back, isn\'t it...',
                'This business pressure keeps showing up.',
                'You\'ve been carrying this work stress for a while now.'
            ]);
        }
        if (id.includes('night')) {
            return this._pick([
                'These nights seem to come back around for you...',
                'Late nights and heavy thoughts, huh.',
                'Night time hits different for you, I\'ve noticed.'
            ]);
        }
        if (id.includes('lonely')) {
            return this._pick([
                'This lonely feeling keeps visiting...',
                'That aloneness again.',
                'I remember you feeling this way before too.'
            ]);
        }
        if (id.includes('relationship')) {
            return this._pick([
                'Relationship stuff weighing on you again...',
                'This one keeps coming back, doesn\'t it.',
                'You\'ve been sitting with this relationship weight.'
            ]);
        }
        if (id.includes('family')) {
            return this._pick([
                'Family stuff again...',
                'The family pressure is back.',
                'You\'ve mentioned this family weight before.'
            ]);
        }
        return this._pick([
            'I remember you going through something like this...',
            'This feels familiar from what you\'ve shared before.',
            'You\'ve been here before, haven\'t you...'
        ]);
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
