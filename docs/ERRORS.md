# ERRORS — SerenBet

Journal des erreurs rencontrées, causes et corrections. Sert de mémoire pour
ne pas répéter les mêmes problèmes.

## 2026-07-26 Vulnérabilités npm (web/) — pas de correctif amont disponible

- Symptôme : `npm audit` sur `web/` (Next.js 16.2.12 fraîchement scaffoldé)
  remonte 12 vulnérabilités "high" : `postcss@8.4.31` et `sharp@0.34.5`
  (dépendances internes empaquetées PAR next lui-même, pas dans notre
  `package.json`), plus `brace-expansion` via la chaîne eslint.
- Vérifié : `16.2.12` est déjà la dernière version de Next.js publiée
  (`npm view next version`). `npm audit fix --force` propose de
  redescendre vers `next@9.3.3` (~2020, avant l'App Router) — une
  régression absurde, pas un correctif.
- Décision : ne pas appliquer `--force`. Risque réel évalué comme faible
  pour l'usage actuel :
  - `postcss` (XSS/lecture de fichier via `sourceMappingURL`) : n'affecte
    que le traitement de CSS non fiable — on ne traite que notre propre
    CSS, pas d'upload/CSS utilisateur.
  - `sharp`/libvips (CVEs image) : n'affecte que le traitement d'images
    non fiables via `next/image` — pas encore de upload d'image
    utilisateur dans l'app. **À réévaluer avant d'ajouter une feature
    d'upload d'image (avatars, logos d'équipe, etc.).**
  - `brace-expansion` (DoS regex) : uniquement dans la chaîne eslint
    (outillage de dev, jamais exécuté en prod/runtime utilisateur).
- Action de suivi : relancer `npm audit` après chaque mise à jour de
  Next.js ; upgrader dès qu'un patch amont est disponible.

## 2026-07-26 Crash sur `user!.id` malgré le layout protégé

- Symptôme : en dev, visiter une page `/admin/*` sans être authentifié
  affichait bien la redirection finale vers `/login`, mais le serveur
  loggait `TypeError: Cannot read properties of null (reading 'id')`
  avant la redirection — repéré via les logs `npm run dev`, pas juste par
  le code HTTP final (qui restait 307 et masquait le problème).
- Cause : chaque page admin faisait son propre appel
  `supabase.auth.getUser()` et utilisait `user!.id` (assertion non-null),
  en supposant que le `redirect()` du layout parent (`admin/layout.tsx`)
  garantissait un utilisateur non-null. Mais Next.js peut lancer le
  data-fetching d'une page avant que le redirect du layout ait pris effet
  — le composant page s'exécute quand même avec `user === null`.
- Correction : `src/lib/supabase/require-user.ts` — un helper
  `requireUser()` qui vérifie l'utilisateur ET redirige lui-même,
  utilisé dans CHAQUE page/layout admin au lieu de faire confiance au
  layout parent. Plus aucune assertion `user!.id` dans le code.
- Impact si non corrigé : erreur serveur systématique (loggée, invisible
  côté utilisateur grâce au redirect final, mais un vrai bug qui aurait
  compliqué le débogage plus tard et qui viole le principe "ne pas
  masquer les erreurs avec des assertions non-null").

## 2026-07-26 find_value_bets pouvait remonter un pari EV négatif

- Symptôme : en préparant des données réelles pour le panneau admin, un
  des 4 "value bets" du run PL (Nottingham Forest vs Leeds United) avait
  un edge positif (+2.2%) mais un `expected_value` négatif (-1.3%).
- Cause : `edge` est calculé contre la ligne de marché DÉ-VIGÉE (fair
  probability), mais `expected_value` est calculé contre la COTE RÉELLE
  du bookmaker (qui inclut sa marge). Le filtre de `find_value_bets` ne
  vérifiait que `edge >= min_edge`, jamais le signe de `expected_value` —
  un edge positif sur la ligne théorique peut donc rester EV négatif une
  fois la vraie marge du bookmaker appliquée. Concrètement : recommander
  un pari qui est perdant en espérance, à l'exact opposé de la raison
  d'être de l'outil.
- Correction : `find_value_bets` (src/betting/value_bets.py) exige
  maintenant `expected_value > 0` en plus de `edge >= min_edge`. Test de
  régression ajouté avec les chiffres réels du cas rencontré
  (`test_positive_edge_but_negative_ev_is_excluded`).
- Impact si non corrigé : l'outil aurait pu recommander de vrais paris à
  EV négatif au moment de brancher de l'argent réel — le genre d'erreur
  silencieuse la plus dangereuse pour ce projet précisément.

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
- Impact : au moment de cette entrée, hypothèse initiale (limité à la
  saison en cours). **Correction du 2026-07-26** : testé empiriquement,
  saisons 2023/2024/2025 accessibles avec la même clé — la restriction
  porte sur une fenêtre de plusieurs saisons récentes, pas sur "la saison
  courante uniquement". Un backtest multi-saisons est donc possible dans
  cette fenêtre.

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
