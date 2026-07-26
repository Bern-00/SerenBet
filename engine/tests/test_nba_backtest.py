"""Le backtest NBA doit tourner de bout en bout et battre le baseline naïf
(taux de victoire à domicile) sur une saison synthétique où le signal
(forces d'équipes) existe réellement."""
from __future__ import annotations

import pytest

from src.backtest.nba_backtest import backtest_nba_elo
from tests.synthetic_nba import generate_synthetic_nba_season


def test_backtest_runs_and_beats_naive_baseline():
    games = generate_synthetic_nba_season(n_teams=8, n_rounds=80, seed=11)
    result = backtest_nba_elo(games, test_fraction=0.2)

    assert result.n_test_games > 0
    assert result.model_log_loss > 0
    assert result.baseline_log_loss > 0
    assert 0 <= result.model_accuracy <= 1
    assert 0 <= result.baseline_accuracy <= 1
    assert result.beats_baseline


def test_backtest_raises_on_too_few_games():
    games = generate_synthetic_nba_season(n_teams=8, n_rounds=1, seed=1)
    with pytest.raises(ValueError):
        backtest_nba_elo(games, test_fraction=0.9)
