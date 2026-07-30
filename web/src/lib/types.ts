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

// ---------------------------------------------------------------------------
// Dashboard Parieur types
// ---------------------------------------------------------------------------

export type MatchOutcomeProbabilities = {
  home: number; // probabilité victoire domicile (modèle)
  draw: number; // probabilité match nul (modèle)
  away: number; // probabilité victoire extérieur (modèle)
};

export type MarketOdds = {
  home: number; // cote 1 du marché
  draw: number; // cote X du marché
  away: number; // cote 2 du marché
};

export type ConfidenceLevel = "high" | "medium" | "low";

export type DetailedMatchStatsRates = {
  lambda_goals_home: number;
  lambda_goals_away: number;
  lambda_corners_home: number;
  lambda_corners_away: number;
  lambda_cards_home: number;
  lambda_cards_away: number;
  lambda_fouls_home: number;
  lambda_fouls_away: number;
  lambda_shots_home: number;
  lambda_shots_away: number;
  lambda_sot_home: number;
  lambda_sot_away: number;
  lambda_offsides_home: number;
  lambda_offsides_away: number;
};

export type UpcomingMatch = {
  id: string;
  sport: string;
  competition: string;
  home_team: string;
  away_team: string;
  commence_time: string; // ISO date string
  model_probs: MatchOutcomeProbabilities;
  market_odds: MarketOdds;
  best_bookmaker: string;
  // Meilleur outcome détecté
  best_outcome: "home" | "draw" | "away" | null;
  best_edge: number | null; // edge en points de %
  best_ev: number | null; // expected value
  is_demo: boolean; // données illustratives ou vraies
  stat_rates?: DetailedMatchStatsRates;
};

export type MarketCategory = "1X2" | "totals" | "btts" | "double_chance" | "draw_no_bet" | "handicap" | "goals" | "corners" | "cards" | "fouls" | "shots" | "offsides";

/**
 * Cotes réelles multi-marchés récupérées depuis The Odds API
 * Chaque marché contient les meilleures cotes parmi tous les bookmakers
 */
export type RealMarketOdds = {
  // Over/Under Buts (totals + alternate_totals)
  totals: Array<{ line: number; over: number; under: number; bookmaker: string }>;
  // Les deux équipes marquent
  btts: { yes: number; no: number; bookmaker: string } | null;
  // Double Chance
  double_chance: { home_draw: number; away_draw: number; home_away: number; bookmaker: string } | null;
  // Draw No Bet
  draw_no_bet: { home: number; away: number; bookmaker: string } | null;
  // Handicap / Spreads
  spreads: Array<{ line: number; home: number; away: number; bookmaker: string }>;
};

export type BettingPick = {
  id: string;
  match_id: string;
  home_team: string;
  away_team: string;
  competition: string;
  sport: string;
  commence_time: string;
  market_type?: MarketCategory;
  outcome: "home" | "draw" | "away" | string;
  outcome_label: string; // ex: "Arsenal gagne", "Over 2.5 Buts @1.53", "BTTS Oui @2.40"
  odds: number;
  model_probability: number;
  market_probability: number;
  edge: number; // en décimal (0.08 = 8pp)
  expected_value: number; // en décimal (0.06 = +6%)
  confidence: ConfidenceLevel;
  kelly_fraction: number; // fraction Kelly recommandée (0.02 = 2%)
  kelly_stake_euros: number; // mise recommandée en €
  bookmaker: string;
  is_suspicious: boolean;
  is_demo: boolean;
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
