create extension if not exists pgcrypto;

create table if not exists public.users (
    id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    name text,
    language_preference text,
    emotional_profile jsonb not null default '{}'::jsonb
);

create table if not exists public.conversations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    last_active_at timestamptz not null default now()
);

create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.memories (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    content text not null,
    type text not null check (type in ('emotion', 'fact', 'preference')),
    importance_score integer not null default 5 check (importance_score between 1 and 10),
    created_at timestamptz not null default now()
);

create table if not exists public.safety_flags (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    type text not null,
    created_at timestamptz not null default now()
);

create index if not exists conversations_user_id_last_active_idx
    on public.conversations (user_id, last_active_at desc);

create index if not exists messages_conversation_id_created_at_idx
    on public.messages (conversation_id, created_at asc);

create index if not exists memories_user_id_importance_created_at_idx
    on public.memories (user_id, importance_score desc, created_at desc);

create index if not exists safety_flags_user_id_created_at_idx
    on public.safety_flags (user_id, created_at desc);

alter table public.users enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.memories enable row level security;
alter table public.safety_flags enable row level security;

create policy "users can read own profile"
on public.users
for select
to authenticated
using (auth.uid() = id);

create policy "users can update own profile"
on public.users
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "users can read own conversations"
on public.conversations
for select
to authenticated
using (auth.uid() = user_id);

create policy "users can insert own conversations"
on public.conversations
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can update own conversations"
on public.conversations
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users can read own messages"
on public.messages
for select
to authenticated
using (
    exists (
        select 1
        from public.conversations c
        where c.id = conversation_id
          and c.user_id = auth.uid()
    )
);

create policy "users can insert own messages"
on public.messages
for insert
to authenticated
with check (
    exists (
        select 1
        from public.conversations c
        where c.id = conversation_id
          and c.user_id = auth.uid()
    )
);

create policy "users can read own memories"
on public.memories
for select
to authenticated
using (auth.uid() = user_id);

create policy "users can insert own memories"
on public.memories
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can read own safety flags"
on public.safety_flags
for select
to authenticated
using (auth.uid() = user_id);

create policy "users can insert own safety flags"
on public.safety_flags
for insert
to authenticated
with check (auth.uid() = user_id);