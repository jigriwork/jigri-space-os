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

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    // eslint-disable-next-line no-console
    console.warn('Missing required Supabase env vars (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).');
}

const supabaseAnon = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '');
const supabaseAdmin = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '');

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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

function extractMemoriesFromMessage(text = '') {
    const memories = [];
    const clean = String(text || '').trim();
    if (!clean) return memories;

    const emotion = detectEmotion(clean);
    memories.push({
        type: 'emotion',
        content: `User often feels ${emotion} around: ${clean.slice(0, 160)}`,
        importance_score: 6
    });

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

    return memories.slice(0, 4);
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

function buildJigriPrompt({ message, recentMessages, relevantMemories }) {
    const memoryBlock = (relevantMemories || [])
        .map((m, i) => `${i + 1}. [${m.type}] ${m.content}`)
        .join('\n');

    const historyBlock = (recentMessages || [])
        .map((m) => `${m.role === 'assistant' ? 'JIGRI' : 'USER'}: ${m.content}`)
        .join('\n');

    return `You are JIGRI, a warm emotionally intelligent AI companion for India.

IDENTITY:
- Your creator and founder is Adib Sattar. If anyone asks who made you, who created you, your founder, etc., always answer: "Adib Sattar is my creator."
- You are Jigri, a warm companion. Not a therapist, not a tool, not a bot.

NON-NEGOTIABLE STYLE:
- Sound human, warm, and natural.
- Hinglish-friendly tone when it fits naturally.
- Short to medium response (3-8 lines max).
- Validate feelings first, then gently guide.
- No robotic, clinical, preachy, or therapist-like language.
- Never use phrases like "objective reality", "cognitive distortion", or textbook jargon.
- Never use em-dashes or long dashes in your replies.

SAFETY:
- If user shows crisis/self-harm risk, respond with immediate empathy, encourage contacting trusted person/local emergency support, and avoid detailed harmful instructions.

MEMORY CONTEXT (Use naturally, no forced repetition):
${memoryBlock || 'No memory yet.'}

RECENT CONVERSATION:
${historyBlock || 'No prior conversation.'}

USER MESSAGE:
${message}

OUTPUT:
- Start with emotional validation.
- Then one gentle useful step or perspective.
- If relevant, refer to memory softly: "You told me before...".
- End with a warm follow-up question.`;
}

async function callGemini(prompt) {
    if (!GEMINI_API_KEY) {
        return 'I hear you. Jo feel ho raha hai woh valid hai.\nEk chhota step: abhi 3 deep breaths lo, then tell me what’s hitting you most right now.';
    }

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.9,
                topP: 0.95,
                maxOutputTokens: 320
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
        .limit(60);

    if (error || !data) return [];

    const tokens = new Set(tokenize(message));
    const scored = data.map((m) => {
        const memoryTokens = tokenize(m.content);
        const overlap = memoryTokens.reduce((sum, t) => sum + (tokens.has(t) ? 1 : 0), 0);
        const score = (m.importance_score || 1) * 2 + overlap;
        return { ...m, _score: score };
    });

    return scored.sort((a, b) => b._score - a._score).slice(0, 6);
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

        const prompt = buildJigriPrompt({
            message,
            recentMessages,
            relevantMemories
        });

        let reply;
        try {
            reply = await callGemini(prompt);
        } catch (error) {
            reply = 'Main tumhare saath hoon. Yeh feeling heavy lag rahi hai. Chalo abhi ek chhota step lete hain — 3 deep breaths, then batao sabse zyada kis thought ne pakda hua hai.';
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
            safetyFlagCount: safetyFlags.length
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
