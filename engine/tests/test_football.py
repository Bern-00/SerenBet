"""Tests du client football-data.org — pas d'appel réseau réel, tout est mocké."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from src.data.football import FootballDataClient, FootballDataError

SAMPLE_RESPONSE = {
    "matches": [
        {
            "id": 1,
            "utcDate": "2024-08-17T14:00:00Z",
            "matchday": 1,
            "homeTeam": {"name": "Team A"},
            "awayTeam": {"name": "Team B"},
            "score": {"fullTime": {"home": 2, "away": 1}},
        },
        {
            "id": 2,
            "utcDate": "2024-08-18T14:00:00Z",
            "matchday": 1,
            "homeTeam": {"name": "Team C"},
            "awayTeam": {"name": "Team D"},
            # Match pas encore joué : pas de score -> doit être filtré
            "score": {"fullTime": {"home": None, "away": None}},
        },
    ]
}


def test_missing_api_key_raises():
    with pytest.raises(FootballDataError):
        FootballDataClient(api_key="")


def test_get_finished_matches_parses_and_filters_unplayed():
    client = FootballDataClient(api_key="fake-key-for-tests")
    client._last_request_at = 0.0

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = SAMPLE_RESPONSE
    mock_response.raise_for_status.return_value = None

    with patch("src.data.football.requests.get", return_value=mock_response) as mock_get, \
         patch("src.data.football.time.sleep") as mock_sleep:
        df = client.get_finished_matches("PL", season=2024)

    mock_get.assert_called_once()
    call_kwargs = mock_get.call_args.kwargs
    assert call_kwargs["headers"] == {"X-Auth-Token": "fake-key-for-tests"}
    assert call_kwargs["params"] == {"status": "FINISHED", "season": 2024}

    # Le match sans score doit être filtré (dropna)
    assert len(df) == 1
    row = df.iloc[0]
    assert row["home_team"] == "Team A"
    assert row["away_team"] == "Team B"
    assert row["home_goals"] == 2
    assert row["away_goals"] == 1
    assert row["competition"] == "PL"


def test_rate_limit_raises_football_data_error():
    client = FootballDataClient(api_key="fake-key-for-tests")
    client._last_request_at = 0.0

    mock_response = MagicMock()
    mock_response.status_code = 429

    with patch("src.data.football.requests.get", return_value=mock_response), \
         patch("src.data.football.time.sleep"):
        with pytest.raises(FootballDataError):
            client.get_finished_matches("PL")
