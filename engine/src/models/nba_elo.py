"""Modèle de probabilités NBA : Elo séquentiel avec avantage terrain.

Contrairement au modèle Poisson foot (entraînement batch sur tout
l'historique), l'Elo est mis à jour match par match dans l'ordre
chronologique : chaque prédiction n'utilise que les résultats déjà connus
avant ce match (pas de fuite du futur).
"""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

DEFAULT_INITIAL_RATING = 1500.0
DEFAULT_K_FACTOR = 20.0
DEFAULT_HOME_ADVANTAGE = 100.0  # en points Elo


@dataclass
class EloPrediction:
    home_team: str
    away_team: str
    p_home_win: float
    p_away_win: float
    home_rating_pre: float
    away_rating_pre: float


class NbaEloModel:
    def __init__(
        self,
        initial_rating: float = DEFAULT_INITIAL_RATING,
        k_factor: float = DEFAULT_K_FACTOR,
        home_advantage: float = DEFAULT_HOME_ADVANTAGE,
    ) -> None:
        self.initial_rating = initial_rating
        self.k_factor = k_factor
        self.home_advantage = home_advantage
        self._ratings: dict[str, float] = {}

    def rating(self, team: str) -> float:
        return self._ratings.get(team, self.initial_rating)

    def predict_win_prob(self, home_team: str, away_team: str) -> EloPrediction:
        home_rating = self.rating(home_team)
        away_rating = self.rating(away_team)
        diff = (home_rating + self.home_advantage) - away_rating
        p_home_win = 1.0 / (1.0 + 10 ** (-diff / 400.0))
        return EloPrediction(
            home_team=home_team,
            away_team=away_team,
            p_home_win=p_home_win,
            p_away_win=1.0 - p_home_win,
            home_rating_pre=home_rating,
            away_rating_pre=away_rating,
        )

    def update(self, home_team: str, away_team: str, home_won: bool) -> None:
        pred = self.predict_win_prob(home_team, away_team)
        actual_home = 1.0 if home_won else 0.0

        self._ratings[home_team] = pred.home_rating_pre + self.k_factor * (
            actual_home - pred.p_home_win
        )
        self._ratings[away_team] = pred.away_rating_pre + self.k_factor * (
            (1 - actual_home) - pred.p_away_win
        )


def run_sequential(games: pd.DataFrame, model: NbaEloModel | None = None) -> pd.DataFrame:
    """Parcourt les matchs triés par date, prédit AVANT de mettre à jour les
    ratings. Retourne une ligne par match avec la proba prédite et le
    résultat réel — utile pour l'analyse hors backtest formel.

    games: colonnes attendues game_date, home_team, away_team, home_pts, away_pts.
    """
    required = {"game_date", "home_team", "away_team", "home_pts", "away_pts"}
    missing = required - set(games.columns)
    if missing:
        raise ValueError(f"Colonnes manquantes: {missing}")

    model = model or NbaEloModel()
    sorted_games = games.sort_values("game_date").reset_index(drop=True)

    rows = []
    for row in sorted_games.itertuples():
        pred = model.predict_win_prob(row.home_team, row.away_team)
        home_won = row.home_pts > row.away_pts
        rows.append(
            {
                "game_date": row.game_date,
                "home_team": row.home_team,
                "away_team": row.away_team,
                "p_home_win": pred.p_home_win,
                "home_won": home_won,
            }
        )
        model.update(row.home_team, row.away_team, home_won)

    return pd.DataFrame(rows)
