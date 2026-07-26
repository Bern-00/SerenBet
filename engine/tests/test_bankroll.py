"""Tests du tracker de bankroll : Kelly fractionné, plafond de mise, stop-loss."""
from __future__ import annotations

import pytest

from src.betting.bankroll import BankrollTracker, kelly_fraction


def test_kelly_fraction_matches_known_formula():
    # p=0.55, cotes 2.0 -> f* = (0.55*2 - 1) / (2-1) = 0.10
    assert kelly_fraction(0.55, 2.0) == pytest.approx(0.10, abs=1e-9)


def test_kelly_fraction_negative_when_no_edge():
    # p=0.40, cotes 2.0 -> EV = 0.40*2-1 = -0.20 -> f* négatif
    assert kelly_fraction(0.40, 2.0) < 0


def test_kelly_fraction_rejects_invalid_inputs():
    with pytest.raises(ValueError):
        kelly_fraction(1.5, 2.0)
    with pytest.raises(ValueError):
        kelly_fraction(0.5, 1.0)


def test_recommend_stake_applies_fractional_kelly_and_cap():
    tracker = BankrollTracker(
        starting_bankroll=1000.0,
        kelly_multiplier=0.25,
        max_stake_fraction=0.05,
    )
    # p=0.55, cotes 2.0 -> full kelly = 0.10, 1/4 kelly = 0.025 (sous le plafond de 5%)
    rec = tracker.recommend_stake(0.55, 2.0)
    assert rec.full_kelly_fraction == pytest.approx(0.10, abs=1e-9)
    assert rec.applied_fraction == pytest.approx(0.025, abs=1e-9)
    assert rec.stake_amount == pytest.approx(25.0, abs=1e-9)


def test_recommend_stake_is_capped_when_kelly_is_large():
    tracker = BankrollTracker(
        starting_bankroll=1000.0,
        kelly_multiplier=1.0,  # kelly plein pour forcer le plafond
        max_stake_fraction=0.05,
    )
    # p=0.9, cotes 3.0 -> full kelly = (0.9*3-1)/2 = 0.85 -> largement au-dessus du plafond
    rec = tracker.recommend_stake(0.9, 3.0)
    assert rec.applied_fraction == pytest.approx(0.05, abs=1e-9)
    assert "plafonn" in rec.reason.lower()


def test_recommend_stake_zero_when_no_positive_edge():
    tracker = BankrollTracker(starting_bankroll=1000.0)
    rec = tracker.recommend_stake(0.30, 2.0)  # EV négatif
    assert rec.stake_amount == 0.0
    assert rec.applied_fraction == 0.0


def test_stop_loss_blocks_further_stakes():
    tracker = BankrollTracker(starting_bankroll=1000.0, stop_loss_fraction=0.5)
    tracker.record_bet("simulation perte", stake=600.0, odds=2.0, won=False)
    assert tracker.current_bankroll == pytest.approx(400.0)
    assert tracker.stop_loss_triggered

    rec = tracker.recommend_stake(0.9, 3.0)  # edge énorme, mais stop-loss prioritaire
    assert rec.stake_amount == 0.0
    assert "stop-loss" in rec.reason.lower()


def test_record_bet_updates_bankroll_and_history():
    tracker = BankrollTracker(starting_bankroll=1000.0)
    win_record = tracker.record_bet("pari gagnant", stake=50.0, odds=2.0, won=True)
    assert win_record.profit == pytest.approx(50.0)
    assert tracker.current_bankroll == pytest.approx(1050.0)

    loss_record = tracker.record_bet("pari perdant", stake=50.0, odds=2.0, won=False)
    assert loss_record.profit == pytest.approx(-50.0)
    assert tracker.current_bankroll == pytest.approx(1000.0)
    assert len(tracker.history) == 2


def test_record_bet_rejects_stake_larger_than_bankroll():
    tracker = BankrollTracker(starting_bankroll=100.0)
    with pytest.raises(ValueError):
        tracker.record_bet("mise trop grosse", stake=200.0, odds=2.0, won=True)


def test_drawdown_fraction_tracks_losses():
    tracker = BankrollTracker(starting_bankroll=1000.0)
    tracker.record_bet("perte", stake=100.0, odds=2.0, won=False)
    assert tracker.drawdown_fraction == pytest.approx(0.10, abs=1e-9)
