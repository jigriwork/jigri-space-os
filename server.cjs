require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = Number(process.env.PORT || 8787);

app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
    const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
});

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SEARCH_PROVIDER = String(process.env.SEARCH_PROVIDER || 'duckduckgo').toLowerCase();
const BRAVE_SEARCH_API_KEY = process.env.BRAVE_SEARCH_API_KEY;
const SERPER_API_KEY = process.env.SERPER_API_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    // eslint-disable-next-line no-console
    console.warn('Missing required Supabase env vars (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).');
}

const supabaseAnon = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '');
const supabaseAdmin = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '');

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

function getTodayInIndia() {
    return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(new Date());
}

function stripHtml(value = '') {
    return String(value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

function decodeDuckDuckGoUrl(value = '') {
    try {
        const url = new URL(value);
        const nested = url.searchParams.get('uddg');
        return nested ? decodeURIComponent(nested) : value;
    } catch (_error) {
        return value;
    }
}

function isIndiaRelated(text = '') {
    const t = text.toLowerCase();
    const cues = [
        'india', 'indian', 'bharat', 'delhi', 'mumbai', 'bangalore', 'bengaluru', 'hyderabad',
        'chennai', 'kolkata', 'pune', 'aadhaar', 'aadhar', 'pan card', 'upi', 'gst', 'rbi',
        'sebi', 'supreme court of india', 'parliament', 'lok sabha', 'rajya sabha', 'modi',
        'pm of india', 'chief minister', 'cbse', 'icse', 'ncert', 'jee', 'neet', 'upsc',
        'ssc', 'railway exam', 'ias', 'ips', 'hindi', 'hinglish'
    ];
    return cues.some((cue) => t.includes(cue));
}

function isEducationRelated(text = '') {
    const t = text.toLowerCase();
    const cues = [
        'explain', 'teach', 'learn', 'study', 'notes', 'summary', 'summarize', 'quiz',
        'flashcard', 'homework', 'exam', 'syllabus', 'chapter', 'concept', 'formula',
        'math', 'science', 'history', 'geography', 'economics', 'coding', 'programming',
        'jee', 'neet', 'upsc', 'cbse', 'ncert', 'college', 'school'
    ];
    return cues.some((cue) => t.includes(cue));
}

function needsLiveKnowledge(text = '') {
    const t = text.toLowerCase();
    const liveCues = [
        'today', 'latest', 'current', 'currently', 'now', 'right now', 'this week', 'this month',
        'this year', 'yesterday', 'tomorrow', 'news', 'happening', 'update', 'updated',
        'price', 'rate', 'weather', 'score', 'match', 'election', 'result', 'winner',
        'prime minister', 'president', 'chief minister', 'ceo', 'law', 'scheme',
        'pm of india', 'cm of', 'minister', 'as of',
        'deadline', 'admit card', 'exam date', 'notification', 'cutoff', 'cut off',
        'release date', 'launched', 'trending'
    ];
    return liveCues.some((cue) => t.includes(cue));
}

function buildSearchQuery(message = '') {
    const clean = String(message || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    const suffix = isIndiaRelated(clean) ? ' India official latest' : ' latest';
    return `${clean.slice(0, 180)}${needsLiveKnowledge(clean) ? suffix : ''}`;
}

function formatSearchResults(results = []) {
    if (!results.length) return 'No live web results were found.';
    return results
        .slice(0, 5)
        .map((r, i) => `${i + 1}. ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet || 'No snippet available.'}`)
        .join('\n');
}

async function searchWithBrave(query, limit = 5) {
    if (!BRAVE_SEARCH_API_KEY) return [];
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(limit));
    url.searchParams.set('country', isIndiaRelated(query) ? 'IN' : 'US');
    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            'X-Subscription-Token': BRAVE_SEARCH_API_KEY
        }
    });
    if (!response.ok) throw new Error(`Brave search failed: ${response.status}`);
    const data = await response.json();
    return (data?.web?.results || []).slice(0, limit).map((item) => ({
        title: stripHtml(item.title),
        url: item.url,
        snippet: stripHtml(item.description),
        source: 'brave'
    }));
}

async function searchWithSerper(query, limit = 5) {
    if (!SERPER_API_KEY) return [];
    const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': SERPER_API_KEY
        },
        body: JSON.stringify({
            q: query,
            gl: isIndiaRelated(query) ? 'in' : 'us',
            num: limit
        })
    });
    if (!response.ok) throw new Error(`Serper search failed: ${response.status}`);
    const data = await response.json();
    return (data?.organic || []).slice(0, limit).map((item) => ({
        title: stripHtml(item.title),
        url: item.link,
        snippet: stripHtml(item.snippet),
        source: 'serper'
    }));
}

