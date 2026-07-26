"""Backtest du modèle Poisson football : split temporel train/test (jamais
aléatoire — on n'entraîne pas sur le futur), comparaison obligatoire à un
baseline naïf (fréquences historiques H/D/A).

Un modèle qui ne bat pas ce baseline n'apporte rien : il ne doit pas être
utilisé pour comparer aux cotes du marché.

Un seul split train/test donne UNE mesure, pas une distribution — une
saison de 380 matchs avec 20% de test, c'est ~76 matchs, largement assez
bruité pour qu'un edge apparent soit en partie du hasard. Le backtest à
fenêtres glissantes (rolling_backtest_football_model) sert à estimer si
l'edge tient sur plusieurs sous-périodes ou si c'est un artefact du split.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.metrics import log_loss

from ..models.football_poisson import FootballPoissonModel
from ..models.sample_weights import compute_recency_weights

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


def _evaluate_split(
    train: pd.DataFrame,
    test: pd.DataFrame,
    half_life_days: Optional[float] = None,
) -> BacktestResult:
    if train.empty or test.empty:
        raise ValueError("Pas assez de matchs pour découper en train/test.")

    known_teams = set(train["home_team"]).union(train["away_team"])
    test = test[test["home_team"].isin(known_teams) & test["away_team"].isin(known_teams)]
    if test.empty:
        raise ValueError("Aucun match de test avec des équipes connues à l'entraînement.")

    if half_life_days is not None:
        # Référence = dernier match connu du train, pour reproduire fidèlement
        # l'usage réel (on prédit "juste après" la fin des données d'entraînement).
        weights = compute_recency_weights(
            train["utc_date"], half_life_days=half_life_days, reference_date=train["utc_date"].max()
        )
        model = FootballPoissonModel().fit(train, weights=weights)
    else:
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


def backtest_football_model(
    matches: pd.DataFrame,
    test_fraction: float = 0.2,
    half_life_days: Optional[float] = None,
) -> BacktestResult:
    """half_life_days : si fourni, pondère les matchs d'entraînement par
    ancienneté (voir src/models/sample_weights.py) au lieu de les compter
    également. None = comportement d'origine (pondération uniforme)."""
    train, test = time_split(matches, test_fraction)
    return _evaluate_split(train, test, half_life_days=half_life_days)


def rolling_backtest_football_model(
    matches: pd.DataFrame,
    n_folds: int = 5,
    min_train_fraction: float = 0.5,
    half_life_days: Optional[float] = None,
) -> list[BacktestResult]:
    """Walk-forward : la saison est découpée en n_folds fenêtres de test
    successives, chacune entraînée uniquement sur ce qui la précède
    chronologiquement. Donne une distribution de résultats plutôt qu'un
    seul point de mesure.
    """
    sorted_matches = matches.sort_values("utc_date").reset_index(drop=True)
    n = len(sorted_matches)
    start_idx = int(n * min_train_fraction)
    if start_idx >= n:
        raise ValueError("min_train_fraction trop grand pour la taille des données.")

    boundaries = np.linspace(start_idx, n, n_folds + 1, dtype=int)

    results = []
    for i in range(n_folds):
        train_end, test_end = int(boundaries[i]), int(boundaries[i + 1])
        if train_end >= test_end:
            continue
        train = sorted_matches.iloc[:train_end]
        test = sorted_matches.iloc[train_end:test_end]
        try:
            results.append(_evaluate_split(train, test, half_life_days=half_life_days))
        except ValueError:
            continue

    if not results:
        raise ValueError("Aucun fold valide généré — augmente la taille des données ou n_folds.")
    return results


@dataclass
class RollingBacktestSummary:
    n_folds: int
    mean_log_loss_edge: float  # baseline - model, moyenne sur les folds (positif = modèle meilleur)
    std_log_loss_edge: float
    fraction_folds_beating_baseline: float
    fold_results: list[BacktestResult]


def summarize_rolling_backtest(results: list[BacktestResult]) -> RollingBacktestSummary:
    edges = np.array([r.baseline_log_loss - r.model_log_loss for r in results])
    return RollingBacktestSummary(
        n_folds=len(results),
        mean_log_loss_edge=float(edges.mean()),
        std_log_loss_edge=float(edges.std(ddof=1)) if len(edges) > 1 else 0.0,
        fraction_folds_beating_baseline=float(np.mean([r.beats_baseline for r in results])),
        fold_results=results,
    )
