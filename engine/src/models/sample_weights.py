"""Pondération temporelle des matchs pour l'entraînement des modèles.

Sert notamment à mélanger la saison précédente (prior) avec les matchs déjà
joués de la saison en cours sans logique ad hoc par saison : un simple
décroissance exponentielle par ancienneté donne automatiquement plus de
poids aux matchs récents (ex: fin de saison précédente) qu'aux plus anciens
(ex: début de saison précédente), et plus les matchs de la saison en cours
s'accumulent, plus ils dominent naturellement le poids total.
"""
from __future__ import annotations

from typing import Optional

import pandas as pd

DEFAULT_HALF_LIFE_DAYS = 200.0


def compute_recency_weights(
    dates: pd.Series,
    half_life_days: float = DEFAULT_HALF_LIFE_DAYS,
    reference_date: Optional[pd.Timestamp] = None,
) -> pd.Series:
    """Poids exponentiel décroissant avec l'ancienneté.

    half_life_days=200 -> un match vieux de 200 jours pèse moitié moins
    qu'un match d'aujourd'hui, un match vieux de 400 jours pèse un quart, etc.

    reference_date : point de référence pour calculer l'ancienneté (défaut :
    la date du match le plus récent dans `dates`). En usage réel, passer la
    date à laquelle la prédiction est faite (pas la date du match le plus
    ancien) pour un calcul cohérent.
    """
    if half_life_days <= 0:
        raise ValueError("half_life_days doit être strictement positif.")

    reference = reference_date if reference_date is not None else dates.max()
    days_since = (reference - dates).dt.days.clip(lower=0)
    return 0.5 ** (days_since / half_life_days)
