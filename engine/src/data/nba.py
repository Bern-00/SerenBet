"""Ingestion des résultats NBA via nba_api (wrapper Python des endpoints
stats.nba.com — pas du scraping HTML, endpoints officiels non documentés
mais largement utilisés par la communauté data NBA).
"""
from __future__ import annotations

import time
from typing import Optional

import pandas as pd
from nba_api.stats.endpoints import leaguegamefinder

from ..config import DATA_CACHE_DIR

# stats.nba.com bloque/ralentit les clients trop agressifs : on espace les
# requêtes par sécurité.
MIN_REQUEST_INTERVAL_SECONDS = 1.0

_last_request_at = 0.0


class NbaDataError(RuntimeError):
    """Erreur lors de la récupération des données NBA."""


def _throttle() -> None:
    global _last_request_at
    elapsed = time.monotonic() - _last_request_at
    if elapsed < MIN_REQUEST_INTERVAL_SECONDS:
        time.sleep(MIN_REQUEST_INTERVAL_SECONDS - elapsed)
    _last_request_at = time.monotonic()


def get_season_games(season: str, season_type: str = "Regular Season") -> pd.DataFrame:
    """Format brut nba_api : une ligne par équipe par match.

    season: format '2023-24'.
    """
    _throttle()
    try:
        finder = leaguegamefinder.LeagueGameFinder(
            season_nullable=season,
            season_type_nullable=season_type,
            league_id_nullable="00",
        )
        return finder.get_data_frames()[0]
    except Exception as exc:  # nba_api lève des erreurs variées selon la panne réseau
        raise NbaDataError(
            f"Échec de récupération NBA pour la saison {season}: {exc}"
        ) from exc


def get_matchups(season: str, season_type: str = "Regular Season") -> pd.DataFrame:
    """Transforme le format nba_api (1 ligne/équipe/match) en 1 ligne/match
    avec colonnes home/away, plus proche de ce qu'attend le modèle de proba.
    """
    raw = get_season_games(season, season_type)
    if raw.empty:
        return raw

    raw = raw.copy()
    raw["is_home"] = raw["MATCHUP"].str.contains(" vs. ")

    home = raw[raw["is_home"]].rename(
        columns={"TEAM_NAME": "home_team", "PTS": "home_pts", "WL": "home_wl"}
    )
    away = raw[~raw["is_home"]].rename(
        columns={"TEAM_NAME": "away_team", "PTS": "away_pts", "WL": "away_wl"}
    )

    merged = pd.merge(
        home[["GAME_ID", "GAME_DATE", "home_team", "home_pts", "home_wl"]],
        away[["GAME_ID", "away_team", "away_pts", "away_wl"]],
        on="GAME_ID",
    )
    merged = merged.rename(columns={"GAME_ID": "game_id", "GAME_DATE": "game_date"})
    merged["season"] = season
    return merged.dropna(subset=["home_pts", "away_pts"]).reset_index(drop=True)


def get_matchups_cached(
    season: str,
    season_type: str = "Regular Season",
    force_refresh: bool = False,
) -> pd.DataFrame:
    cache_file = DATA_CACHE_DIR / f"nba_{season}_{season_type.replace(' ', '')}.csv"
    if cache_file.exists() and not force_refresh:
        return pd.read_csv(cache_file, parse_dates=["game_date"])

    df = get_matchups(season, season_type)
    df.to_csv(cache_file, index=False)
    return df
