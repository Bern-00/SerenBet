# PLAN — SerenBet

## Objectif réel (et ses limites)

Construire un outil d'aide à la décision pour paris sportifs basé sur des
probabilités statistiques, pas des garanties. Attente réaliste : un edge de
quelques points de pourcentage au-dessus du marché sur un sous-ensemble de
matchs, si le modèle est bon. Aucun modèle ne bat le marché de façon
systématique et massive — les cotes intègrent déjà la marge du bookmaker
(vig) et l'information publique.

## Portée v1 (usage personnel)

| Module | Sport | Statut |
|---|---|---|
| Ingestion stats | Football (football-data.org) | Fait — testé (mocks) |
| Ingestion stats | NBA (nba_api) | Fait — testé (mocks) |
| Modèle probabilités | Football — Poisson attaque/défense (Maher) | Fait — backtest OK sur ligue synthétique (bat le baseline) |
| Modèle probabilités | NBA — Elo séquentiel + avantage terrain | Fait — backtest OK sur saison synthétique (bat le baseline) |
| Comparateur value bet | Cotes marché → dé-vigage → edge vs modèle | Fait — testé |
| Bankroll tracker | Kelly fractionné (1/4 par défaut) + plafond + stop-loss | Fait — testé |
| Panneau admin | Next.js + Supabase | Reporté après validation sur données réelles |

Note : les backtests unitaires tournent sur des ligues **synthétiques**
(forces d'équipes connues, générées par le test) — ça valide que le pipeline
calcule bien ce qu'il est censé calculer, pas qu'il bat le marché réel.

## Backtests sur données réelles (2026-07-26)

| Compétition | Saison | Log-loss modèle | Log-loss baseline | Accuracy modèle | Accuracy baseline | Bat le baseline |
|---|---|---|---|---|---|---|
| Premier League (PL) | 2023-24 | 0.914 | 1.048 | 56.6% | 44.7% | Oui, marge nette |
| Serie A (SA) | 2023-24 | 1.121 | 1.127 | 43.4% | 32.9% | Oui, marge faible |

Lecture honnête de ces chiffres : le modèle apporte un edge réel mais
**modeste et variable selon la ligue** — exactement ce qui était attendu
(voir l'avertissement sur le 98% en tête de ce document). Serie A montre un
edge de log-loss quasi nul : pas encore de quoi comparer aux cotes du
marché sur cette ligue avec confiance. Premier League est plus prometteur.

Backtest NBA sur données réelles **bloqué** dans cet environnement
d'exécution : `stats.nba.com` ne répond pas depuis cette machine/IP
(protection anti-bot, voir docs/ERRORS.md). Le modèle Elo reste validé sur
données synthétiques ; à relancer (`engine/scripts/run_nba_backtest.py`)
depuis un réseau non bloqué avant de faire confiance aux chiffres NBA réels.

Limite connue : le tier gratuit football-data.org restreint l'accès aux
saisons anciennes (saison courante seulement par compétition) — pas encore
de backtest multi-saisons possible sans upgrade du plan API.

## Choix techniques

- **Python** pour tout le moteur de données/modèle : pandas, scikit-learn,
  statsmodels (Poisson), pas de dépendance lourde inutile.
- **Sources de données** : APIs officielles gratuites en priorité
  (football-data.org, nba_api) plutôt que scraping HTML, pour la stabilité
  et pour rester dans les CGU des sources.
- **Pas de "langage difficile à décrypter"** : la sécurité vient des pratiques
  (secrets, RLS, audit), pas de l'obscurité du code. Voir section Sécurité.
- **Admin panel** (Next.js/Supabase) : construit seulement après que le moteur
  de probabilités soit validé par backtest — pas de dashboard avant d'avoir
  quelque chose de fiable à afficher.

## Séquence de travail (agentic, avec relecture à chaque étape)

1. Environnement Python + dépendances + `.env` sécurisé
2. Ingestion football (résultats historiques + xG si disponible)
3. Modèle Poisson foot → validation par backtest sur saison(s) passée(s)
   → **relecture** : le modèle bat-il un baseline naïf (fréquences brutes) ?
4. Ingestion NBA + modèle NBA → même validation
5. Comparateur probabilités vs cotes → détection value bet
6. Bankroll tracker (Kelly fractionné, stop-loss configurable)
7. Décision : rendre public ou non, selon les résultats du backtest
8. Si public : panneau admin, auth, RLS, tests d'intrusion

Chaque étape est backtestée avant de passer à la suivante — pas d'ajout de
fonctionnalité tant que l'étape précédente n'est pas validée par les chiffres.

## Sécurité

- `SUPABASE_SERVICE_ROLE_KEY` et toute clé API : jamais dans le code, jamais
  commitées — uniquement via variables d'environnement (`.env`, ignoré par
  git) ou un secret manager le jour où c'est hébergé.
- RLS activée sur toutes les tables Supabase dès leur création.
- MFA obligatoire sur tout accès admin si/quand le produit devient public.
- Logs d'audit sur les actions sensibles (modif bankroll, modif modèle).
- Dépendances auditées régulièrement (`pip-audit`, `npm audit`).
- Avant toute mise en public : test d'intrusion externe.

## Non-objectifs (pour l'instant)

- Pas d'automatisation de mise de paris (pas de pari placé automatiquement)
- Pas de scraping de sites de bookmakers tant qu'une API gratuite couvre le
  besoin
- Pas de panneau admin/CMS tant que le moteur n'est pas validé
