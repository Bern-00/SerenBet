"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/require-user";

/**
 * Charge les résultats RÉELS déjà calculés par le moteur Python (backtests
 * PL 2023-24, value bets détectés sur les cotes réelles de la 1ère journée
 * 2026-27) — pas des données inventées. Sert à peupler le panneau pour le
 * tester en conditions réelles tant que la synchronisation automatique
 * moteur -> Supabase n'est pas branchée (nécessite la clé service_role).
 *
 * Utilise le client authentifié de l'utilisateur : les lignes sont donc
 * insérées avec son propre user_id, RLS respectée sans clé privilégiée.
 */
export async function seedRealResults() {
  const { supabase, user } = await requireUser();

  const { error: backtestError } = await supabase.from("backtest_runs").insert([
    {
      user_id: user.id,
      sport: "football",
      competition: "Premier League",
      season: "2023-24",
      method: "single_split",
      n_test_matches: 76,
      model_log_loss: 0.9141,
      baseline_log_loss: 1.0481,
      model_accuracy: 0.566,
      baseline_accuracy: 0.447,
      beats_baseline: true,
      notes: "Split unique 80/20, saison complète (380 matchs).",
    },
    {
      user_id: user.id,
      sport: "football",
      competition: "Premier League",
      season: "2023-24",
      method: "rolling",
      n_test_matches: 190,
      model_log_loss: 0.9124,
      baseline_log_loss: 1.0726,
      model_accuracy: 0.564,
      baseline_accuracy: 0.459,
      beats_baseline: true,
      notes:
        "Walk-forward, 8 fenêtres indépendantes. Bat le baseline dans 8/8 fenêtres " +
        "(edge log-loss entre +0.08 et +0.28, moyenne +0.16). Chiffres moyennés sur les folds.",
    },
  ]);

  if (backtestError) throw new Error(backtestError.message);

  const { error: valueBetsError } = await supabase.from("value_bets").insert([
    {
      user_id: user.id,
      sport: "football",
      competition: "Premier League",
      home_team: "Brentford",
      away_team: "Tottenham Hotspur",
      commence_time: "2026-08-22T16:30:00Z",
      outcome: "home",
      bookmaker: "betfair_sb_uk",
      odds: 2.3,
      model_probability: 0.519,
      market_fair_probability: 0.407,
      edge: 0.112,
      expected_value: 0.193,
      is_suspicious: true,
      status: "detected",
    },
    {
      user_id: user.id,
      sport: "football",
      competition: "Premier League",
      home_team: "Newcastle United",
      away_team: "Liverpool",
      commence_time: "2026-08-23T15:30:00Z",
      outcome: "home",
      bookmaker: "betfair_sb_uk",
      odds: 2.7,
      model_probability: 0.39,
      market_fair_probability: 0.345,
      edge: 0.045,
      expected_value: 0.052,
      is_suspicious: false,
      status: "detected",
    },
    {
      user_id: user.id,
      sport: "football",
      competition: "Premier League",
      home_team: "Fulham",
      away_team: "Chelsea",
      commence_time: "2026-08-24T19:00:00Z",
      outcome: "home",
      bookmaker: "betfred_uk",
      odds: 3.0,
      model_probability: 0.383,
      market_fair_probability: 0.31,
      edge: 0.073,
      expected_value: 0.15,
      is_suspicious: false,
      status: "detected",
    },
  ]);

  if (valueBetsError) throw new Error(valueBetsError.message);

  revalidatePath("/admin");
  revalidatePath("/admin/backtests");
  revalidatePath("/admin/value-bets");
}
