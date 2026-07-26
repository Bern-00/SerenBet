"""Tracker de bankroll : dimensionnement des mises par Kelly fractionné,
plafond de mise, et stop-loss.

C'est ici que se joue la vraie protection du capital — pas dans une
"garantie" de résultat qui n'existe pas (voir docs/PLAN.md). Le Kelly plein
est agressif et suppose que la probabilité du modèle est exacte ; en
pratique elle est bruitée, donc on applique une fraction de Kelly (1/4 par
défaut) et un plafond de mise absolu.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


def kelly_fraction(model_probability: float, decimal_odds: float) -> float:
    """Fraction de Kelly plein pour un pari à cotes décimales.

    Peut être négative ou nulle si le modèle ne voit pas d'edge — dans ce
    cas, ne pas parier (voir BankrollTracker.recommend_stake).
    """
    if not (0.0 < model_probability < 1.0):
        raise ValueError("model_probability doit être strictement entre 0 et 1.")
    if decimal_odds <= 1.0:
        raise ValueError("decimal_odds doit être strictement supérieur à 1.0.")

    net_odds = decimal_odds - 1.0
    expected_value = model_probability * decimal_odds - 1.0
    return expected_value / net_odds


@dataclass
class StakeRecommendation:
    full_kelly_fraction: float
    applied_fraction: float
    stake_amount: float
    reason: str


@dataclass
class BetRecord:
    timestamp: datetime
    description: str
    stake: float
    odds: float
    outcome: str  # "win" ou "loss"
    profit: float = 0.0


class BankrollTracker:
    def __init__(
        self,
        starting_bankroll: float,
        kelly_multiplier: float = 0.25,
        max_stake_fraction: float = 0.05,
        stop_loss_fraction: float = 0.5,
    ) -> None:
        if starting_bankroll <= 0:
            raise ValueError("starting_bankroll doit être positif.")
        if not (0 < kelly_multiplier <= 1):
            raise ValueError("kelly_multiplier doit être dans ]0, 1].")
        if not (0 < max_stake_fraction <= 1):
            raise ValueError("max_stake_fraction doit être dans ]0, 1].")
        if not (0 < stop_loss_fraction < 1):
            raise ValueError("stop_loss_fraction doit être dans ]0, 1[.")

        self.starting_bankroll = starting_bankroll
        self.current_bankroll = starting_bankroll
        self.kelly_multiplier = kelly_multiplier
        self.max_stake_fraction = max_stake_fraction
        self.stop_loss_fraction = stop_loss_fraction
        self.history: list[BetRecord] = []

    @property
    def stop_loss_triggered(self) -> bool:
        return self.current_bankroll <= self.starting_bankroll * self.stop_loss_fraction

    @property
    def drawdown_fraction(self) -> float:
        """Fraction perdue par rapport au capital de départ (0 = aucune perte)."""
        return max(0.0, 1.0 - self.current_bankroll / self.starting_bankroll)

    def recommend_stake(self, model_probability: float, decimal_odds: float) -> StakeRecommendation:
        if self.stop_loss_triggered:
            return StakeRecommendation(
                full_kelly_fraction=0.0,
                applied_fraction=0.0,
                stake_amount=0.0,
                reason=(
                    f"Stop-loss déclenché : bankroll à {self.current_bankroll:.2f} "
                    f"(seuil {self.stop_loss_fraction * 100:.0f}% du capital de départ "
                    "atteint). Aucune mise recommandée."
                ),
            )

        full_kelly = kelly_fraction(model_probability, decimal_odds)
        if full_kelly <= 0:
            return StakeRecommendation(
                full_kelly_fraction=full_kelly,
                applied_fraction=0.0,
                stake_amount=0.0,
                reason="Pas d'edge positif (EV <= 0) — aucune mise recommandée.",
            )

        fractional_kelly = full_kelly * self.kelly_multiplier
        applied = min(fractional_kelly, self.max_stake_fraction)
        reason = "Kelly fractionné appliqué."
        if fractional_kelly > self.max_stake_fraction:
            reason = f"Mise plafonnée à {self.max_stake_fraction * 100:.0f}% de la bankroll."

        return StakeRecommendation(
            full_kelly_fraction=full_kelly,
            applied_fraction=applied,
            stake_amount=applied * self.current_bankroll,
            reason=reason,
        )

    def record_bet(
        self,
        description: str,
        stake: float,
        odds: float,
        won: bool,
        timestamp: datetime | None = None,
    ) -> BetRecord:
        if stake <= 0:
            raise ValueError("stake doit être positif.")
        if stake > self.current_bankroll:
            raise ValueError("La mise dépasse la bankroll actuelle.")

        profit = stake * (odds - 1.0) if won else -stake
        self.current_bankroll += profit

        record = BetRecord(
            timestamp=timestamp or datetime.now(timezone.utc),
            description=description,
            stake=stake,
            odds=odds,
            outcome="win" if won else "loss",
            profit=profit,
        )
        self.history.append(record)
        return record
