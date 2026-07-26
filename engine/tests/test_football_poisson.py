"""Tests du modèle Poisson football sur une ligue synthétique à forces connues."""
from __future__ import annotations

import pytest

from src.models.football_poisson import FootballPoissonModel
from tests.synthetic_league import generate_synthetic_league


@pytest.fixture(scope="module")
def fitted_model():
    matches = generate_synthetic_league(n_teams=6, n_rounds=30, seed=42)
    return FootballPoissonModel().fit(matches), matches


def test_probabilities_sum_to_one(fitted_model):
    model, _ = fitted_model
    pred = model.predict_match("Team 0", "Team 5")
    total = pred.p_home_win + pred.p_draw + pred.p_away_win
    assert total == pytest.approx(1.0, abs=1e-6)
    assert 0 <= pred.p_home_win <= 1
    assert 0 <= pred.p_draw <= 1
    assert 0 <= pred.p_away_win <= 1


def test_strongest_team_favoured_at_home_vs_weakest(fitted_model):
    model, _ = fitted_model
    # Team 0 = force max, Team 5 = force min (voir synthetic_league.py)
    pred = model.predict_match("Team 0", "Team 5")
    assert pred.p_home_win > pred.p_away_win
    assert pred.p_home_win > 0.5


def test_symmetric_matchup_is_less_lopsided_than_extreme(fitted_model):
    model, _ = fitted_model
    extreme = model.predict_match("Team 0", "Team 5")
    mid = model.predict_match("Team 2", "Team 3")
    assert extreme.p_home_win - extreme.p_away_win > mid.p_home_win - mid.p_away_win


def test_unknown_team_raises(fitted_model):
    model, _ = fitted_model
    with pytest.raises(ValueError):
        model.predict_match("Équipe Fantôme", "Team 0")


def test_fit_requires_known_columns():
    import pandas as pd

    bad_df = pd.DataFrame({"home_team": ["A"], "away_team": ["B"]})
    with pytest.raises(ValueError):
        FootballPoissonModel().fit(bad_df)


def test_fit_rejects_empty_dataframe():
    import pandas as pd

    empty_df = pd.DataFrame(
        columns=["home_team", "away_team", "home_goals", "away_goals"]
    )
    with pytest.raises(ValueError):
        FootballPoissonModel().fit(empty_df)
