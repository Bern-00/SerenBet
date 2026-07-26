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
- Question posée : l'edge PL est-il stable ? Un seul split ne permet pas de
  répondre proprement — ajout d'un backtest walk-forward
  (`rolling_backtest_football_model` + `summarize_rolling_backtest`) qui
  découpe la saison en fenêtres glissantes indépendantes. Résultat sur PL
  2023-24 (8 fenêtres) : bat le baseline dans 8/8, edge log-loss entre
  +0.08 et +0.28 (moyenne +0.16). Voir docs/PLAN.md pour la lecture
  honnête (robuste sur cette saison, pas testable d'une saison à l'autre
  pour l'instant, pas encore comparé aux vraies cotes marché).
- Suite de tests : 41/41 après ajout du rolling backtest.
- Décision utilisateur : brancher l'Odds API pour tester le comparateur de
  value bets en conditions réelles sur Premier League.
- Client Odds API (`src/data/odds_api.py`) écrit et testé (mocks) : cotes
  h2h/1X2, gestion 401/429, sélection de bookmaker, suivi du quota restant
  via l'en-tête `x-requests-remaining`. Helper `odds_set_from_row` ajouté
  côté `src/betting/value_bets.py` pour brancher directement sur
  `find_value_bets`. Suite de tests : 48/48.
- Clé Odds API obtenue par l'utilisateur, stockée dans `engine/.env`.
- Découverte : football-data.org tier gratuit couvre en fait plusieurs
  saisons récentes (2023, 2024, 2025 accessibles), pas seulement la saison
  courante comme supposé précédemment — correction de l'hypothèse notée
  dans docs/ERRORS.md du 2026-07-26 (403 sur 2022 = limite plus ancienne,
  pas "saison courante uniquement").
- Constat : saison PL 2026-27 démarre le 21/08/2026 (donc aucun match
  FINISHED sur la saison en cours) mais The Odds API a déjà des cotes de
  pré-saison pour la 1ère journée.
- Module `src/data/team_names.py` ajouté pour faire correspondre les noms
  d'équipes entre football-data.org ("Arsenal FC") et The Odds API
  ("Arsenal") sans dictionnaire figé par équipe.
- Script `scripts/run_live_value_bets.py` : pipeline complet modèle ->
  cotes réelles -> value bets, avec gestion explicite des équipes promues
  inconnues du modèle (skip, pas de devinette).
- Premier run réel : 4 value bets détectés sur 7 matchs prédictibles
  (3 ignorés : Coventry City, Hull City, Ipswich Town — probables promus).
  Edge le plus fort : Brentford-Tottenham +11.1%. **Analyse critique** :
  cet edge est suspect car le modèle (entraîné sur la saison 2025-26) ne
  sait rien du mercato estival — voir la lecture complète dans
  docs/PLAN.md. Ne pas parier là-dessus tel quel.
- Bug corrigé : `normalize_team_name` ratait "AFC Bournemouth" (préfixe
  AFC non géré, seulement le suffixe) — un match légitime était ignoré à
  tort comme "équipe inconnue". Corrigé + test de régression ajouté.
- Suite de tests : 53/53.
- Prochaine étape : décider si on attend quelques journées de la saison
  2026-27 (pour ré-entraîner avec des données à jour) avant tout usage
  réel, ou si on améliore le modèle pour pondérer saison précédente +
  matchs déjà joués de la saison en cours.
- Implémentation de la pondération temporelle (`src/models/sample_weights.py`,
  décroissance exponentielle par ancienneté) + support dans
  `FootballPoissonModel.fit()` et les deux backtests (`half_life_days`).
  Mécanisme testé unitairement (fonctionne comme prévu).
- **Validation empirique sur 3 saisons PL réelles combinées (2023-24 à
  2025-26)** : la pondération n'apporte pas de gain mesurable en général
  (edge quasi identique pondéré/non pondéré), et sur le cas ciblé qui nous
  intéresse (prédire le début d'une nouvelle saison), **le modèle non
  pondéré fait mieux que toutes les variantes pondérées testées**. Décision :
  ne pas brancher la pondération dans le pipeline live — voir l'analyse
  complète dans docs/PLAN.md. Le code reste disponible (testé) mais
  non utilisé par défaut.
- Suite de tests : 62/62.
