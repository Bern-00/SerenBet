export type Settings = {
  id: string;
  user_id: string;
  starting_bankroll: number;
  kelly_multiplier: number;
  max_stake_fraction: number;
  stop_loss_fraction: number;
  updated_at: string;
};

export type BankrollEvent = {
  id: string;
  user_id: string;
  occurred_at: string;
  description: string;
  stake: number;
  odds: number;
  outcome: "win" | "loss" | "pending";
  profit: number;
  bankroll_after: number | null;
  created_at: string;
};

export type ValueBet = {
  id: string;
  user_id: string;
  detected_at: string;
  sport: string;
  competition: string | null;
  home_team: string;
  away_team: string;
  commence_time: string | null;
  outcome: string;
  bookmaker: string | null;
  odds: number;
  model_probability: number;
  market_fair_probability: number;
  edge: number;
  expected_value: number;
  is_suspicious: boolean;
  status: "detected" | "placed" | "skipped" | "expired";
  created_at: string;
};

export type BacktestRun = {
  id: string;
  user_id: string;
  run_at: string;
  sport: string;
  competition: string | null;
  season: string | null;
  method: "single_split" | "rolling" | "live";
  n_test_matches: number | null;
  model_log_loss: number | null;
  baseline_log_loss: number | null;
  model_accuracy: number | null;
  baseline_accuracy: number | null;
  beats_baseline: boolean | null;
  notes: string | null;
  created_at: string;
};

export const DEFAULT_SETTINGS: Pick<
  Settings,
  "starting_bankroll" | "kelly_multiplier" | "max_stake_fraction" | "stop_loss_fraction"
> = {
  starting_bankroll: 1000,
  kelly_multiplier: 0.25,
  max_stake_fraction: 0.05,
  stop_loss_fraction: 0.5,
};
