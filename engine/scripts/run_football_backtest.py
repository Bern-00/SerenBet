"""Backtest du modèle Poisson football sur données historiques RÉELLES
(football-data.org).

Fait de vrais appels réseau (consomme le quota API) — à lancer manuellement :

    cd engine
    .venv\\Scripts\\python.exe scripts\\run_football_backtest.py [competition] [season]

competition : code football-data.org, ex 'PL' (Premier League), 'SA' (Serie A).
season      : année de début de saison, ex 2023 pour 2023-24.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.backtest.football_backtest import backtest_football_model  # noqa: E402
from src.data.football import FootballDataError, FootballDataClient  # noqa: E402


def main() -> None:
    competition = sys.argv[1] if len(sys.argv) > 1 else "PL"
    season = int(sys.argv[2]) if len(sys.argv) > 2 else 2023

    print(f"Récupération des matchs {competition} — saison {season}...")
    try:
        client = FootballDataClient()
        matches = client.get_finished_matches_cached(competition, season, force_refresh=False)
    except FootballDataError as exc:
        print(f"Échec de récupération : {exc}")
        sys.exit(1)

    if matches.empty:
        print("Aucun match récupéré — vérifie le code de compétition/saison.")
        sys.exit(1)

    print(f"{len(matches)} matchs récupérés.\n")

    result = backtest_football_model(matches, test_fraction=0.2)

    print(f"Matchs de test    : {result.n_test_matches}")
    print(f"Log-loss modèle   : {result.model_log_loss:.4f}")
    print(f"Log-loss baseline : {result.baseline_log_loss:.4f}")
    print(f"Accuracy modèle   : {result.model_accuracy:.3f}")
    print(f"Accuracy baseline : {result.baseline_accuracy:.3f}")
    print(f"Le modèle bat le baseline naïf : {result.beats_baseline}")


if __name__ == "__main__":
    main()
