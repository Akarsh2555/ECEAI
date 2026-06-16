-- 0004_add_system_domain.sql
-- Additive: extend the designs.domain CHECK constraint to allow the new
-- Simulink-style 'system' (block-diagram) domain alongside the existing ones.
-- Rollback: drop this constraint and re-add the original three-value CHECK.

alter table public.designs
  drop constraint if exists designs_domain_check;

alter table public.designs
  add constraint designs_domain_check
  check (domain in ('digital', 'analog', 'signal', 'system'));
