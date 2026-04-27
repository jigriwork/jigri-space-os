# Future Jigri

Jigri is an AI companion OS: a warm personal space where users can talk, remember, create, reflect, and generate media. This file is the product and technical reference for future development sessions.

When continuing work from another computer or a fresh AI session, start by reading this file.

## Direction

Jigri should feel like a personal digital room, not a generic chatbot or SaaS dashboard. The core product is a companion with memory, voice, creativity, and a private user space.

Jigri should be India-first, internet-aware, educational, and current. It should understand India deeply, help users learn, and search the internet when an answer depends on latest information.

Primary AI provider:

- Hugging Face first
- Gemini only as an optional fallback for specific tasks where quality is clearly better

Important principle:

- Do not expose AI API keys in frontend code.
- All AI calls should go through backend routes.
- Add usage limits before launching expensive generation features.
- Do not guess latest facts. Search or retrieve fresh information when the answer may have changed.

## Product Pillars

### 1. Companion Chat

The main Jigri experience.

Features:

- Warm AI conversation
- Emotional tone awareness
- Long conversations
- Multilingual support later
- Mood-aware replies
- Quick reply suggestions
- Daily check-ins
- Private journal-style conversations
- Optional model switching from backend settings later

AI approach:

- Hugging Face text generation models
- Test Qwen, Llama, Mistral, DeepSeek, Kimi-style, or other strong open models available through Hugging Face providers
- Keep Gemini disabled by default or reserved for special cases

### 2. Memory

Memory makes Jigri feel personal and alive.

Features:

- Remember user's name, preferences, goals, habits, important moments, and creative interests
- Separate important memories from raw chat history
- Let users view, edit, and delete saved memories
- Search memories semantically
- Use memories in chat responses only when relevant
- Support memory categories such as profile, relationship, mood, project, creative, reminders, and preferences

Technical approach:

- Supabase database
- Embeddings for semantic memory search
- Hugging Face embedding model or another low-cost embedding provider
- Future Supabase vector search if needed

### 3. Voice

Voice should make Jigri feel more personal.

Features:

- Push-to-talk
- Speech-to-text
- Text-to-speech replies
- Voice style options
- Live voice mode later
- Voice cloning only with clear consent and safety controls

AI approach:

- Speech-to-text: Whisper-style Hugging Face ASR model
- Text-to-speech: Hugging Face TTS first
- Premium voice providers can be considered later if quality is not enough

### 4. Creative Studio

Jigri should help users make things, not only talk.

Features:

- Text-to-image generation
- Image editing
- Inpainting or prompt-based edits
- Avatar creation
- Mood wallpapers
- Dream scenes
- Companion visual moments
- Stickers/icons
- Story images
- Captions, letters, poems, and social content

AI approach:

- Hugging Face image generation and image editing models
- Test Stable Diffusion, SDXL, FLUX-style models, and current trending HF models
- Store outputs in Supabase Storage or another controlled storage layer

### 5. Video Generation

Video is powerful but expensive. Treat it as limited or premium from the beginning.

Features:

- Image-to-video
- Image plus prompt-to-video
- Text-to-video
- Short animated memory scenes
- Avatar motion experiments
- Save generated videos to gallery

AI approach:

- Hugging Face image-to-video and text-to-video tasks
- Test models such as LTX, Wan, HunyuanVideo, SkyReels, or current strong models available through HF
- Use a job queue or queued UX for long-running generation

Rules:

- Add daily limits before public use
- Queue requests
- Show progress or pending state
- Prevent repeated spam generation

### 6. Personal Space

The app should feel like a private OS-like space.

Features:

- Home dashboard
- Mood tracker
- Daily note
- Saved memories
- Chat history
- Generated gallery
- User profile
- Theme/customization
- Companion avatar
- Settings and privacy controls

### 7. Auth And Accounts

Use Supabase for accounts and private data.

Features:

- Login/signup
- User profile
- Protected user data
- Saved chats
- Saved memories
- Saved media
- Usage tracking

Technical approach:

- Supabase Auth
- Supabase database
- Supabase Storage for images/videos if practical
- Service role key only on backend

### 8. Usage And Cost Control

This is required before scaling.

Features:

- Daily chat limits
- Daily image limits
- Very limited video limits
- Per-user usage table
- Cooldowns for expensive tasks
- Abuse prevention
- Optional paid credits/subscription later
- Admin settings for feature limits

Reason:

- Hugging Face Pro is useful for development and early beta, but it should not be treated as unlimited production infrastructure.
- Image and video generation can consume quota/credits quickly.

### 9. Admin Panel

Build later, but plan for it now.

Features:

- View users
- View AI usage
- View failed AI calls
- Toggle providers/models
- Set per-feature limits
- Manage reported content
- Estimate costs

### 10. Knowledge System

Jigri should become a smart India-first knowledge companion, not only a model that replies from memory.

Knowledge identity:

- India-first
- Internet-aware
- Educational
- Current
- Helpful in English, Hindi, Hinglish, and later regional Indian languages
- Clear about uncertainty
- Careful with legal, medical, finance, and government advice

Jigri should have three knowledge brains:

1. Conversation brain
2. Live knowledge brain
3. India knowledge brain

Conversation brain:

- Handles warmth, personality, reasoning, writing, planning, coding, tutoring, and creative help
- Uses Hugging Face/open models first
- Uses memory only when relevant

Live knowledge brain:

- Searches the internet or trusted data sources when facts may be current
- Used for news, politics, public figures, government schemes, exams, laws, prices, markets, sports, weather, technology updates, and latest events
- Gives sources for important current answers
- Should prefer official or reputable sources
- Should mention dates when answering time-sensitive questions
- Should avoid pretending to know latest facts without retrieval

