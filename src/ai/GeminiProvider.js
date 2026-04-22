import AIProvider from './AIProvider.js';

export default class GeminiProvider extends AIProvider {
    constructor() {
        super();
        this.apiKey = process.env.GEMINI_API_KEY;
        this.endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`;
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

    _getPromptByType(userText, thoughtType) {
        const sharedRules = `STYLE:
- write like a grounded human
- 2 to 3 lines only
- no therapy jargon
- no robotic phrasing
- no fluff`;

        const prompts = {
            negative: `SYSTEM:
You help users create distance from anxious overthinking.

USER INPUT:
${userText}

TASK:
- reflect the thought naturally as "you\'re noticing the thought that..."
- separate thought from certainty, without sounding clinical
- keep tone steady and clear

${sharedRules}`,

            anger: `SYSTEM:
You help users de-escalate intense reaction before action.

USER INPUT:
${userText}

TASK:
- acknowledge the intensity directly
- create a pause between feeling and reaction
- point to what needs action later vs what is heat right now

${sharedRules}`,

            confusion: `SYSTEM:
You help users move from mental fog to simple clarity.

USER INPUT:
${userText}

TASK:
- name the uncertainty clearly
- organize the next step into 2-3 concrete options/questions
- keep response brief and practical

${sharedRules}`,

            positive: `SYSTEM:
You reinforce grounded positive states without overexplaining.

USER INPUT:
${userText}

TASK:
- validate the stable positive moment
- help the user stay with what is working
- keep it concise and real

${sharedRules}`
        };

        return prompts[thoughtType] || prompts.negative;
    }

    async defuse(userText, thoughtType = 'negative') {
        if (!this.apiKey) {
            return this._fallbackDefusion(userText, thoughtType);
        }

        const prompt = this._getPromptByType(userText, thoughtType);

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            if (!response.ok) {
                return this._fallbackDefusion(userText, thoughtType);
            }

            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (!text) return this._fallbackDefusion(userText, thoughtType);

            return text
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .slice(0, 3)
                .join('\n');
        } catch (e) {
            console.warn('Gemini call failed:', e);
            return this._fallbackDefusion(userText, thoughtType);
        }
    }

    _fallbackDefusion(userText, thoughtType) {
        const cleaned = userText.trim().replace(/[.!?]+$/, '');
        if (thoughtType === 'positive') {
            return [
                'This sounds grounded and real.',
                'Stay with this for a moment and notice what is supporting it.'
            ].join('\n');
        }

        if (thoughtType === 'anger') {
            return [
                'This feels intense right now.',
                'Pause for a breath and separate what is heat from what truly needs action.'
            ].join('\n');
        }

        if (thoughtType === 'confusion') {
            return [
                'You are in a decision fog right now.',
                'Name the top two options, then choose one next step for each.'
            ].join('\n');
        }

        return [
            `You\'re noticing the thought that ${cleaned}.`,
            'It feels convincing, but you can hold it as a thought instead of a certainty.'
        ].join('\n');
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
