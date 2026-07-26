"""Tests de la pondération temporelle (recency weights)."""
from __future__ import annotations

import pandas as pd
import pytest

from src.models.sample_weights import compute_recency_weights


def test_most_recent_match_has_weight_one():
    dates = pd.Series(pd.to_datetime(["2026-01-01", "2026-03-01", "2026-06-01"]))
    weights = compute_recency_weights(dates, half_life_days=100)
    assert weights.iloc[-1] == pytest.approx(1.0)


def test_weight_halves_at_half_life():
    reference = pd.Timestamp("2026-06-01")
    dates = pd.Series(pd.to_datetime(["2026-01-02"]))  # ~150 jours avant
    weights = compute_recency_weights(dates, half_life_days=150, reference_date=reference)
    assert weights.iloc[0] == pytest.approx(0.5, abs=1e-3)


def test_older_matches_weigh_less_than_recent_ones():
    dates = pd.Series(pd.to_datetime(["2025-08-01", "2026-05-01", "2026-06-01"]))
    weights = compute_recency_weights(dates, half_life_days=200)
    assert weights.iloc[0] < weights.iloc[1] < weights.iloc[2]


def test_rejects_non_positive_half_life():
    dates = pd.Series(pd.to_datetime(["2026-01-01"]))
    with pytest.raises(ValueError):
        compute_recency_weights(dates, half_life_days=0)


def test_future_reference_date_does_not_produce_negative_days():
    # reference_date dans le futur par rapport à toutes les dates -> poids
    # toujours <= 1, jamais d'exposant négatif qui ferait exploser le poids.
    reference = pd.Timestamp("2027-01-01")
    dates = pd.Series(pd.to_datetime(["2026-01-01", "2026-06-01"]))
    weights = compute_recency_weights(dates, half_life_days=200, reference_date=reference)
    assert (weights <= 1.0).all()
    assert (weights > 0).all()
