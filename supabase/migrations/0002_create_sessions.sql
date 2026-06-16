-- 0002_create_sessions.sql
create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  design_id     uuid references public.designs(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  graph_state   jsonb not null default '{}',
  status        text not null default 'running'
                check (status in ('running','awaiting_approval','complete','error')),
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index sessions_design_id_idx on public.sessions(design_id);
create index sessions_user_id_idx   on public.sessions(user_id);

create trigger sessions_updated_at
  before update on public.sessions
  for each row execute function public.handle_updated_at();
