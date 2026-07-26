"""Backtest du modèle Elo NBA : warm-up des ratings sur la partie train
(chronologique), évaluation sur la partie test avec mise à jour continue des
ratings (comme en usage réel), comparaison à un baseline appris uniquement
sur le train (taux de victoire à domicile historique).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.metrics import log_loss

from ..models.nba_elo import NbaEloModel

REQUIRED_COLUMNS = {"game_date", "home_team", "away_team", "home_pts", "away_pts"}


@dataclass
class NbaBacktestResult:
    n_test_games: int
    model_log_loss: float
    baseline_log_loss: float
    model_accuracy: float
    baseline_accuracy: float
    baseline_home_win_rate: float

    @property
    def beats_baseline(self) -> bool:
        return self.model_log_loss < self.baseline_log_loss


def backtest_nba_elo(games: pd.DataFrame, test_fraction: float = 0.2, **elo_kwargs) -> NbaBacktestResult:
    missing = REQUIRED_COLUMNS - set(games.columns)
    if missing:
        raise ValueError(f"Colonnes manquantes: {missing}")
    if games.empty:
        raise ValueError("Impossible de backtester sur un DataFrame vide.")

    sorted_games = games.sort_values("game_date").reset_index(drop=True)
    split_idx = int(len(sorted_games) * (1 - test_fraction))
    train, test = sorted_games.iloc[:split_idx], sorted_games.iloc[split_idx:]
    if train.empty or test.empty:
        raise ValueError("Pas assez de matchs pour découper en train/test.")

    baseline_home_win_rate = float((train["home_pts"] > train["away_pts"]).mean())

    model = NbaEloModel(**elo_kwargs)
    for row in train.itertuples():
        model.update(row.home_team, row.away_team, row.home_pts > row.away_pts)

    y_true = []
    model_probs = []
    for row in test.itertuples():
        pred = model.predict_win_prob(row.home_team, row.away_team)
        home_won = row.home_pts > row.away_pts
        y_true.append(1 if home_won else 0)
        model_probs.append([pred.p_away_win, pred.p_home_win])
        model.update(row.home_team, row.away_team, home_won)

    y_true_arr = np.array(y_true)
    model_probs_arr = np.array(model_probs)
    baseline_probs = np.tile(
        [1 - baseline_home_win_rate, baseline_home_win_rate], (len(test), 1)
    )

    model_ll = log_loss(y_true_arr, model_probs_arr, labels=[0, 1])
    baseline_ll = log_loss(y_true_arr, baseline_probs, labels=[0, 1])

    model_pred = (model_probs_arr[:, 1] >= 0.5).astype(int)
    baseline_pred = (baseline_probs[:, 1] >= 0.5).astype(int)

    return NbaBacktestResult(
        n_test_games=len(test),
        model_log_loss=float(model_ll),
        baseline_log_loss=float(baseline_ll),
        model_accuracy=float((model_pred == y_true_arr).mean()),
        baseline_accuracy=float((baseline_pred == y_true_arr).mean()),
        baseline_home_win_rate=baseline_home_win_rate,
    )
