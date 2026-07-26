"""Tests du client The Odds API — pas d'appel réseau réel, tout est mocké."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from src.data.odds_api import OddsApiClient, OddsApiError

SAMPLE_EVENTS = [
    {
        "id": "evt1",
        "commence_time": "2026-08-01T14:00:00Z",
        "home_team": "Arsenal",
        "away_team": "Chelsea",
        "bookmakers": [
            {
                "key": "bet365",
                "title": "Bet365",
                "markets": [
                    {
                        "key": "h2h",
                        "outcomes": [
                            {"name": "Arsenal", "price": 1.80},
                            {"name": "Chelsea", "price": 4.50},
                            {"name": "Draw", "price": 3.60},
                        ],
                    }
                ],
            }
        ],
    },
    {
        # Match sans bookmaker disponible -> doit être ignoré, pas planter
        "id": "evt2",
        "commence_time": "2026-08-02T14:00:00Z",
        "home_team": "Liverpool",
        "away_team": "Everton",
        "bookmakers": [],
    },
]


def _mock_response(json_data, headers=None, status_code=200):
    mock_response = MagicMock()
    mock_response.status_code = status_code
    mock_response.json.return_value = json_data
    mock_response.headers = headers or {}
    mock_response.raise_for_status.return_value = None
    return mock_response


def test_missing_api_key_raises():
    with patch("src.data.odds_api.ODDS_API_KEY", ""):
        with pytest.raises(OddsApiError):
            OddsApiClient(api_key="")


def test_get_h2h_odds_parses_and_skips_events_without_bookmaker():
    client = OddsApiClient(api_key="fake-key-for-tests")
    client._last_request_at = 0.0

    mock_response = _mock_response(SAMPLE_EVENTS, headers={"x-requests-remaining": "487"})

    with patch("src.data.odds_api.requests.get", return_value=mock_response) as mock_get, \
         patch("src.data.odds_api.time.sleep"):
        df = client.get_h2h_odds("soccer_epl", regions="uk")

    call_kwargs = mock_get.call_args.kwargs
    assert call_kwargs["params"]["apiKey"] == "fake-key-for-tests"
    assert call_kwargs["params"]["markets"] == "h2h"

    assert len(df) == 1  # evt2 ignoré (pas de bookmaker)
    row = df.iloc[0]
    assert row["home_team"] == "Arsenal"
    assert row["away_team"] == "Chelsea"
    assert row["odds_home"] == 1.80
    assert row["odds_away"] == 4.50
    assert row["odds_draw"] == 3.60
    assert row["bookmaker"] == "bet365"
    assert client.last_quota_remaining == 487


def test_invalid_api_key_raises_on_401():
    client = OddsApiClient(api_key="fake-key-for-tests")
    client._last_request_at = 0.0
    mock_response = _mock_response({}, status_code=401)

    with patch("src.data.odds_api.requests.get", return_value=mock_response), \
         patch("src.data.odds_api.time.sleep"):
        with pytest.raises(OddsApiError):
            client.get_h2h_odds("soccer_epl")


def test_quota_exceeded_raises_on_429():
    client = OddsApiClient(api_key="fake-key-for-tests")
    client._last_request_at = 0.0
    mock_response = _mock_response({}, status_code=429)

    with patch("src.data.odds_api.requests.get", return_value=mock_response), \
         patch("src.data.odds_api.time.sleep"):
        with pytest.raises(OddsApiError):
            client.get_h2h_odds("soccer_epl")


def test_bookmaker_filter_selects_requested_bookmaker_only():
    events = [
        {
            "id": "evt3",
            "commence_time": "2026-08-03T14:00:00Z",
            "home_team": "Man City",
            "away_team": "Spurs",
            "bookmakers": [
                {
                    "key": "pinnacle",
                    "markets": [
                        {
                            "key": "h2h",
                            "outcomes": [
                                {"name": "Man City", "price": 1.30},
                                {"name": "Spurs", "price": 8.0},
                                {"name": "Draw", "price": 5.5},
                            ],
                        }
                    ],
                },
                {
                    "key": "bet365",
                    "markets": [
                        {
                            "key": "h2h",
                            "outcomes": [
                                {"name": "Man City", "price": 1.33},
                                {"name": "Spurs", "price": 7.5},
                                {"name": "Draw", "price": 5.25},
                            ],
                        }
                    ],
                },
            ],
        }
    ]
    client = OddsApiClient(api_key="fake-key-for-tests")
    client._last_request_at = 0.0
    mock_response = _mock_response(events)

    with patch("src.data.odds_api.requests.get", return_value=mock_response), \
         patch("src.data.odds_api.time.sleep"):
        df = client.get_h2h_odds("soccer_epl", bookmaker="bet365")

    assert len(df) == 1
    assert df.iloc[0]["bookmaker"] == "bet365"
    assert df.iloc[0]["odds_home"] == 1.33
