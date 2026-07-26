"""Génère une saison NBA synthétique avec forces d'équipes connues et bruit
réaliste (le sport a de la variance — le modèle ne doit pas prétendre
l'éliminer)."""
from __future__ import annotations

import numpy as np
import pandas as pd


def generate_synthetic_nba_season(
    n_teams: int = 8, n_rounds: int = 60, seed: int = 3
) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    teams = [f"NBA Team {i}" for i in range(n_teams)]
    true_strength = np.linspace(10, -10, n_teams)  # points de force nette
    home_advantage_pts = 3.0

    rows = []
    base_date = pd.Timestamp("2023-10-01")

    for rnd in range(n_rounds):
        order = list(range(n_teams))
        rng.shuffle(order)
        for i in range(0, n_teams - 1, 2):
            home_idx, away_idx = order[i], order[i + 1]
            true_diff = true_strength[home_idx] - true_strength[away_idx] + home_advantage_pts
            noise = rng.normal(0, 12)  # variance intrinsèque du sport
            point_diff = true_diff + noise

            home_pts = int(round(105 + point_diff / 2))
            away_pts = int(round(105 - point_diff / 2))
            if home_pts == away_pts:
                home_pts += 1  # pas de match nul en NBA

            rows.append(
                {
                    "game_id": f"{rnd}-{home_idx}-{away_idx}",
                    "game_date": base_date + pd.Timedelta(days=rnd),
                    "home_team": teams[home_idx],
                    "away_team": teams[away_idx],
                    "home_pts": home_pts,
                    "away_pts": away_pts,
                }
            )

    return pd.DataFrame(rows)
