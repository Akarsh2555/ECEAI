-- 0001_create_designs.sql
create table public.designs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null default 'Untitled design',
  domain       text not null check (domain in ('digital','analog','signal')),
  canvas_json  jsonb not null default '{}',
  artifacts    jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index designs_user_id_idx on public.designs(user_id);
create index designs_domain_idx  on public.designs(domain);

-- auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger designs_updated_at
  before update on public.designs
  for each row execute function public.handle_updated_at();
