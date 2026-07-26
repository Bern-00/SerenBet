"""Pipeline complet en conditions réelles : entraîne le modèle Poisson sur
la dernière saison PL complète, récupère les cotes réelles à venir (Odds
API), et affiche les value bets détectés — avec les limites explicites
(équipes promues inconnues du modèle, edges suspects).

    cd engine
    .venv\\Scripts\\python.exe scripts\\run_live_value_bets.py [saison_entrainement]

saison_entrainement : année de début de saison pour l'entraînement du
modèle (défaut 2025, soit la saison 2025-26 la plus récente complète).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.betting.value_bets import find_value_bets, odds_set_from_row  # noqa: E402
from src.data.team_names import build_name_lookup, normalize_team_name  # noqa: E402
from src.data.football import FootballDataClient, FootballDataError  # noqa: E402
from src.data.odds_api import OddsApiClient, OddsApiError  # noqa: E402
from src.models.football_poisson import FootballPoissonModel  # noqa: E402


def main() -> None:
    train_season = int(sys.argv[1]) if len(sys.argv) > 1 else 2025

    print(f"Entraînement du modèle sur PL saison {train_season}-{str(train_season + 1)[-2:]}...")
    try:
        football_client = FootballDataClient()
        train_matches = football_client.get_finished_matches_cached(
            "PL", season=train_season, force_refresh=False
        )
    except FootballDataError as exc:
        print(f"Échec récupération données football : {exc}")
        sys.exit(1)

    if train_matches.empty:
        print("Aucune donnée d'entraînement récupérée.")
        sys.exit(1)

    model = FootballPoissonModel().fit(train_matches)
    known_teams = sorted(set(train_matches["home_team"]).union(train_matches["away_team"]))
    name_lookup = build_name_lookup(known_teams)
    print(f"Modèle entraîné sur {len(train_matches)} matchs, {len(known_teams)} équipes connues.\n")

    print("Récupération des cotes réelles (Odds API, soccer_epl)...")
    try:
        odds_client = OddsApiClient()
        odds_df = odds_client.get_h2h_odds("soccer_epl", regions="uk")
    except OddsApiError as exc:
        print(f"Échec récupération cotes : {exc}")
        sys.exit(1)

    if odds_df.empty:
        print("Aucune cote disponible actuellement pour soccer_epl.")
        sys.exit(0)

    print(f"{len(odds_df)} matchs à venir avec cotes trouvés (quota restant: {odds_client.last_quota_remaining}).\n")

    n_predictable = 0
    n_skipped = 0
    n_value_bets = 0

    for _, row in odds_df.iterrows():
        home_key = normalize_team_name(row["home_team"])
        away_key = normalize_team_name(row["away_team"])

        if home_key not in name_lookup or away_key not in name_lookup:
            n_skipped += 1
            print(
                f"IGNORÉ : {row['home_team']} vs {row['away_team']} — équipe(s) sans "
                "historique en Premier League dans les données d'entraînement "
                "(probable promotion). Pas de prédiction fiable possible."
            )
            continue

        n_predictable += 1
        home_team = name_lookup[home_key]
        away_team = name_lookup[away_key]

        pred = model.predict_match(home_team, away_team)
        odds_set = odds_set_from_row(row)
        value_bets = find_value_bets(pred.implied_probs, odds_set)

        print(f"{row['home_team']} vs {row['away_team']} ({row['commence_time']}, {row['bookmaker']})")
        print(
            f"  Modèle   : domicile {pred.p_home_win:.1%} / nul {pred.p_draw:.1%} / "
            f"extérieur {pred.p_away_win:.1%}"
        )
        print(
            f"  Marché   : domicile {odds_set.outcomes['home']:.2f} / "
            f"nul {odds_set.outcomes.get('draw', float('nan')):.2f} / "
            f"extérieur {odds_set.outcomes['away']:.2f} "
            f"(marge bookmaker: {odds_set.overround():.1%})"
        )

        if value_bets:
            n_value_bets += len(value_bets)
            for vb in value_bets:
                flag = " [SUSPECT — vérifier avant de faire confiance]" if vb.is_suspicious else ""
                print(
                    f"  -> VALUE BET sur '{vb.outcome}' : edge {vb.edge:+.1%}, "
                    f"EV {vb.expected_value:+.1%}{flag}"
                )
        else:
            print("  -> Pas d'edge suffisant (< 2 points) sur ce match.")
        print()

    print("--- Résumé ---")
    print(f"Matchs analysés   : {n_predictable}")
    print(f"Matchs ignorés    : {n_skipped} (équipe(s) inconnue(s) du modèle)")
    print(f"Value bets trouvés: {n_value_bets}")


if __name__ == "__main__":
    main()
