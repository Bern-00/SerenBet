"""Tests du module d'ingestion NBA — aucun appel réseau réel, LeagueGameFinder mocké."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pandas as pd

from src.data.nba import NbaDataError, get_matchups, get_season_games

# Format brut nba_api : 1 ligne par équipe par match (2 équipes -> 2 lignes/match)
RAW_GAMES = pd.DataFrame(
    [
        {
            "GAME_ID": "0012300001",
            "GAME_DATE": "2023-10-24",
            "MATCHUP": "LAL vs. DEN",
            "TEAM_NAME": "Lakers",
            "PTS": 110,
            "WL": "W",
        },
        {
            "GAME_ID": "0012300001",
            "GAME_DATE": "2023-10-24",
            "MATCHUP": "DEN @ LAL",
            "TEAM_NAME": "Nuggets",
            "PTS": 105,
            "WL": "L",
        },
    ]
)


def test_get_season_games_wraps_errors_as_nba_data_error():
    with patch("src.data.nba.leaguegamefinder.LeagueGameFinder", side_effect=RuntimeError("boom")), \
         patch("src.data.nba.time.sleep"):
        try:
            get_season_games("2023-24")
            assert False, "devrait lever NbaDataError"
        except NbaDataError as exc:
            assert "2023-24" in str(exc)


def test_get_matchups_merges_home_and_away_rows():
    mock_finder = MagicMock()
    mock_finder.get_data_frames.return_value = [RAW_GAMES]

    with patch("src.data.nba.leaguegamefinder.LeagueGameFinder", return_value=mock_finder), \
         patch("src.data.nba.time.sleep"):
        df = get_matchups("2023-24")

    assert len(df) == 1
    row = df.iloc[0]
    assert row["home_team"] == "Lakers"
    assert row["away_team"] == "Nuggets"
    assert row["home_pts"] == 110
    assert row["away_pts"] == 105
    assert row["season"] == "2023-24"


def test_get_matchups_empty_season_returns_empty_df():
    mock_finder = MagicMock()
    mock_finder.get_data_frames.return_value = [pd.DataFrame()]

    with patch("src.data.nba.leaguegamefinder.LeagueGameFinder", return_value=mock_finder), \
         patch("src.data.nba.time.sleep"):
        df = get_matchups("2099-00")

    assert df.empty
