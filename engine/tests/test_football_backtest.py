"""Le backtest doit tourner de bout en bout et produire des métriques
sensées sur une ligue synthétique où le signal (forces d'équipes) existe
réellement — sinon le pipeline lui-même est cassé."""
from __future__ import annotations

import pytest

from src.backtest.football_backtest import backtest_football_model
from tests.synthetic_league import generate_synthetic_league


def test_backtest_runs_and_beats_naive_baseline():
    matches = generate_synthetic_league(n_teams=6, n_rounds=40, seed=7)
    result = backtest_football_model(matches, test_fraction=0.2)

    assert result.n_test_matches > 0
    assert result.model_log_loss > 0
    assert result.baseline_log_loss > 0
    assert 0 <= result.model_accuracy <= 1
    assert 0 <= result.baseline_accuracy <= 1
    # Le signal (forces d'équipes) est réel ici : le modèle doit faire mieux
    # qu'un baseline qui ignore complètement l'identité des équipes.
    assert result.beats_baseline


def test_backtest_raises_on_too_few_matches():
    matches = generate_synthetic_league(n_teams=6, n_rounds=1, seed=1)
    with pytest.raises(ValueError):
        backtest_football_model(matches, test_fraction=0.9)