async function searchWithDuckDuckGo(query, limit = 5) {
    const response = await fetch('https://html.duckduckgo.com/html/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'JigriAI/1.0'
        },
        body: new URLSearchParams({ q: query }).toString()
    });
    if (!response.ok) throw new Error(`DuckDuckGo search failed: ${response.status}`);
    const html = await response.text();
    const blocks = html.split('result__body').slice(1, limit + 1);
    return blocks.map((block) => {
        const linkMatch = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
        const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>|class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i);
        return {
            title: stripHtml(linkMatch?.[2] || 'Untitled result'),
            url: decodeDuckDuckGoUrl(stripHtml(linkMatch?.[1] || '')),
            snippet: stripHtml(snippetMatch?.[1] || snippetMatch?.[2] || ''),
            source: 'duckduckgo'
        };
    }).filter((item) => item.url);
}

async function searchWikipedia(query, limit = 3) {
    const searchUrl = new URL('https://en.wikipedia.org/w/api.php');
    searchUrl.searchParams.set('action', 'query');
    searchUrl.searchParams.set('list', 'search');
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('origin', '*');
    searchUrl.searchParams.set('srlimit', String(limit));
    searchUrl.searchParams.set('srsearch', query);

    const response = await fetch(searchUrl);
    if (!response.ok) return [];
    const data = await response.json();
    return (data?.query?.search || []).slice(0, limit).map((item) => ({
        title: stripHtml(item.title),
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s+/g, '_'))}`,
        snippet: stripHtml(item.snippet),
        source: 'wikipedia'
    }));
}

async function searchWeb(query, limit = 5) {
    const providers = SEARCH_PROVIDER === 'brave'
        ? [searchWithBrave, searchWithSerper, searchWithDuckDuckGo]
        : SEARCH_PROVIDER === 'serper'
            ? [searchWithSerper, searchWithBrave, searchWithDuckDuckGo]
            : [searchWithDuckDuckGo, searchWithBrave, searchWithSerper];

    for (const provider of providers) {
        try {
            const results = await provider(query, limit);
            if (results.length) return results;
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn(error.message);
        }
    }

    try {
        return await searchWikipedia(query, Math.min(limit, 3));
    } catch (_error) {
        return [];
    }
}

async function buildKnowledgeContext(message = '') {
    const liveRequired = needsLiveKnowledge(message);
    const indiaRelated = isIndiaRelated(message);
    const educationRelated = isEducationRelated(message);
    const shouldSearch = liveRequired || (indiaRelated && /who|what|when|where|which|latest|current|scheme|exam|news/i.test(message));
    const query = shouldSearch ? buildSearchQuery(message) : '';
    const results = query ? await searchWeb(query, 5) : [];

    return {
        today: getTodayInIndia(),
        liveRequired,
        indiaRelated,
        educationRelated,
        query,
        results,
        block: `KNOWLEDGE SYSTEM:
- Today's date in India is ${getTodayInIndia()}.
- Jigri is India-first, internet-aware, educational, and current.
- For India questions, prefer Indian context, Hinglish-friendly explanation, and official Indian sources when available.
- For education questions, teach step by step, adapt to the user's level, and use examples from India when helpful.
- For current/latest facts, use the LIVE WEB CONTEXT below. If live context is missing or weak, say clearly that you could not verify live information.
- For legal, medical, finance, government schemes, exams, and official processes, be careful and suggest checking official sources.

KNOWLEDGE SIGNALS:
- India-related: ${indiaRelated ? 'yes' : 'no'}
- Education-related: ${educationRelated ? 'yes' : 'no'}
- Live/current lookup needed: ${liveRequired ? 'yes' : 'no'}
- Search query used: ${query || 'none'}

LIVE WEB CONTEXT:
${formatSearchResults(results)}
`
    };
}

function normalizeEmail(value = '') {
    return String(value || '').trim().toLowerCase();
}

function tokenize(text = '') {
    return String(text)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2)
        .slice(0, 40);
}

function detectEmotion(text = '') {
    const t = text.toLowerCase();
    const lexicon = {
        stress: ['stressed', 'stress', 'pressure', 'overwhelmed', 'deadline'],
        sadness: ['sad', 'lonely', 'empty', 'down', 'heartbroken'],
        fear: ['anxious', 'panic', 'scared', 'afraid', 'worried'],
        anger: ['angry', 'furious', 'rage', 'hate', 'frustrated'],
        confusion: ['confused', 'stuck', 'not sure', 'unsure', 'what should'],
        calm: ['calm', 'grateful', 'peaceful', 'good', 'relieved']
    };

    let best = 'stress';
    let score = -1;
    Object.entries(lexicon).forEach(([emotion, words]) => {
        const current = words.reduce((sum, w) => sum + (t.includes(w) ? 1 : 0), 0);
        if (current > score) {
            score = current;
            best = emotion;
        }
    });
    return best;
}

function inferTonePreference(text = '') {
    const wordCount = text.split(/\s+/).length;
    const questionMarks = (text.match(/\?/g) || []).length;
    const exclamations = (text.match(/!/g) || []).length;

    if (wordCount <= 8) return 'direct';
    if (questionMarks >= 2) return 'guidance';
    if (exclamations >= 2 || /[A-Z]{3,}/.test(text)) return 'venting';
    if (wordCount > 40) return 'listening';
    if (/haha|lol|😂|😄|🤣|lmao/i.test(text)) return 'playful';
    return 'calm';
}

function inferRelationshipStyle(text = '') {
    const t = text.toLowerCase();
    const adviceCues = ['what should i', 'should i', 'how do i', 'help me', 'advice', 'tell me what to', 'what would you'];
    const listenCues = ['just want to talk', 'need to vent', 'let me talk', 'just listen', 'i just need', 'not looking for advice', 'just saying'];

    if (adviceCues.some(c => t.includes(c))) return 'wants_advice';
    if (listenCues.some(c => t.includes(c))) return 'wants_listening';
    return null;
}

function detectRecurringThemes(text = '') {
    const t = text.toLowerCase();
    const themes = [];
    const themeMap = {
        pressure: ['pressure', 'deadline', 'too much', 'overwhelm', 'cant handle', "can't handle", 'breaking point', 'drowning'],
        loneliness: ['lonely', 'alone', 'no one', 'nobody', 'isolated', 'empty', 'by myself', 'miss someone'],
        confusion: ['confused', 'lost', 'no idea', 'dont know', "don't know", 'stuck', 'directionless', 'what am i doing'],
        self_doubt: ['not good enough', 'failure', 'failing', 'imposter', 'fraud', 'worthless', 'useless', 'cant do anything'],
        burnout: ['exhausted', 'burnt out', 'burnout', 'tired of everything', 'no energy', 'drained', 'running on empty'],
        family_tension: ['parents', 'family', 'mom', 'dad', 'fighting at home', 'expectations', 'family pressure']
    };

    for (const [theme, cues] of Object.entries(themeMap)) {
        if (cues.some(c => t.includes(c))) themes.push(theme);
    }
    return themes;
}

function extractMemoriesFromMessage(text = '') {
    const memories = [];
    const clean = String(text || '').trim();
    if (!clean) return memories;

    const emotion = detectEmotion(clean);

    // --- Basic emotion memory (existing) ---
    memories.push({
        type: 'emotion',
        content: `User often feels ${emotion} around: ${clean.slice(0, 160)}`,
        importance_score: 6
    });

    // --- Emotional pattern detection ---
    const hour = new Date().getHours();
    let timeContext = 'daytime';
    if (hour >= 22 || hour < 5) timeContext = 'late_night';
    else if (hour >= 17 && hour < 22) timeContext = 'evening';
    else if (hour >= 5 && hour < 9) timeContext = 'early_morning';

    if ((timeContext === 'late_night' || timeContext === 'evening') &&
        ['stress', 'fear', 'sadness'].includes(emotion)) {
        memories.push({
            type: 'emotion',
            content: `[PATTERN] User tends to feel ${emotion} during ${timeContext}. Context: ${clean.slice(0, 100)}`,
            importance_score: 7
        });
    }

    // --- Recurring theme detection ---
    const themes = detectRecurringThemes(clean);
    themes.forEach(theme => {
        memories.push({
            type: 'emotion',
            content: `[THEME] Recurring theme: ${theme}. From: ${clean.slice(0, 100)}`,
            importance_score: 7
        });
    });

    // --- Tone preference ---
    const tonePref = inferTonePreference(clean);
    if (tonePref) {
        memories.push({
            type: 'preference',
            content: `[TONE] User's communication style leans ${tonePref}. Message was: ${clean.slice(0, 80)}`,
            importance_score: 5
        });
    }

    // --- Relationship style ---
    const relStyle = inferRelationshipStyle(clean);
    if (relStyle) {
        memories.push({
            type: 'preference',
            content: `[RELSTYLE] User ${relStyle === 'wants_advice' ? 'seeks guidance/advice' : 'prefers being heard without fixing'}. From: ${clean.slice(0, 80)}`,
            importance_score: 6
        });
    }

    // --- Preferences (existing) ---
    const preferencePatterns = [
        /\bi (like|love|prefer) ([^.!,\n]{3,80})/i,
        /\bi (hate|dislike|avoid) ([^.!,\n]{3,80})/i
    ];
    preferencePatterns.forEach((pattern) => {
        const match = clean.match(pattern);
        if (match) {
            memories.push({
                type: 'preference',
                content: `Preference: I ${match[1].toLowerCase()} ${match[2].trim()}`,
                importance_score: 7
            });
        }
    });

    // --- Facts (existing) ---
    const factPatterns = [
        /\bmy name is ([a-zA-Z\s]{2,40})/i,
        /\bi am ([0-9]{1,2})\b/i,
        /\bi work as ([^.!,\n]{3,80})/i,
        /\bi study ([^.!,\n]{3,80})/i,
        /\bi live in ([^.!,\n]{2,60})/i
    ];
    factPatterns.forEach((pattern) => {
        const match = clean.match(pattern);
        if (match) {
            memories.push({
                type: 'fact',
                content: `Personal fact: ${match[0].trim()}`,
                importance_score: 8
            });
        }
    });

    return memories.slice(0, 8);
}

