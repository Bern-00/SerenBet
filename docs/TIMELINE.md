# TIMELINE — SerenBet

Historique daté des sessions de travail. Une entrée par session, la plus
récente en haut.

## 2026-07-25

- Cadrage du projet : abandon de l'hypothèse "garantie 98%" (statistiquement
  intenable — voir docs/PLAN.md).
- Clarification : usage personnel pour l'instant, éventuel passage en public
  plus tard selon les résultats du backtest. Pas d'obscurcissement de code ni
  de manipulation cachée des résultats — sécurité = bonnes pratiques
  (secrets, RLS, audit), pas obscurité du langage.
- Sports choisis : football (football-data.org) et NBA (nba_api).
- Scaffolding initial : arborescence `engine/`, docs `.md`, `README.md`.
- Prochaine étape : environnement Python + dépendances, puis module
  d'ingestion football.

## 2026-07-26

- Environnement Python créé (venv), dépendances installées — conflit
  numpy 2.x/nba_api résolu (voir docs/ERRORS.md).
- Modules d'ingestion football (football-data.org) et NBA (nba_api) écrits
  et testés avec mocks (pas d'appel réseau réel, pas de clé API consommée).
- Modèle Poisson football (attaque/défense, régression GLM) écrit, testé et
  backtesté sur une ligue synthétique à forces connues : bat le baseline
  naïf (log-loss 0.923 vs 1.050, accuracy 62.5% vs 45.8%).
- Modèle Elo NBA (séquentiel, avantage terrain) écrit, testé et backtesté
  sur une saison synthétique : bat le baseline naïf (taux de victoire à
  domicile).
- Comparateur value bet (dé-vigage des cotes, calcul d'edge et d'EV, flag
  "suspicious" au-delà de 15% d'edge) écrit et testé.
- Tracker de bankroll (Kelly fractionné 1/4 par défaut, plafond 5% par pari,
  stop-loss à 50% du capital de départ) écrit et testé.
- Audit de sécurité des dépendances (pip-audit) : 9 vulnérabilités trouvées
  sur pip/pytest/python-dotenv/requests, corrigées par mise à jour de
  version. Suite de tests (37/37) toujours verte après upgrade.
- Prochaine étape : backtest sur données historiques **réelles** (pas
  synthétiques) avant toute décision d'usage réel ou de passage en public.
- Clé football-data.org obtenue par l'utilisateur, stockée dans
  `engine/.env` (jamais commitée, confirmé via `git check-ignore`).
- Backtest football sur données réelles : Premier League 2023-24 (380
  matchs) — modèle bat nettement le baseline (log-loss 0.914 vs 1.048,
  accuracy 56.6% vs 44.7%). Serie A 2023-24 — bat le baseline mais avec une
  marge faible (log-loss 1.121 vs 1.127). Voir docs/PLAN.md pour le détail
  et une lecture honnête de ces chiffres (edge modeste, pas de 98%).
- Backtest NBA sur données réelles bloqué : `stats.nba.com` injoignable
  depuis cet environnement (anti-bot), alors que l'accès internet général
  et football-data.org fonctionnent. À relancer depuis un autre réseau.
- Bug corrigé : erreur 403 de football-data.org (restriction tier gratuit
  sur les saisons anciennes) remontait un traceback brut — intercepté et
  transformé en message clair.
- Bug de test corrigé : `test_missing_api_key_raises` dépendait de l'état
  ambiant de `.env`, cassait dès qu'une vraie clé était configurée — patché
  pour être indépendant de l'environnement.
- Suite de tests : 38/38 après ces corrections.
- Prochaine étape : décider si l'edge Premier League justifie de brancher
  une source de cotes réelles (Odds API) pour un premier test de value bets
  en conditions réelles — ou d'abord élargir le backtest à d'autres saisons
  PL (si upgrade de plan API) pour confirmer la stabilité de l'edge.
