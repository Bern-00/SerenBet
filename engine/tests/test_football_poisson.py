"""Tests du modèle Poisson football sur une ligue synthétique à forces connues."""
from __future__ import annotations

import pandas as pd
import pytest

from src.models.football_poisson import FootballPoissonModel
from src.models.sample_weights import compute_recency_weights
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


def _era_matches(strong_team: str, weak_team: str, start_date: str, n_matches: int = 8) -> pd.DataFrame:
    """Matchs déterministes (pas de bruit Poisson) : strong_team écrase
    weak_team 3-0 à chaque confrontation, alternant domicile/extérieur."""
    rows = []
    date = pd.Timestamp(start_date)
    for i in range(n_matches):
        if i % 2 == 0:
            home, away, home_goals, away_goals = strong_team, weak_team, 3, 0
        else:
            home, away, home_goals, away_goals = weak_team, strong_team, 0, 3
        rows.append(
            {
                "match_id": f"{strong_team}-{i}",
                "utc_date": date,
                "home_team": home,
                "away_team": away,
                "home_goals": home_goals,
                "away_goals": away_goals,
            }
        )
        date += pd.Timedelta(days=7)
    return pd.DataFrame(rows)


def test_recency_weighting_favours_recent_contradicting_evidence():
    # Ere 1 (ancienne) : Team X écrase Team Y. Ere 2 (récente) : l'inverse
    # (simule un changement d'effectif entre deux saisons).
    era1 = _era_matches("Team X", "Team Y", start_date="2023-01-01")
    era2 = _era_matches("Team Y", "Team X", start_date="2026-06-01")
    combined = pd.concat([era1, era2], ignore_index=True)

    unweighted_model = FootballPoissonModel().fit(combined)
    unweighted_pred = unweighted_model.predict_match("Team X", "Team Y")

    weights = compute_recency_weights(
        combined["utc_date"], half_life_days=30, reference_date=era2["utc_date"].max()
    )
    weighted_model = FootballPoissonModel().fit(combined, weights=weights)
    weighted_pred = weighted_model.predict_match("Team X", "Team Y")

    # Avec un poids fort sur l'ère récente (qui dit "Team Y est meilleure"),
    # la victoire à domicile de Team X doit devenir bien moins probable que
    # dans le fit non pondéré (qui moyenne les deux ères contradictoires).
    assert weighted_pred.p_home_win < unweighted_pred.p_home_win
    assert weighted_pred.p_home_win < 0.5


def test_fit_rejects_mismatched_weights_length():
    matches = generate_synthetic_league(n_teams=4, n_rounds=5, seed=1)
    bad_weights = pd.Series([1.0, 2.0])  # mauvaise longueur
    with pytest.raises(ValueError):
        FootballPoissonModel().fit(matches, weights=bad_weights)
