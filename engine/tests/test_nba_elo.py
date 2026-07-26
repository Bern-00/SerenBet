"""Tests du modèle Elo NBA sur une saison synthétique à forces connues."""
from __future__ import annotations

import pytest

from src.models.nba_elo import NbaEloModel, run_sequential
from tests.synthetic_nba import generate_synthetic_nba_season


def test_new_teams_start_at_initial_rating():
    model = NbaEloModel()
    assert model.rating("Nouvelle Équipe") == model.initial_rating


def test_home_advantage_favours_equal_strength_home_team():
    model = NbaEloModel()
    pred = model.predict_win_prob("Team A", "Team B")
    assert pred.p_home_win > 0.5
    assert pred.p_home_win + pred.p_away_win == pytest.approx(1.0)


def test_ratings_move_in_expected_direction_after_upset_win():
    model = NbaEloModel()
    rating_before = model.rating("Underdog")
    # L'outsider gagne à l'extérieur contre le favori : son rating doit monter.
    model.update(home_team="Favori", away_team="Underdog", home_won=False)
    assert model.rating("Underdog") > rating_before
    assert model.rating("Favori") < model.initial_rating


def test_sequential_run_learns_signal_over_a_season():
    games = generate_synthetic_nba_season(n_teams=8, n_rounds=60, seed=3)
    model = NbaEloModel()
    result = run_sequential(games, model)

    assert len(result) == len(games)
    # Après une saison complète, l'équipe la plus forte doit avoir un rating
    # nettement supérieur à la plus faible (Team 0 = force max, Team 7 = min).
    assert model.rating("NBA Team 0") > model.rating("NBA Team 7")


def test_run_sequential_requires_known_columns():
    import pandas as pd

    bad_df = pd.DataFrame({"home_team": ["A"], "away_team": ["B"]})
    with pytest.raises(ValueError):
        run_sequential(bad_df)
