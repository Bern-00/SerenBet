"""Modèle de probabilités football : Poisson attaque/défense (Maher 1982),
version simplifiée sans le terme de correlation Dixon-Coles.

Principe : les buts marqués par l'équipe A contre B suivent une loi de
Poisson dont le paramètre dépend de la force offensive de A, de la force
défensive de B, et de l'avantage du terrain. Estimé par régression de
Poisson (GLM) sur l'historique des matchs.

Aucune "garantie" ici : ce sont des probabilités estimées, à valider par
backtest (voir src/backtest/football_backtest.py) avant tout usage réel.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf
from scipy.stats import poisson

MAX_GOALS = 10  # troncature de la grille de score (masse résiduelle négligeable)

REQUIRED_COLUMNS = {"home_team", "away_team", "home_goals", "away_goals"}


@dataclass
class MatchProbabilities:
    home_team: str
    away_team: str
    lambda_home: float
    lambda_away: float
    p_home_win: float
    p_draw: float
    p_away_win: float

    @property
    def implied_probs(self) -> dict:
        return {"home": self.p_home_win, "draw": self.p_draw, "away": self.p_away_win}


class FootballPoissonModel:
    """Modèle attaque/défense par équipe, entraîné par régression de Poisson."""

    def __init__(self) -> None:
        self._glm_result = None
        self._teams: set[str] = set()

    def fit(self, matches: pd.DataFrame) -> "FootballPoissonModel":
        missing = REQUIRED_COLUMNS - set(matches.columns)
        if missing:
            raise ValueError(f"Colonnes manquantes pour l'entraînement: {missing}")
        if matches.empty:
            raise ValueError("Impossible d'entraîner sur un DataFrame vide.")

        long_df = self._to_long_format(matches)
        self._teams = set(matches["home_team"]).union(matches["away_team"])

        model = smf.glm(
            formula="goals ~ is_home + team + opponent",
            data=long_df,
            family=sm.families.Poisson(),
        )
        self._glm_result = model.fit()
        return self

    @staticmethod
    def _to_long_format(matches: pd.DataFrame) -> pd.DataFrame:
        home_rows = pd.DataFrame(
            {
                "team": matches["home_team"],
                "opponent": matches["away_team"],
                "goals": matches["home_goals"],
                "is_home": 1,
            }
        )
        away_rows = pd.DataFrame(
            {
                "team": matches["away_team"],
                "opponent": matches["home_team"],
                "goals": matches["away_goals"],
                "is_home": 0,
            }
        )
        return pd.concat([home_rows, away_rows], ignore_index=True)

    def _predict_lambda(self, team: str, opponent: str, is_home: int) -> float:
        if self._glm_result is None:
            raise RuntimeError("Le modèle doit être entraîné (fit) avant de prédire.")
        if team not in self._teams:
            raise ValueError(f"Équipe inconnue du modèle: {team}")
        if opponent not in self._teams:
            raise ValueError(f"Équipe inconnue du modèle: {opponent}")

        row = pd.DataFrame({"team": [team], "opponent": [opponent], "is_home": [is_home]})
        prediction = self._glm_result.predict(row)
        return float(prediction.iloc[0])

    def predict_match(self, home_team: str, away_team: str) -> MatchProbabilities:
        lambda_home = self._predict_lambda(home_team, away_team, is_home=1)
        lambda_away = self._predict_lambda(away_team, home_team, is_home=0)

        home_probs = poisson.pmf(np.arange(MAX_GOALS + 1), lambda_home)
        away_probs = poisson.pmf(np.arange(MAX_GOALS + 1), lambda_away)
        score_matrix = np.outer(home_probs, away_probs)

        p_home_win = float(np.tril(score_matrix, k=-1).sum())
        p_draw = float(np.trace(score_matrix))
        p_away_win = float(np.triu(score_matrix, k=1).sum())

        total = p_home_win + p_draw + p_away_win
        p_home_win, p_draw, p_away_win = (p / total for p in (p_home_win, p_draw, p_away_win))

        return MatchProbabilities(
            home_team=home_team,
            away_team=away_team,
            lambda_home=lambda_home,
            lambda_away=lambda_away,
            p_home_win=p_home_win,
            p_draw=p_draw,
            p_away_win=p_away_win,
        )