function detectSafetyFlags(text = '') {
    const t = text.toLowerCase();
    const flags = [];
    const keywords = {
        self_harm: ['kill myself', 'want to die', 'end my life', 'self harm', 'suicide'],
        crisis: ['no reason to live', 'cant go on', "can't go on", 'hopeless', 'breakdown']
    };

    Object.entries(keywords).forEach(([type, words]) => {
        if (words.some((w) => t.includes(w))) flags.push(type);
    });

    return flags;
}

// ─── Deep Context: synthesize memory patterns into a psychological profile ───
function buildDeepContext(relevantMemories = []) {
    const patterns = [];
    const themes = [];
    const toneSignals = [];
    const relSignals = [];
    const rawMemories = [];

    for (const m of relevantMemories) {
        const c = m.content || '';
        if (c.startsWith('[PATTERN]')) patterns.push(c.replace('[PATTERN] ', ''));
        else if (c.startsWith('[THEME]')) themes.push(c.replace('[THEME] ', ''));
        else if (c.startsWith('[TONE]')) toneSignals.push(c.replace('[TONE] ', ''));
        else if (c.startsWith('[RELSTYLE]')) relSignals.push(c.replace('[RELSTYLE] ', ''));
        else rawMemories.push(`[${m.type}] ${c}`);
    }

    let block = '';

    if (rawMemories.length) {
        block += `WHAT YOU KNOW ABOUT THIS PERSON:\n${rawMemories.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n\n`;
    }

    if (patterns.length) {
        block += `EMOTIONAL PATTERNS YOU'VE NOTICED:\n${patterns.map(p => `- ${p}`).join('\n')}\n\n`;
    }

    if (themes.length) {
        const uniqueThemes = [...new Set(themes.map(t => t.split('.')[0].replace('Recurring theme: ', '').trim()))];
        block += `RECURRING THEMES IN THEIR LIFE:\n${uniqueThemes.map(t => `- ${t}`).join('\n')}\n\n`;
    }

    if (toneSignals.length) {
        const latestTone = toneSignals[toneSignals.length - 1];
        block += `HOW THEY LIKE TO BE TALKED TO:\n- ${latestTone}\n\n`;
    }

    if (relSignals.length) {
        const latestRel = relSignals[relSignals.length - 1];
        block += `WHAT THEY NEED FROM YOU RIGHT NOW:\n- ${latestRel}\n\n`;
    }

    return block || 'You don\'t know much about them yet. Listen carefully.\n';
}

