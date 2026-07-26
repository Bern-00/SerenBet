"""Tests du backtest à fenêtres glissantes (walk-forward) pour estimer la
stabilité de l'edge plutôt qu'un seul split ponctuel."""
from __future__ import annotations

import pytest

from src.backtest.football_backtest import (
    rolling_backtest_football_model,
    summarize_rolling_backtest,
)
from tests.synthetic_league import generate_synthetic_league


def test_rolling_backtest_produces_one_result_per_fold():
    matches = generate_synthetic_league(n_teams=6, n_rounds=60, seed=5)
    results = rolling_backtest_football_model(matches, n_folds=4, min_train_fraction=0.5)
    assert 1 <= len(results) <= 4
    for r in results:
        assert r.n_test_matches > 0
        assert r.model_log_loss > 0
        assert r.baseline_log_loss > 0


def test_summarize_rolling_backtest_reports_variability():
    # Assez de rounds pour que chaque fold d'entraînement reste assez grand
    # pour un fit stable (avec peu de données, le bruit domine le signal —
    # exactement le point que ce backtest sert à illustrer).
    matches = generate_synthetic_league(n_teams=6, n_rounds=120, seed=5)
    results = rolling_backtest_football_model(matches, n_folds=4, min_train_fraction=0.5)
    summary = summarize_rolling_backtest(results)

    assert summary.n_folds == len(results)
    assert 0 <= summary.fraction_folds_beating_baseline <= 1
    assert summary.std_log_loss_edge >= 0
    # Signal réel dans les données synthétiques -> le modèle doit gagner en moyenne
    assert summary.mean_log_loss_edge > 0


def test_rolling_backtest_rejects_impossible_min_train_fraction():
    matches = generate_synthetic_league(n_teams=6, n_rounds=10, seed=1)
    with pytest.raises(ValueError):
        rolling_backtest_football_model(matches, n_folds=3, min_train_fraction=1.5)
