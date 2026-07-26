"""Client pour The Odds API (the-odds-api.com) : cotes de marché h2h (1X2)
pour comparaison au modèle de probabilités.

Documentation : https://the-odds-api.com/liveapi/guides/v4/
Tier gratuit : 500 requêtes/mois — chaque appel à get_h2h_odds compte pour
une requête, quel que soit le nombre de matchs retournés.
"""
from __future__ import annotations

import time
from typing import Optional

import pandas as pd
import requests

from ..config import ODDS_API_KEY

BASE_URL = "https://api.the-odds-api.com/v4"
MIN_REQUEST_INTERVAL_SECONDS = 1.0


class OddsApiError(RuntimeError):
    """Erreur de configuration ou d'appel à The Odds API."""


class OddsApiClient:
    def __init__(self, api_key: Optional[str] = None) -> None:
        self.api_key = api_key or ODDS_API_KEY
        if not self.api_key:
            raise OddsApiError(
                "ODDS_API_KEY manquant. Copie engine/.env.example vers "
                "engine/.env et renseigne ta clé gratuite (https://the-odds-api.com/)."
            )
        self._last_request_at = 0.0
        self.last_quota_remaining: Optional[int] = None

    def _get(self, path: str, params: dict) -> list:
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < MIN_REQUEST_INTERVAL_SECONDS:
            time.sleep(MIN_REQUEST_INTERVAL_SECONDS - elapsed)

        response = requests.get(
            f"{BASE_URL}{path}",
            params={"apiKey": self.api_key, **params},
            timeout=30,
        )
        self._last_request_at = time.monotonic()

        remaining = response.headers.get("x-requests-remaining")
        if remaining is not None:
            self.last_quota_remaining = int(remaining)

        if response.status_code == 401:
            raise OddsApiError("Clé Odds API invalide ou expirée (401).")
        if response.status_code == 429:
            raise OddsApiError(
                "Quota Odds API épuisé (429) — le tier gratuit se renouvelle "
                "mensuellement."
            )
        response.raise_for_status()
        return response.json()

    def get_h2h_odds(
        self,
        sport_key: str,
        regions: str = "uk",
        bookmaker: Optional[str] = None,
    ) -> pd.DataFrame:
        """Cotes 1X2 (h2h) pour tous les matchs à venir d'un sport donné.

        sport_key : ex 'soccer_epl' (Premier League), 'soccer_italy_serie_a'.
        regions   : zone des bookmakers ('uk', 'eu', 'us', 'au').
        bookmaker : si précisé, ne garde que ce bookmaker ; sinon le premier
        bookmaker disponible par match (suffisant pour un usage personnel v1 —
        pas de comparaison multi-bookmakers pour l'instant).
        """
        events = self._get(
            f"/sports/{sport_key}/odds",
            params={"regions": regions, "markets": "h2h", "oddsFormat": "decimal"},
        )

        rows = []
        for event in events:
            bookmakers = event.get("bookmakers", [])
            if bookmaker:
                bookmakers = [b for b in bookmakers if b["key"] == bookmaker]
            if not bookmakers:
                continue

            chosen = bookmakers[0]
            h2h_market = next((m for m in chosen["markets"] if m["key"] == "h2h"), None)
            if h2h_market is None:
                continue

            prices = {o["name"]: o["price"] for o in h2h_market["outcomes"]}
            home_team = event["home_team"]
            away_team = event["away_team"]
            if home_team not in prices or away_team not in prices:
                continue

            rows.append(
                {
                    "event_id": event["id"],
                    "commence_time": event["commence_time"],
                    "home_team": home_team,
                    "away_team": away_team,
                    "bookmaker": chosen["key"],
                    "odds_home": prices.get(home_team),
                    "odds_away": prices.get(away_team),
                    "odds_draw": prices.get("Draw"),
                }
            )

        return pd.DataFrame(rows)