India knowledge brain:

- Understands Indian government structure
- Understands central and state government basics
- Knows India geography, states, union territories, capitals, districts, rivers, agriculture, climate, and major regions
- Knows Indian history, freedom movement, Constitution basics, Parliament, judiciary, elections, and civic structure
- Helps explain Indian schemes, documents, services, and processes such as Aadhaar, PAN, UPI, GST basics, DigiLocker, passports, voter ID, and common public services
- Supports Indian education needs including CBSE, ICSE, state boards, NCERT-style learning, JEE, NEET, UPSC, SSC, banking, railways, and college learning
- Supports Indian startup, business, tax, compliance, finance, and career basics with clear disclaimers when needed
- Understands Indian culture, festivals, languages, food, regions, and everyday context

Education mode:

- Explain topics simply
- Create notes, summaries, flashcards, quizzes, and practice questions
- Support school, college, coding, English, Hindi, exam prep, and career guidance
- Adapt explanations to the user's level
- Give step-by-step learning plans
- Encourage understanding instead of only giving final answers

Freshness rules:

- Search first for "today", "latest", "current", "now", "this week", "this month", and similar questions
- Search first for public figures, elections, government schemes, exam dates, laws, prices, sports, companies, product specs, and news
- Use exact dates in answers when the user asks about recent events
- For high-stakes topics, provide cautious guidance and encourage checking official sources or qualified professionals

Trusted source direction:

- Government: official `.gov.in`, department sites, PIB, RBI, SEBI, Election Commission, Supreme Court/High Court sites where relevant
- Education: official exam bodies, NCERT, NTA, UPSC, SSC, universities, boards
- News/current events: reputable sources and multiple-source confirmation for sensitive topics
- Health/legal/finance: official or expert sources, with disclaimers

Technical approach:

- Add a `SearchEngine` for live internet retrieval
- Add a `KnowledgeRouter` to decide when to use model knowledge, memory, web search, or curated knowledge
- Add source citation support for current answers
- Add a curated India knowledge base over time
- Keep personal memory separate from world knowledge
- Cache common current facts carefully with timestamps
- Make current-knowledge features server-side only

## Technical Architecture

Backend routes should own AI access:

- `/api/chat`
- `/api/memory`
- `/api/generate/image`
- `/api/generate/video`
- `/api/voice/stt`
- `/api/voice/tts`
- `/api/usage`
- `/api/gallery`
- `/api/search`
- `/api/knowledge`
- `/api/tutor`

Suggested internal engines:

- `ModelRouter`
- `TextEngine`
- `MemoryEngine`
- `EmbeddingEngine`
- `SearchEngine`
- `KnowledgeRouter`
- `IndiaKnowledgeEngine`
- `TutorEngine`
- `ImageEngine`
- `VideoEngine`
- `VoiceEngine`
- `UsageLimiter`
- `GalleryStorage`

Environment variables:

- `HUGGINGFACE_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY` optional fallback only

Possible packages to add later:

- Hugging Face client or direct backend `fetch`
- `multer` for uploads
- `sharp` for image processing
- `express-rate-limit` for basic protection
- `zod` for request validation
- search provider SDK or backend `fetch` for live web retrieval
- queue/job tooling when video generation begins

## MVP Roadmap

### Phase 1: Stabilize Current App

- Understand current Vite frontend
- Understand `server.cjs`
- Confirm current Supabase auth/data flow
- Confirm existing Gemini integration
- Keep the current app building cleanly

### Phase 2: Hugging Face Backend Wrapper

- Add backend-only Hugging Face service
- Add model router
- Add env handling
- Add safe error responses
- Do not expose HF token to frontend

### Phase 3: HF Chat

- Make Hugging Face the default chat provider
- Keep Gemini optional
- Add provider/model config in backend
- Log failed model calls safely

### Phase 4: Usage Limits

- Add per-user usage tracking
- Add daily limits for chat
- Add stricter limits for image/video
- Add server-side enforcement

### Phase 5: Memory

- Add memory extraction
- Add memory storage
- Add memory search
- Add memory review/edit/delete UI

### Phase 6: Knowledge System

- Add live search route
- Add knowledge router
- Add source citations
- Add India-first trusted source rules
- Add education/tutor mode
- Add current-answer freshness rules
- Keep memory separate from world knowledge

### Phase 7: Image Generation

- Add image generation route
- Add image generation UI
- Add style presets and aspect ratio controls
- Save generated images
- Add gallery

### Phase 8: Voice

- Add speech-to-text
- Add text-to-speech
- Add voice mode UI
- Keep live voice for later

### Phase 9: Video

- Add queued video generation
- Add image-to-video first
- Add text-to-video later
- Add strict limits
- Save videos to gallery

### Phase 10: Admin And Scale

- Add admin usage view
- Add model toggles
- Add cost controls
- Add paid user/credits system if needed

## Recommended First Serious Version

Build this before expanding:

- Login/signup
- Hugging Face chat
- Basic memory
- India-first live knowledge search
- Education/tutor mode
- Mood check-in
- Image generation
- Saved gallery
- Usage limits
- Settings page
- Optional Gemini fallback disabled by default

Then add:

- Voice
- Image editing
- Video generation
- Admin panel
- Paid credits/subscription

## Development Rule

Whenever work resumes, first read:

1. `FUTURE_JIGRI.md`
2. `package.json`
3. `server.cjs`
4. `src/main.js`
5. `src/AuthClient.js`
6. Supabase files under `supabase/`

Then make changes in small, testable steps.
