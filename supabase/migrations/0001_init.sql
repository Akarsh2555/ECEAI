-- ECE Copilot schema: designs + sessions, with row-level security so each user
-- can only read/write their own rows. Run in the Supabase SQL editor (or via the
-- Supabase CLI) before going live.

create extension if not exists "pgcrypto";

-- ── designs ──────────────────────────────────────────────────────────────────
create table if not exists public.designs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null default 'Untitled',
  domain       text not null default 'digital'
               check (domain in ('digital', 'analog', 'signal', 'system')),
  canvas_json  jsonb not null default '{}'::jsonb,
  artifacts    jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists designs_user_id_idx on public.designs (user_id);

alter table public.designs enable row level security;

drop policy if exists "designs are owner-only" on public.designs;
create policy "designs are owner-only" on public.designs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── sessions ─────────────────────────────────────────────────────────────────
create table if not exists public.sessions (
  id             uuid primary key default gen_random_uuid(),
  design_id      uuid references public.designs (id) on delete set null,
  user_id        uuid not null references auth.users (id) on delete cascade,
  graph_state    jsonb not null default '{}'::jsonb,
  status         text not null default 'running'
                 check (status in ('running', 'awaiting_approval', 'complete', 'error')),
  error_message  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists sessions_user_id_idx on public.sessions (user_id);

alter table public.sessions enable row level security;

drop policy if exists "sessions are owner-only" on public.sessions;
create policy "sessions are owner-only" on public.sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── keep updated_at fresh ────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists designs_set_updated_at on public.designs;
create trigger designs_set_updated_at before update on public.designs
  for each row execute function public.set_updated_at();

drop trigger if exists sessions_set_updated_at on public.sessions;
create trigger sessions_set_updated_at before update on public.sessions
  for each row execute function public.set_updated_at();