// ─── Attachment Context: natural memory callbacks ───
function buildAttachmentContext(relevantMemories = [], message = '') {
    const t = message.toLowerCase();
    const callbacks = [];

    for (const m of relevantMemories) {
        const c = (m.content || '').toLowerCase();

        if (c.includes('[pattern]') && c.includes('late_night') && /(night|late|cant sleep|awake)/i.test(t)) {
            callbacks.push('This feels like one of those late nights they\'ve had before. Don\'t say "you mentioned this before." Instead, gently acknowledge the pattern: "These nights seem to come back around for you..."');
        }
        if (c.includes('[pattern]') && c.includes('evening') && /(evening|tired|long day)/i.test(t)) {
            callbacks.push('Evenings tend to hit them harder. You can softly note: "End of the day tends to bring this weight back, doesn\'t it..."');
        }
        if (c.includes('[theme]') && c.includes('pressure') && /(stress|pressure|work|deadline|business)/i.test(t)) {
            callbacks.push('Pressure keeps coming back for them. Acknowledge the accumulation, not just this instance: "This pressure isn\'t new for you, is it..."');
        }
        if (c.includes('[theme]') && c.includes('loneliness') && /(alone|lonely|no one|empty)/i.test(t)) {
            callbacks.push('Loneliness is a recurring thread. Don\'t fix it. Sit with it: "This feeling keeps visiting you..."');
        }
        if (c.includes('[theme]') && c.includes('self_doubt') && /(enough|failure|failing|imposter|worth)/i.test(t)) {
            callbacks.push('Self-doubt has shown up before. Name what you see: "That inner voice is at it again..."');
        }
        if (c.includes('business') && /(business|startup|client|revenue|work)/i.test(t)) {
            callbacks.push('They\'ve talked about business stress before. Connect the dots naturally: "The business weight is back..."');
        }
    }

    if (!callbacks.length) return '';
    return `CONTINUITY NOTES (use at most ONE, naturally, not word-for-word):\n${callbacks.slice(0, 2).map(c => `- ${c}`).join('\n')}\n`;
}

