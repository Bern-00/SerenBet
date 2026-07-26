"""Tests du comparateur probabilités vs cotes marché."""
from __future__ import annotations

import pytest

from src.betting.value_bets import (
    SUSPICIOUS_EDGE_THRESHOLD,
    OddsSet,
    find_value_bets,
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


def test_missing_model_probability_raises():
    odds = OddsSet({"home": 2.10, "draw": 3.40, "away": 3.60})
    with pytest.raises(ValueError):
        find_value_bets({"home": 0.5, "draw": 0.3}, odds)
