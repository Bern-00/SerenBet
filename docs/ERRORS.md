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