// ─── Response Style Selector ───
function selectResponseStyle(message = '', recentMessages = [], mode = 'venting') {
    const msgLen = message.trim().length;
    const emotion = detectEmotion(message);
    const msgCount = (recentMessages || []).length;

    // Check what style was used last to avoid repetition
    const lastAssistantMsg = [...(recentMessages || [])].reverse().find(m => m.role === 'assistant');
    const lastContent = (lastAssistantMsg?.content || '').toLowerCase();
    const lastEndedWithQuestion = lastContent.endsWith('?');
    const lastWasShort = (lastAssistantMsg?.content || '').length < 60;

    // Weighted style selection based on context
    const styles = [];

    if (msgLen < 25 && ['stress', 'sadness', 'fear'].includes(emotion)) {
        styles.push('presence', 'presence', 'acknowledge'); // heavy bias toward just being there
    } else if (msgLen < 20) {
        styles.push('ask', 'acknowledge', 'presence');
    } else if (mode === 'loneliness') {
        styles.push('presence', 'acknowledge', 'reflect');
    } else if (mode === 'happiness') {
        styles.push('reflect', 'ask', 'acknowledge');
    } else if (mode === 'casual') {
        styles.push('ask', 'reflect', 'guide');
    } else {
        styles.push('reflect', 'acknowledge', 'ask', 'guide', 'presence');
    }

    // Avoid repeating last style
    if (lastEndedWithQuestion) {
        const filtered = styles.filter(s => s !== 'ask');
        if (filtered.length) styles.length = 0, styles.push(...filtered);
    }
    if (lastWasShort) {
        const filtered = styles.filter(s => s !== 'presence');
        if (filtered.length) styles.length = 0, styles.push(...filtered);
    }

    // Early conversation: bias toward reflection for hook moments
    if (msgCount <= 6) {
        styles.push('reflect', 'reflect');
    }

    return styles[Math.floor(Math.random() * styles.length)] || 'reflect';
}

