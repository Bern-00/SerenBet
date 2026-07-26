"""Normalisation des noms d'équipes entre sources (football-data.org utilise
des suffixes 'FC'/'AFC' et '&', The Odds API utilise des noms courts et
'and'). Sert à faire correspondre les deux sans dictionnaire figé par équipe
(fragile à maintenir à chaque changement de nom/promotion)."""
from __future__ import annotations

import re

# Tokens génériques de statut de club, retirés où qu'ils apparaissent (début
# ou fin) : "Arsenal FC" et "AFC Bournemouth" doivent tous les deux matcher
# leur forme courte ("Arsenal", "Bournemouth").
_CLUB_TOKENS_TO_STRIP = {"fc", "afc", "cf"}


def normalize_team_name(name: str) -> str:
    """Forme canonique pour comparaison : tokens de statut de club retirés,
    '&' -> 'and', espaces normalisés, minuscules."""
    normalized = name.strip().replace("&", "and")
    normalized = re.sub(r"\s+", " ", normalized).strip().lower()
    tokens = [t for t in normalized.split(" ") if t not in _CLUB_TOKENS_TO_STRIP]
    return " ".join(tokens)


def build_name_lookup(team_names: list[str]) -> dict[str, str]:
    """Construit {nom_normalisé: nom_original} à partir d'une liste de noms
    (ex: les équipes connues du modèle). Utile pour retrouver le nom exact
    attendu par le modèle à partir d'un nom venant d'une autre source."""
    return {normalize_team_name(name): name for name in team_names}
