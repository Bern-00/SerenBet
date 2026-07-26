"""Ingestion des résultats de matchs football via football-data.org (API
officielle gratuite, quota limité — pas de scraping).

Documentation : https://www.football-data.org/documentation/quickstart
"""
from __future__ import annotations

import time
from typing import Optional

import pandas as pd
import requests

from ..config import DATA_CACHE_DIR, FOOTBALL_DATA_API_KEY

BASE_URL = "https://api.football-data.org/v4"

# Free tier: 10 req/min. On reste large en-dessous pour ne pas se faire
# rate-limiter (429) en cours de session.
MIN_REQUEST_INTERVAL_SECONDS = 6.5


class FootballDataError(RuntimeError):
    """Erreur de configuration ou d'appel à l'API football-data.org."""


class FootballDataClient:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or FOOTBALL_DATA_API_KEY
        if not self.api_key:
            raise FootballDataError(
                "FOOTBALL_DATA_API_KEY manquant. Copie engine/.env.example vers "
                "engine/.env et renseigne ta clé gratuite "
                "(https://www.football-data.org/client/register)."
            )
        self._last_request_at = 0.0

    def _get(self, path: str, params: Optional[dict] = None) -> dict:
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < MIN_REQUEST_INTERVAL_SECONDS:
            time.sleep(MIN_REQUEST_INTERVAL_SECONDS - elapsed)

        response = requests.get(
            f"{BASE_URL}{path}",
            headers={"X-Auth-Token": self.api_key},
            params=params,
            timeout=30,
        )
        self._last_request_at = time.monotonic()

        if response.status_code == 429:
            raise FootballDataError(
                "Rate limit football-data.org atteint (429). Réessaie dans "
                "quelques minutes."
            )
        response.raise_for_status()
        return response.json()

    def get_finished_matches(
        self, competition_code: str, season: Optional[int] = None
    ) -> pd.DataFrame:
        """Matchs terminés d'une compétition.

        competition_code: ex 'PL' (Premier League), 'SA' (Serie A), 'CL'.
        season: année de début de saison (ex 2023 pour 2023-24). None = saison
        courante.
        """
        params: dict = {"status": "FINISHED"}
        if season is not None:
            params["season"] = season

        data = self._get(f"/competitions/{competition_code}/matches", params=params)
        return self._matches_to_dataframe(data.get("matches", []), competition_code, season)

    @staticmethod
    def _matches_to_dataframe(matches: list[dict], competition_code: str, season: Optional[int]) -> pd.DataFrame:
        rows = []
        for m in matches:
            full_time = m.get("score", {}).get("fullTime", {})
            rows.append(
                {
                    "match_id": m["id"],
                    "utc_date": m["utcDate"],
                    "matchday": m.get("matchday"),
                    "home_team": m["homeTeam"]["name"],
                    "away_team": m["awayTeam"]["name"],
                    "home_goals": full_time.get("home"),
                    "away_goals": full_time.get("away"),
                    "competition": competition_code,
                    "season": season,
                }
            )
        df = pd.DataFrame(rows)
        if df.empty:
            return df
        return df.dropna(subset=["home_goals", "away_goals"]).reset_index(drop=True)

    def get_finished_matches_cached(
        self,
        competition_code: str,
        season: Optional[int] = None,
        force_refresh: bool = False,
    ) -> pd.DataFrame:
        """Comme get_finished_matches, avec cache disque local pour éviter de
        re-consommer le quota d'API à chaque relance."""
        cache_file = DATA_CACHE_DIR / f"football_{competition_code}_{season or 'current'}.csv"
        if cache_file.exists() and not force_refresh:
            return pd.read_csv(cache_file, parse_dates=["utc_date"])

        df = self.get_finished_matches(competition_code, season)
        df.to_csv(cache_file, index=False)
        return df