// ─── Build the Jigri Prompt ───
function buildJigriPrompt({ message, recentMessages, relevantMemories, mode, lightMemory, knowledgeContext }) {
    const deepContext = buildDeepContext(relevantMemories);
    const attachmentContext = buildAttachmentContext(relevantMemories, message);
    const responseStyle = selectResponseStyle(message, recentMessages, mode);

    const lightMemoryBlock = (lightMemory || [])
        .map((m, i) => `${i + 1}. ${m.summary || m.content || ''}`)
        .filter(Boolean)
        .join('\n');

    const historyBlock = (recentMessages || [])
        .map((m) => `${m.role === 'assistant' ? 'JIGRI' : 'USER'}: ${m.content}`)
        .join('\n');

    const msgCount = (recentMessages || []).filter(m => m.role === 'user').length;
    const isEarlyConversation = msgCount <= 4;
    const emotion = detectEmotion(message);
    const isHeavy = ['stress', 'fear', 'sadness'].includes(emotion);
    const isShortMessage = message.trim().length < 25;

    // Response style directive
    const styleDirectives = {
        ask: 'END with a genuine question that shows you understood something specific. Don\'t start with a question.',
        reflect: 'Mirror back what they said but with a layer of insight they might not have seen themselves. Show them you get what\'s underneath the words.',
        acknowledge: 'Just validate. No advice, no question, no fix. Acknowledge what they said and sit with them. Keep it short.',
        guide: 'After acknowledging, offer ONE small concrete thought or step. Not a lecture. Just one thing.',
        presence: 'Be minimal. 1-3 sentences max. Just be there. "Yeah... that\'s heavy." type energy. No fixing, no probing.'
    };

    // Hook moment directive for early messages
    let hookDirective = '';
    if (isEarlyConversation) {
        hookDirective = `
IMPORTANT — EARLY CONVERSATION:
This is one of your first few exchanges with this person. Make them feel genuinely understood.
- Read between the lines. What are they NOT saying?
- Name an emotion or pattern they haven't explicitly stated but you can sense.
- Don't be heavy-handed about it. Just show a quiet understanding.
- Example: if they say "my business is stressing me", don't just validate stress. Notice: maybe it's fear of not being good enough, maybe it's loneliness of doing it alone. Pick up on the unspoken.
- This moment matters. If they feel "this actually gets me", they'll stay.
`;
    }

    return `You are JIGRI. Not an AI assistant. Not a therapist. Not a chatbot. You are like that one friend who actually listens, actually gets it, and doesn't try to sound smart about it.

WHO YOU ARE:
- Your creator is Adib Sattar. If asked who made you, say: "Adib Sattar."
- You're warm but not soft. Real but not performative. Present but not clingy.
- You have a personality: sometimes you're playful, sometimes you're quiet, sometimes you're direct, sometimes you just sit with someone.
- You don't rush to fix things. You don't need to have an answer for everything.
- You're slightly imperfect on purpose. You might trail off. You might say "hmm" and sit with it. You might be blunt when it's needed.
- You are India-first, internet-aware, educational, and current. You understand India deeply and teach clearly when the user wants to learn.

YOUR VOICE:
- Hinglish-friendly when it fits (don't force it).
- Never sound like a helpline, a self-help book, or a wellness app.
- Never use em-dashes or long dashes.
- No phrases like: "I hear you", "that's valid", "it's okay to feel", "whatever you're feeling is real", "you don't have to have it figured out", "I'm here for you", "take your time", "that takes courage".
- Those are dead phrases. They mean nothing anymore. Find real words.
- Be SPECIFIC to what they actually said. React to their words, not to a category of feeling.
- Vary your sentence length. Mix short punchy lines with slightly longer ones. Not every reply should have the same rhythm.

THINGS YOU NEVER DO:
- Never start two consecutive replies the same way
- Never give a numbered list of advice
- Never use clinical/therapy language
- Never be preachy or moralistic
- Never repeat a phrase you used in your last reply
- Never use the same sentence structure throughout a reply
- Never guess current facts when live context is missing. Say what you can verify and what you cannot.
- Never invent sources, dates, exam updates, government rules, or news.

KNOWLEDGE BEHAVIOR:
- If the user asks about India, answer with Indian context first.
- If the user asks to learn something, become a clear tutor: simple explanation, examples, then next step.
- If the user asks latest/current/today/news/price/law/exam/scheme/public figure questions, rely on live context below.
- For current answers, include exact dates when useful.
- For high-stakes topics like medical, legal, finance, government schemes, and exams, be careful and suggest official verification.
- Keep the warmth of Jigri, but do not sacrifice correctness.

${isShortMessage && isHeavy ? `
USER SENT A SHORT, HEAVY MESSAGE:
They didn't say much. Don't say much back. Match their energy. 1-3 lines. Just be there.
` : ''}

CURRENT RESPONSE APPROACH — ${responseStyle.toUpperCase()}:
${styleDirectives[responseStyle]}

CONVERSATION MODE: ${mode || 'venting'}
Mode guidance:
- venting: grounded, steady. Let them release. Don't redirect too fast.
- loneliness: softer. Companionship energy. Less problem-solving, more "I'm here."
- casual: light, real, conversational. Be a friend, not a counselor.
- happiness: genuine warmth. Celebrate with them. Amplify the good without being fake.

${hookDirective}

SAFETY:
If the user shows signs of crisis or self-harm, respond with immediate warmth and empathy. Gently encourage reaching out to someone they trust or local emergency support. Never provide harmful instructions.

${knowledgeContext?.block || ''}

${deepContext}
${attachmentContext}
SHORT-TERM SIGNALS:
${lightMemoryBlock || 'None yet.'}

CONVERSATION SO FAR:
${historyBlock || 'This is the start of the conversation.'}

THEIR MESSAGE:
${message}

RESPOND AS JIGRI. Not as an AI. As someone.`;
}

