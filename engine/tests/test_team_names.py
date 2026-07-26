"""Tests de la normalisation des noms d'équipes entre football-data.org et
The Odds API."""
from __future__ import annotations

from src.data.team_names import build_name_lookup, normalize_team_name


def test_strips_common_club_suffixes():
    assert normalize_team_name("Arsenal FC") == "arsenal"
    assert normalize_team_name("Sunderland AFC") == "sunderland"


def test_strips_club_token_as_prefix_too():
    # "AFC" en préfixe (pas seulement en suffixe) doit aussi être retiré,
    # sinon "AFC Bournemouth" ne matche jamais "Bournemouth" (bug réel
    # rencontré : un match légitime signalé à tort comme "équipe inconnue").
    assert normalize_team_name("AFC Bournemouth") == "bournemouth"
    assert normalize_team_name("Bournemouth") == "bournemouth"


def test_normalizes_ampersand_and_case():
    assert normalize_team_name("Brighton & Hove Albion FC") == "brighton and hove albion"
    assert normalize_team_name("Brighton and Hove Albion") == "brighton and hove albion"


def test_build_name_lookup_maps_normalized_to_original():
    lookup = build_name_lookup(["Arsenal FC", "Manchester United FC", "AFC Bournemouth"])
    assert lookup["arsenal"] == "Arsenal FC"
    assert lookup["manchester united"] == "Manchester United FC"

    # Nom venant de l'Odds API -> retrouve le nom exact attendu par le modèle
    odds_api_name = "Manchester United"
    assert lookup[normalize_team_name(odds_api_name)] == "Manchester United FC"


def test_unknown_team_not_in_lookup():
    lookup = build_name_lookup(["Arsenal FC"])
    assert normalize_team_name("Coventry City") not in lookup
