"""Configuration centralisée : chargement des secrets depuis .env.

Aucune clé n'est codée en dur ici — tout vient des variables d'environnement.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ENGINE_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ENGINE_ROOT / ".env")

FOOTBALL_DATA_API_KEY = os.getenv("FOOTBALL_DATA_API_KEY", "")
ODDS_API_KEY = os.getenv("ODDS_API_KEY", "")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

DATA_CACHE_DIR = ENGINE_ROOT / "data_cache"
DATA_CACHE_DIR.mkdir(exist_ok=True)