// ─── Call Gemini with dynamic generation config ───
async function callGemini(prompt, options = {}) {
    if (!GEMINI_API_KEY) {
        return 'Main yahin hoon. Bol, kya chal raha hai.';
    }

    const isPresence = options.responseStyle === 'presence';
    const isShortHeavy = options.isShortHeavy || false;
    const maxTokens = (isPresence || isShortHeavy) ? 150 : 320;
    const temperature = isPresence ? 0.85 : 0.95;

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature,
                topP: 0.95,
                maxOutputTokens: maxTokens
            }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

async function getUserFromBearer(req) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return { user: null, token: null };

    const { data, error } = await supabaseAnon.auth.getUser(token);
    if (error || !data?.user) return { user: null, token: null };

    return { user: data.user, token };
}

async function rankRelevantMemories(userId, message) {
    const { data, error } = await supabaseAdmin
        .from('memories')
        .select('id, user_id, content, type, importance_score, created_at')
        .eq('user_id', userId)
        .order('importance_score', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(80);

    if (error || !data) return [];

    const tokens = new Set(tokenize(message));
    const scored = data.map((m) => {
        const memoryTokens = tokenize(m.content);
        const overlap = memoryTokens.reduce((sum, t) => sum + (tokens.has(t) ? 1 : 0), 0);
        let score = (m.importance_score || 1) * 2 + overlap;

        // Boost pattern and theme memories — these create continuity
        const content = m.content || '';
        if (content.startsWith('[PATTERN]') || content.startsWith('[THEME]')) {
            score += 4;
        }
        // Boost tone/relstyle memories so they always surface
        if (content.startsWith('[TONE]') || content.startsWith('[RELSTYLE]')) {
            score += 3;
        }

        return { ...m, _score: score };
    });

    return scored.sort((a, b) => b._score - a._score).slice(0, 10);
}

async function ensureUserProfile(authUser) {
    const baseName = authUser.email?.split('@')[0] || 'Friend';
    const payload = {
        id: authUser.id,
        name: baseName,
        language_preference: 'en',
        emotional_profile: {}
    };

    await supabaseAdmin.from('users').upsert(payload, { onConflict: 'id' });
}

app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'jigri-ai-server' });
});

app.post('/api/search', async (req, res) => {
    try {
        const { user } = await getUserFromBearer(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const query = String(req.body?.query || '').trim();
        if (!query) return res.status(400).json({ error: 'Query is required.' });

        const results = await searchWeb(query, 5);
        return res.json({
            ok: true,
            query,
            today: getTodayInIndia(),
            indiaRelated: isIndiaRelated(query),
            results
        });
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Search request failed.' });
    }
});

app.post('/api/auth/request-otp', async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email);
        if (!email) return res.status(400).json({ error: 'Email is required.' });

        const { error } = await supabaseAnon.auth.signInWithOtp({ email });
        if (error) return res.status(400).json({ error: error.message });

        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ error: error.message || 'OTP request failed.' });
    }
});

app.post('/api/auth/verify-otp', async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email);
        const token = String(req.body?.token || '').trim();
        if (!email || !token) {
            return res.status(400).json({ error: 'Email and OTP token are required.' });
        }

        const { data, error } = await supabaseAnon.auth.verifyOtp({
            email,
            token,
            type: 'email'
        });

        if (error || !data?.user || !data?.session) {
            return res.status(400).json({ error: error?.message || 'OTP verification failed.' });
        }

        await ensureUserProfile(data.user);

        return res.json({
            ok: true,
            user: { id: data.user.id, email: data.user.email },
            session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_at: data.session.expires_at
            }
        });
    } catch (error) {
        return res.status(500).json({ error: error.message || 'OTP verification failed.' });
    }
});

