"""Génère une ligue synthétique avec forces d'équipes connues, pour tester
que le modèle apprend un vrai signal (et pas juste du bruit)."""
from __future__ import annotations

import numpy as np
import pandas as pd


def generate_synthetic_league(n_teams: int = 6, n_rounds: int = 30, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    teams = [f"Team {i}" for i in range(n_teams)]

    # Team 0 = attaque forte / bonne défense ; dernière équipe = l'inverse.
    true_attack = np.linspace(1.6, 0.6, n_teams)
    true_defense = np.linspace(0.6, 1.6, n_teams)  # plus haut = concède plus de buts

    rows = []
    match_id = 0
    base_date = pd.Timestamp("2023-08-01")

    for rnd in range(n_rounds):
        order = list(range(n_teams))
        rng.shuffle(order)
        for i in range(0, n_teams - 1, 2):
            home_idx, away_idx = order[i], order[i + 1]
            lambda_home = true_attack[home_idx] * true_defense[away_idx] * 1.15
            lambda_away = true_attack[away_idx] * true_defense[home_idx]

            rows.append(
                {
                    "match_id": match_id,
                    "utc_date": base_date + pd.Timedelta(days=rnd * 7),
                    "home_team": teams[home_idx],
                    "away_team": teams[away_idx],
                    "home_goals": int(rng.poisson(lambda_home)),
                    "away_goals": int(rng.poisson(lambda_away)),
                }
            )
            match_id += 1

    return pd.DataFrame(rows)
