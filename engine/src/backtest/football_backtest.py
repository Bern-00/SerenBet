"""Backtest du modèle Poisson football : split temporel train/test (jamais
aléatoire — on n'entraîne pas sur le futur), comparaison obligatoire à un
baseline naïf (fréquences historiques H/D/A).

Un modèle qui ne bat pas ce baseline n'apporte rien : il ne doit pas être
utilisé pour comparer aux cotes du marché.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.metrics import log_loss

from ..models.football_poisson import FootballPoissonModel

OUTCOME_LABELS = ["home", "draw", "away"]


def _match_outcome(row: pd.Series) -> str:
    if row["home_goals"] > row["away_goals"]:
        return "home"
    if row["home_goals"] < row["away_goals"]:
        return "away"
    return "draw"


@dataclass
class BacktestResult:
    n_test_matches: int
    model_log_loss: float
    baseline_log_loss: float
    model_accuracy: float
    baseline_accuracy: float

    @property
    def beats_baseline(self) -> bool:
        """Log-loss plus bas = meilleures probabilités (pas juste plus de bonnes
        prédictions binaires)."""
        return self.model_log_loss < self.baseline_log_loss


def time_split(matches: pd.DataFrame, test_fraction: float = 0.2) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Découpe temporelle : les derniers matchs (par date) servent de test."""
    sorted_matches = matches.sort_values("utc_date").reset_index(drop=True)
    split_idx = int(len(sorted_matches) * (1 - test_fraction))
    return sorted_matches.iloc[:split_idx], sorted_matches.iloc[split_idx:]


def backtest_football_model(matches: pd.DataFrame, test_fraction: float = 0.2) -> BacktestResult:
    train, test = time_split(matches, test_fraction)
    if train.empty or test.empty:
        raise ValueError("Pas assez de matchs pour découper en train/test.")

    known_teams = set(train["home_team"]).union(train["away_team"])
    test = test[test["home_team"].isin(known_teams) & test["away_team"].isin(known_teams)]
    if test.empty:
        raise ValueError("Aucun match de test avec des équipes connues à l'entraînement.")

    model = FootballPoissonModel().fit(train)

    outcomes = test.apply(_match_outcome, axis=1)
    label_to_idx = {label: i for i, label in enumerate(OUTCOME_LABELS)}
    y_true = outcomes.map(label_to_idx).to_numpy()

    model_probs = np.array(
        [
            [pred.p_home_win, pred.p_draw, pred.p_away_win]
            for pred in (
                model.predict_match(row.home_team, row.away_team) for row in test.itertuples()
            )
        ]
    )

    baseline_freqs = train.apply(_match_outcome, axis=1).value_counts(normalize=True)
    baseline_row = [baseline_freqs.get(label, 1e-6) for label in OUTCOME_LABELS]
    baseline_probs = np.tile(baseline_row, (len(test), 1))

    model_ll = log_loss(y_true, model_probs, labels=[0, 1, 2])
    baseline_ll = log_loss(y_true, baseline_probs, labels=[0, 1, 2])

    model_pred_labels = model_probs.argmax(axis=1)
    baseline_pred_labels = baseline_probs.argmax(axis=1)

    return BacktestResult(
        n_test_matches=len(test),
        model_log_loss=float(model_ll),
        baseline_log_loss=float(baseline_ll),
        model_accuracy=float((model_pred_labels == y_true).mean()),
        baseline_accuracy=float((baseline_pred_labels == y_true).mean()),
    )
