# SerenBet

Outil personnel d'analyse sportive : calcul de probabilités à partir de données
historiques, comparaison avec les cotes du marché pour repérer des value bets,
et gestion de bankroll avec contrôle du risque.

**Ce que cet outil n'est pas** : il ne garantit aucun résultat. Aucune "garantie
98%" — les probabilités calculées sont des estimations statistiques, comparées
au marché pour trouver un edge de quelques points de pourcentage en moyenne.
Voir [docs/PLAN.md](docs/PLAN.md) pour le détail.

## Structure

```
SerenBet/
├── docs/
│   ├── PLAN.md          # Portée, choix techniques, statut par module
│   ├── TIMELINE.md       # Historique daté des sessions de travail
│   └── ERRORS.md         # Journal des erreurs rencontrées et corrections
├── engine/                # Moteur Python (data, modèles, backtest, bankroll)
│   ├── src/
│   │   ├── data/          # Ingestion football-data.org, nba_api
│   │   ├── models/        # Modèles de probabilité (Poisson, Elo, etc.)
│   │   ├── backtest/       # Validation sur données historiques
│   │   └── betting/       # Comparaison cotes vs proba, bankroll (Kelly)
│   ├── notebooks/         # Exploration Jupyter
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
└── README.md
```

## Démarrage

```bash
cd engine
python -m venv .venv
.venv\Scripts\activate       # Windows
pip install -r requirements.txt
cp .env.example .env          # puis remplir les clés API
```

## Sécurité

- Aucune clé API/secret n'est commitée : tout passe par `.env` (ignoré par git)
- `.env.example` documente les variables attendues sans valeurs réelles
- Voir [docs/PLAN.md](docs/PLAN.md#sécurité) pour les pratiques appliquées