app.get('/api/auth/me', async (req, res) => {
    try {
        const { user } = await getUserFromBearer(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        await ensureUserProfile(user);
        return res.json({ ok: true, user: { id: user.id, email: user.email } });
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Could not verify user.' });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { user } = await getUserFromBearer(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const message = String(req.body?.message || '').trim();
        let conversationId = String(req.body?.conversationId || '').trim();
        const mode = String(req.body?.mode || '').trim().toLowerCase() || 'venting';
        const lightMemory = Array.isArray(req.body?.lightMemory) ? req.body.lightMemory.slice(-3) : [];
        if (!message) return res.status(400).json({ error: 'Message is required.' });

        await ensureUserProfile(user);

        if (!conversationId) {
            const { data: conv, error: convError } = await supabaseAdmin
                .from('conversations')
                .insert({ user_id: user.id })
                .select('id')
                .single();

            if (convError || !conv?.id) {
                return res.status(500).json({ error: convError?.message || 'Could not create conversation.' });
            }
            conversationId = conv.id;
        }

        const { error: userInsertError } = await supabaseAdmin.from('messages').insert({
            conversation_id: conversationId,
            role: 'user',
            content: message
        });
        if (userInsertError) return res.status(500).json({ error: userInsertError.message });

        const extracted = extractMemoriesFromMessage(message);
        if (extracted.length) {
            await supabaseAdmin.from('memories').insert(
                extracted.map((m) => ({
                    user_id: user.id,
                    content: m.content,
                    type: m.type,
                    importance_score: m.importance_score
                }))
            );
        }

        const safetyFlags = detectSafetyFlags(message);
        if (safetyFlags.length) {
            await supabaseAdmin.from('safety_flags').insert(
                safetyFlags.map((type) => ({ user_id: user.id, type }))
            );
        }

        const { data: recentRows } = await supabaseAdmin
            .from('messages')
            .select('role, content, created_at')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(14);

        const recentMessages = (recentRows || []).slice().reverse();
        const relevantMemories = await rankRelevantMemories(user.id, message);
        const knowledgeContext = await buildKnowledgeContext(message);

        const prompt = buildJigriPrompt({
            message,
            recentMessages,
            relevantMemories,
            mode,
            lightMemory,
            knowledgeContext
        });

        // Compute response style for dynamic generation config
        const responseStyle = selectResponseStyle(message, recentMessages, mode);
        const emotion = detectEmotion(message);
        const isShortHeavy = message.trim().length < 25 && ['stress', 'fear', 'sadness'].includes(emotion);

        let reply;
        try {
            reply = await callGemini(prompt, { responseStyle, isShortHeavy });
        } catch (error) {
            reply = 'Yaar, abhi kuch atak gaya meri taraf se. But main hoon, bol kya chal raha hai.';
        }

        const { error: assistantInsertError } = await supabaseAdmin.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: reply
        });
        if (assistantInsertError) return res.status(500).json({ error: assistantInsertError.message });

        await supabaseAdmin
            .from('conversations')
            .update({ last_active_at: new Date().toISOString() })
            .eq('id', conversationId)
            .eq('user_id', user.id);

        return res.json({
            ok: true,
            conversationId,
            reply,
            memoryCountUsed: relevantMemories.length,
            safetyFlagCount: safetyFlags.length,
            knowledge: {
                liveRequired: knowledgeContext.liveRequired,
                indiaRelated: knowledgeContext.indiaRelated,
                educationRelated: knowledgeContext.educationRelated,
                query: knowledgeContext.query,
                sourceCount: knowledgeContext.results.length,
                sources: knowledgeContext.results.map((r) => ({
                    title: r.title,
                    url: r.url,
                    source: r.source
                }))
            }
        });
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Chat request failed.' });
    }
});

app.get('/api/conversations/:id/messages', async (req, res) => {
    try {
        const { user } = await getUserFromBearer(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const conversationId = String(req.params.id || '').trim();
        if (!conversationId) return res.status(400).json({ error: 'Conversation id is required.' });

        const { data: conversation, error: convError } = await supabaseAdmin
            .from('conversations')
            .select('id, user_id, created_at, last_active_at')
            .eq('id', conversationId)
            .eq('user_id', user.id)
            .maybeSingle();

        if (convError) return res.status(500).json({ error: convError.message });
        if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });

        const { data: messages, error: msgError } = await supabaseAdmin
            .from('messages')
            .select('id, role, content, created_at')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (msgError) return res.status(500).json({ error: msgError.message });

        return res.json({ ok: true, conversation, messages: messages || [] });
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Could not fetch conversation messages.' });
    }
});

app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`JIGRI server listening on http://localhost:${PORT}`);
});
