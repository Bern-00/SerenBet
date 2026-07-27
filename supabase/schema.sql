-- SerenBet — schéma initial (Supabase / Postgres)
-- À exécuter dans le SQL Editor de ton projet Supabase (supabase.com > SQL Editor).
--
-- Usage personnel pour l'instant : chaque table est scopée par user_id
-- (auth.uid()) avec RLS activée dès la création, pour rester correct si
-- le produit devient multi-utilisateur plus tard (voir docs/PLAN.md).

-- ---------------------------------------------------------------------------
-- settings : configuration bankroll/Kelly, une ligne par utilisateur
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  starting_bankroll numeric not null default 1000 check (starting_bankroll > 0),
  kelly_multiplier numeric not null default 0.25 check (kelly_multiplier > 0 and kelly_multiplier <= 1),
  max_stake_fraction numeric not null default 0.05 check (max_stake_fraction > 0 and max_stake_fraction <= 1),
  stop_loss_fraction numeric not null default 0.5 check (stop_loss_fraction > 0 and stop_loss_fraction < 1),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- ---------------------------------------------------------------------------
-- bankroll_events : journal des mises placées (miroir de BankrollTracker.history)
-- ---------------------------------------------------------------------------
create table if not exists public.bankroll_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  description text not null,
  stake numeric not null check (stake > 0),
  odds numeric not null check (odds > 1),
  outcome text not null check (outcome in ('win', 'loss', 'pending')),
  profit numeric not null default 0,
  bankroll_after numeric,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- value_bets : détections du comparateur (find_value_bets), pour historique
-- et pour piloter le panneau admin
-- ---------------------------------------------------------------------------
create table if not exists public.value_bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  detected_at timestamptz not null default now(),
  sport text not null,
  competition text,
  home_team text not null,
  away_team text not null,
  commence_time timestamptz,
  outcome text not null,
  bookmaker text,
  odds numeric not null check (odds > 1),
  model_probability numeric not null check (model_probability > 0 and model_probability < 1),
  market_fair_probability numeric not null check (market_fair_probability > 0 and market_fair_probability < 1),
  edge numeric not null,
  expected_value numeric not null,
  is_suspicious boolean not null default false,
  status text not null default 'detected' check (status in ('detected', 'placed', 'skipped', 'expired')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- backtest_runs : résultats des backtests (single-split ou rolling), pour
-- afficher l'historique de validation du modèle dans le panneau admin
-- ---------------------------------------------------------------------------
create table if not exists public.backtest_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  run_at timestamptz not null default now(),
  sport text not null,
  competition text,
  season text,
  method text not null check (method in ('single_split', 'rolling', 'live')),
  n_test_matches integer,
  model_log_loss numeric,
  baseline_log_loss numeric,
  model_accuracy numeric,
  baseline_accuracy numeric,
  beats_baseline boolean,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS : chaque utilisateur ne voit et ne modifie que ses propres lignes
-- ---------------------------------------------------------------------------
alter table public.settings enable row level security;
alter table public.bankroll_events enable row level security;
alter table public.value_bets enable row level security;
alter table public.backtest_runs enable row level security;

create policy "settings: owner access" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "bankroll_events: owner access" on public.bankroll_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "value_bets: owner access" on public.value_bets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "backtest_runs: owner access" on public.backtest_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Trigger : maintenir settings.updated_at à jour automatiquement
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at
  before update on public.settings
  for each row
  execute function public.set_updated_at();
