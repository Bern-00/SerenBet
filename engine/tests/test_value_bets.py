"""Tests du comparateur probabilités vs cotes marché."""
from __future__ import annotations

import pytest

import pandas as pd

from src.betting.value_bets import (
    SUSPICIOUS_EDGE_THRESHOLD,
    OddsSet,
    find_value_bets,
    odds_set_from_row,
)


def test_overround_reflects_bookmaker_margin():
    # 1/2.10 + 1/3.40 + 1/3.60 ≈ 1.048 -> ~4.8% de marge, réaliste pour du 1X2
    odds = OddsSet({"home": 2.10, "draw": 3.40, "away": 3.60})
    assert odds.overround() == pytest.approx(0.0481, abs=1e-3)


def test_fair_probabilities_sum_to_one():
    odds = OddsSet({"home": 2.10, "draw": 3.40, "away": 3.60})
    fair = odds.fair_probabilities()
    assert sum(fair.values()) == pytest.approx(1.0, abs=1e-9)
    # Le retrait de la marge doit baisser chaque proba implicite
    implied = odds.implied_probabilities()
    for outcome in odds.outcomes:
        assert fair[outcome] < implied[outcome]


def test_find_value_bets_flags_realistic_edge():
    odds = OddsSet({"home": 2.10, "draw": 3.40, "away": 3.60})
    fair = odds.fair_probabilities()
    # Modèle légèrement plus optimiste que le marché sur "home" (+4 points) —
    # edge réaliste, pas un edge de fantaisie.
    model_probs = {
        "home": fair["home"] + 0.04,
        "draw": fair["draw"] - 0.02,
        "away": fair["away"] - 0.02,
    }

    value_bets = find_value_bets(model_probs, odds)

    assert len(value_bets) == 1
    bet = value_bets[0]
    assert bet.outcome == "home"
    assert bet.edge == pytest.approx(0.04, abs=1e-9)
    assert bet.expected_value > 0
    assert not bet.is_suspicious


def test_find_value_bets_ignores_edge_below_threshold():
    odds = OddsSet({"home": 2.10, "draw": 3.40, "away": 3.60})
    fair = odds.fair_probabilities()
    # Edge minuscule (0.5 point) : ne doit rien remonter, c'est du bruit.
    model_probs = {k: v for k, v in fair.items()}
    model_probs["home"] += 0.005

    assert find_value_bets(model_probs, odds) == []


def test_huge_edge_is_flagged_as_suspicious():
    odds = OddsSet({"home": 2.10, "draw": 3.40, "away": 3.60})
    fair = odds.fair_probabilities()
    model_probs = dict(fair)
    model_probs["home"] = min(fair["home"] + 0.30, 0.99)  # edge irréaliste

    value_bets = find_value_bets(model_probs, odds)
    assert value_bets[0].edge > SUSPICIOUS_EDGE_THRESHOLD
    assert value_bets[0].is_suspicious


def test_positive_edge_but_negative_ev_is_excluded():
    # Cas réel rencontré en prod (Nottingham Forest vs Leeds United,
    # PL 2026-27) : edge positif (+2.2%) contre la ligne dé-vigée, mais EV
    # négatif (-1.3%) contre la cote réelle du bookmaker une fois sa marge
    # prise en compte. Un tel pari ne doit jamais être remonté comme
    # "value bet" — sinon l'outil recommande un pari perdant en espérance.
    odds = OddsSet({"home": 2.15, "draw": 3.50, "away": 3.20})
    model_probs = {"home": 0.459, "draw": 0.257, "away": 0.284}

    value_bets = find_value_bets(model_probs, odds)

    assert value_bets == []


def test_missing_model_probability_raises():
    odds = OddsSet({"home": 2.10, "draw": 3.40, "away": 3.60})
    with pytest.raises(ValueError):
        find_value_bets({"home": 0.5, "draw": 0.3}, odds)


def test_odds_set_from_row_builds_three_way_market():
    row = pd.Series({"odds_home": 1.80, "odds_draw": 3.60, "odds_away": 4.50})
    odds = odds_set_from_row(row)
    assert odds.outcomes == {"home": 1.80, "away": 4.50, "draw": 3.60}


def test_odds_set_from_row_handles_missing_draw():
    # Marché à 2 issues (ex NBA) : pas de colonne odds_draw significative.
    row = pd.Series({"odds_home": 1.50, "odds_draw": float("nan"), "odds_away": 2.60})
    odds = odds_set_from_row(row)
    assert odds.outcomes == {"home": 1.50, "away": 2.60}
