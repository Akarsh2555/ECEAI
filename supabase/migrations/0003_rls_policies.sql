-- 0003_rls_policies.sql
alter table public.designs enable row level security;
alter table public.sessions enable row level security;

-- designs: users own their rows
create policy "users select own designs"
  on public.designs for select using (auth.uid() = user_id);
create policy "users insert own designs"
  on public.designs for insert with check (auth.uid() = user_id);
create policy "users update own designs"
  on public.designs for update using (auth.uid() = user_id);
create policy "users delete own designs"
  on public.designs for delete using (auth.uid() = user_id);

-- sessions: same
create policy "users select own sessions"
  on public.sessions for select using (auth.uid() = user_id);
create policy "users insert own sessions"
  on public.sessions for insert with check (auth.uid() = user_id);
create policy "users update own sessions"
  on public.sessions for update using (auth.uid() = user_id);
