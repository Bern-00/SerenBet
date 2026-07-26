"""Backtest du modèle Elo NBA sur données historiques RÉELLES (nba_api).

Contrairement aux tests unitaires (données synthétiques, hors ligne), ce
script fait de vrais appels réseau et doit être lancé manuellement :

    cd engine
    .venv\\Scripts\\python.exe scripts\\run_nba_backtest.py [saison]

saison : format '2023-24'. Par défaut, la saison régulière 2023-24.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.backtest.nba_backtest import backtest_nba_elo  # noqa: E402
from src.data.nba import NbaDataError, get_matchups_cached  # noqa: E402


def main() -> None:
    season = sys.argv[1] if len(sys.argv) > 1 else "2023-24"

    print(f"Récupération des matchs NBA — saison régulière {season}...")
    try:
        games = get_matchups_cached(season, force_refresh=False)
    except NbaDataError as exc:
        print(f"Échec de récupération : {exc}")
        sys.exit(1)

    if games.empty:
        print("Aucun match récupéré — vérifie le format de saison ou la connexion réseau.")
        sys.exit(1)

    print(f"{len(games)} matchs récupérés.\n")

    result = backtest_nba_elo(games, test_fraction=0.2)

    print(f"Matchs de test          : {result.n_test_games}")
    print(f"Log-loss modèle         : {result.model_log_loss:.4f}")
    print(f"Log-loss baseline       : {result.baseline_log_loss:.4f}")
    print(f"Accuracy modèle         : {result.model_accuracy:.3f}")
    print(f"Accuracy baseline       : {result.baseline_accuracy:.3f}")
    print(f"Taux victoire domicile  : {result.baseline_home_win_rate:.3f} (baseline)")
    print(f"Le modèle bat le baseline naïf : {result.beats_baseline}")


if __name__ == "__main__":
    main()
