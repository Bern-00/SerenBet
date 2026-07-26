"""Comparateur probabilités du modèle vs cotes du marché : détection de
value bets (edge positif après retrait de la marge du bookmaker).

Rappel du cadrage (voir docs/PLAN.md) : un edge réaliste se compte en
quelques points de pourcentage. Une "opportunité" avec un edge énorme est un
signal d'alerte (donnée erronée, cote obsolète, bug du modèle), pas une
aubaine — voir ValueBet.is_suspicious.
"""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

SUSPICIOUS_EDGE_THRESHOLD = 0.15
MIN_EDGE_TO_FLAG = 0.02  # en dessous, le bruit d'estimation du modèle domine


@dataclass
class OddsSet:
    """Cotes décimales du marché pour un marché à N issues (ex 1X2 foot :
    {"home": 2.10, "draw": 3.40, "away": 3.60}, ou 2 issues NBA)."""

    outcomes: dict[str, float]

    def implied_probabilities(self) -> dict[str, float]:
        return {outcome: 1.0 / odds for outcome, odds in self.outcomes.items()}

    def overround(self) -> float:
        """Marge du bookmaker (vig) : somme des probas implicites - 1.
        Ex: 0.06 = 6% de marge."""
        return sum(self.implied_probabilities().values()) - 1.0

    def fair_probabilities(self) -> dict[str, float]:
        """Probabilités de marché après retrait proportionnel de la marge —
        c'est CA qu'il faut comparer au modèle, pas les probas implicites brutes."""
        implied = self.implied_probabilities()
        total = sum(implied.values())
        return {outcome: p / total for outcome, p in implied.items()}


@dataclass
class ValueBet:
    outcome: str
    odds: float
    model_probability: float
    market_fair_probability: float
    edge: float  # model_probability - market_fair_probability
    expected_value: float  # EV par unité misée : model_probability * odds - 1

    @property
    def is_suspicious(self) -> bool:
        return self.edge > SUSPICIOUS_EDGE_THRESHOLD


def find_value_bets(
    model_probabilities: dict[str, float],
    odds: OddsSet,
    min_edge: float = MIN_EDGE_TO_FLAG,
) -> list[ValueBet]:
    """Compare les probabilités du modèle aux cotes du marché dé-vigées et
    retourne les issues où le modèle voit un edge positif significatif,
    triées par edge décroissant."""
    missing = set(odds.outcomes) - set(model_probabilities)
    if missing:
        raise ValueError(f"Probabilités du modèle manquantes pour: {missing}")

    fair_probs = odds.fair_probabilities()
    results = []
    for outcome, market_prob in fair_probs.items():
        model_prob = model_probabilities[outcome]
        edge = model_prob - market_prob
        if edge < min_edge:
            continue

        bet_odds = odds.outcomes[outcome]
        results.append(
            ValueBet(
                outcome=outcome,
                odds=bet_odds,
                model_probability=model_prob,
                market_fair_probability=market_prob,
                edge=edge,
                expected_value=model_prob * bet_odds - 1.0,
            )
        )

    return sorted(results, key=lambda vb: vb.edge, reverse=True)


def odds_set_from_row(row: pd.Series) -> OddsSet:
    """Construit un OddsSet à partir d'une ligne du DataFrame retourné par
    OddsApiClient.get_h2h_odds (colonnes odds_home/odds_draw/odds_away)."""
    outcomes = {"home": row["odds_home"], "away": row["odds_away"]}
    if pd.notna(row.get("odds_draw")):
        outcomes["draw"] = row["odds_draw"]
    return OddsSet(outcomes)
