# ERRORS — SerenBet

Journal des erreurs rencontrées, causes et corrections. Sert de mémoire pour
ne pas répéter les mêmes problèmes.

Format d'une entrée :

```
## [date] Titre court
- Symptôme :
- Cause :
- Correction :
- Impact / risque si non corrigé :
```

## 2026-07-25 Conflit numpy 2.x vs nba_api

- Symptôme : `pip install -r requirements.txt` échoue avec
  `ResolutionImpossible` sur numpy.
- Cause : `nba_api==1.6.1` exige `numpy<2.0`, incompatible avec la contrainte
  initiale `numpy==2.1.3` (pandas/scipy/statsmodels/scikit-learn acceptent
  tous numpy 1.26+, donc pas de vrai besoin de numpy 2.x ici).
- Correction : contrainte assouplie à `numpy<2.0,>=1.26.0` dans
  `engine/requirements.txt`. Environnement recréé, tous les imports validés
  (numpy 1.26.4, pandas 2.2.3).
- Impact si non corrigé : impossible d'installer l'environnement, bloquant
  pour toute la suite.

## 2026-07-26 Vulnérabilités connues dans les dépendances (pip-audit)

- Symptôme : `pip-audit` remonte 9 CVE/advisories sur 4 paquets (pip,
  pytest, python-dotenv, requests).
- Cause : versions figées initialement sans vérification de sécurité.
- Correction : mise à jour vers `requests==2.33.0`, `python-dotenv==1.2.2`,
  `pytest==9.0.3`, `pip` upgradé dans le venv. Suite de tests (37/37)
  toujours verte après upgrade, `pip-audit` propre.
- Impact si non corrigé : exposition à des vulnérabilités connues et
  corrigées en amont — sans intérêt à les garder.

## 2026-07-26 nba_api injoignable depuis cet environnement d'exécution

- Symptôme : `get_matchups_cached()` échoue avec un timeout réseau sur
  `stats.nba.com` (30s, puis confirmé à 15s en accès direct).
- Cause : `nba.com` répond 403 et `stats.nba.com` ne répond pas du tout
  (packets silencieusement ignorés) depuis cette machine/IP, alors que
  `google.com` et `api.football-data.org` répondent normalement (200/404).
  Signature typique d'un blocage anti-bot (Akamai) sur les IP de
  datacenter/environnements cloud — pas un problème de code ni de quota.
- Correction : aucune côté code. Le module `src/data/nba.py` est correct
  (testé avec mocks). À relancer depuis une machine/réseau résidentiel
  classique (ex: le poste local de l'utilisateur) où `stats.nba.com` répond
  généralement sans blocage.
- Impact : le backtest NBA sur données **réelles** est bloqué depuis cet
  environnement précis. Le backtest sur ligue synthétique reste valide pour
  vérifier la logique du modèle. Prochaine étape NBA réelle : relancer
  `engine/scripts/run_nba_backtest.py` depuis un réseau qui n'est pas
  bloqué par nba.com.

## 2026-07-26 Tier gratuit football-data.org limité à la saison courante

- Symptôme : `get_finished_matches("PL", season=2022)` échoue avec un
  `HTTPError 403` brut et peu clair.
- Cause : le tier gratuit de football-data.org restreint l'accès aux
  saisons anciennes (confirmé empiriquement : saison 2023 OK, 2022 refusé
  avec la même clé).
- Correction : `src/data/football.py` intercepte maintenant le 403 et lève
  un `FootballDataError` explicite ("restriction du tier gratuit...") au
  lieu de laisser remonter un traceback requests brut. Test ajouté
  (`test_forbidden_tier_restriction_raises_clear_error`).
- Impact : le backtest réel est limité à la saison en cours par compétition
  tant que le compte reste gratuit — suffisant pour valider le pipeline,
  pas pour un backtest multi-saisons.

## 2026-07-26 Test fragile car dépendant de l'environnement ambiant

- Symptôme : après ajout d'un vrai `engine/.env` avec une clé
  football-data.org, `test_missing_api_key_raises` s'est mis à échouer
  (`DID NOT RAISE`).
- Cause : le test appelait `FootballDataClient(api_key="")`, mais le
  constructeur retombe sur le `FOOTBALL_DATA_API_KEY` chargé depuis
  `.env` au niveau module — donc dès qu'une vraie clé existe dans
  l'environnement, le test ne peut plus déclencher le cas "clé manquante".
- Correction : le test patch désormais explicitement
  `src.data.football.FOOTBALL_DATA_API_KEY` à `""` pour rester
  indépendant de l'environnement d'exécution.
- Impact si non corrigé : suite de tests qui casse de façon
  non-déterministe selon que `.env` existe ou non sur la machine — leçon
  générale pour les futurs tests touchant à la config.
