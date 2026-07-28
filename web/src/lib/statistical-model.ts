/**
 * Engine Statistique SerenBet — Calculs rigoureux des distributions de Poisson
 * 
 * Modélisation probabiliste exacte pour le football :
 * - Loi de Poisson PMF : P(X = k) = (lambda^k * e^-lambda) / k!
 * - Loi de Poisson CDF : P(X <= k) = sum_{i=0}^k P(X = i)
 * - Somme de deux Poisson indépendantes : X ~ P(λ1), Y ~ P(λ2) => X+Y ~ P(λ1 + λ2)
 * 
 * Permet d'obtenir les probabilités exactes pour la panoplie complète de marchés :
 * Buts, Corners, Cartons jaunes, Fautes, Tirs & Tirs cadrés, Hors-jeu.
 */

export function factorial(n: number): number {
  if (n <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

export function poissonPMF(k: number, lambda: number): number {
  if (lambda <= 0 || k < 0) return 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

export function poissonCDF(k: number, lambda: number): number {
  let sum = 0;
  for (let i = 0; i <= k; i++) {
    sum += poissonPMF(i, lambda);
  }
  return Math.min(Math.max(sum, 0), 1);
}

export function probOver(line: number, lambda: number): number {
  const k = Math.floor(line);
  return Math.min(Math.max(1 - poissonCDF(k, lambda), 0), 1);
}

export function probUnder(line: number, lambda: number): number {
  const k = Math.floor(line);
  return Math.min(Math.max(poissonCDF(k, lambda), 0), 1);
}

export function probBTTS(lambdaHome: number, lambdaAway: number): number {
  const pHomeScoring = 1 - Math.exp(-lambdaHome);
  const pAwayScoring = 1 - Math.exp(-lambdaAway);
  return pHomeScoring * pAwayScoring;
}

export type StatMarketItem = {
  marketName: string;
  category: "goals" | "corners" | "cards" | "fouls" | "shots" | "offsides";
  selection: string;
  line?: number;
  expectedValue: number; // lambda
  modelProb: number;
  fairOdds: number; // 1 / modelProb
};

export type FullMatchMarkets = {
  goals: StatMarketItem[];
  corners: StatMarketItem[];
  cards: StatMarketItem[];
  fouls: StatMarketItem[];
  shots: StatMarketItem[];
  offsides: StatMarketItem[];
};

export function computeFullMarketPanoply(rates: {
  lambda_goals_home: number;
  lambda_goals_away: number;
  lambda_corners_home: number;
  lambda_corners_away: number;
  lambda_cards_home: number;
  lambda_cards_away: number;
  lambda_fouls_home: number;
  lambda_fouls_away: number;
  lambda_shots_home: number;
  lambda_shots_away: number;
  lambda_sot_home: number;
  lambda_sot_away: number;
  lambda_offsides_home: number;
  lambda_offsides_away: number;
}): FullMatchMarkets {
  // 1. BUTS
  const totalGoals = rates.lambda_goals_home + rates.lambda_goals_away;
  const goals: StatMarketItem[] = [
    {
      marketName: "Total Buts",
      category: "goals",
      selection: "Plus de 1.5 Buts",
      line: 1.5,
      expectedValue: totalGoals,
      modelProb: probOver(1.5, totalGoals),
      fairOdds: 1 / probOver(1.5, totalGoals),
    },
    {
      marketName: "Total Buts",
      category: "goals",
      selection: "Plus de 2.5 Buts",
      line: 2.5,
      expectedValue: totalGoals,
      modelProb: probOver(2.5, totalGoals),
      fairOdds: 1 / probOver(2.5, totalGoals),
    },
    {
      marketName: "Total Buts",
      category: "goals",
      selection: "Moins de 2.5 Buts",
      line: 2.5,
      expectedValue: totalGoals,
      modelProb: probUnder(2.5, totalGoals),
      fairOdds: 1 / probUnder(2.5, totalGoals),
    },
    {
      marketName: "Total Buts",
      category: "goals",
      selection: "Plus de 3.5 Buts",
      line: 3.5,
      expectedValue: totalGoals,
      modelProb: probOver(3.5, totalGoals),
      fairOdds: 1 / probOver(3.5, totalGoals),
    },
    {
      marketName: "Les deux équipes marquent",
      category: "goals",
      selection: "Oui (BTTS)",
      expectedValue: totalGoals,
      modelProb: probBTTS(rates.lambda_goals_home, rates.lambda_goals_away),
      fairOdds: 1 / probBTTS(rates.lambda_goals_home, rates.lambda_goals_away),
    },
    {
      marketName: "Buts Domicile",
      category: "goals",
      selection: "Domicile +1.5 Buts",
      line: 1.5,
      expectedValue: rates.lambda_goals_home,
      modelProb: probOver(1.5, rates.lambda_goals_home),
      fairOdds: 1 / probOver(1.5, rates.lambda_goals_home),
    },
    {
      marketName: "Buts Extérieur",
      category: "goals",
      selection: "Extérieur +1.5 Buts",
      line: 1.5,
      expectedValue: rates.lambda_goals_away,
      modelProb: probOver(1.5, rates.lambda_goals_away),
      fairOdds: 1 / probOver(1.5, rates.lambda_goals_away),
    },
  ];

  // 2. CORNERS
  const totalCorners = rates.lambda_corners_home + rates.lambda_corners_away;
  const corners: StatMarketItem[] = [
    {
      marketName: "Total Corners",
      category: "corners",
      selection: "Plus de 8.5 Corners",
      line: 8.5,
      expectedValue: totalCorners,
      modelProb: probOver(8.5, totalCorners),
      fairOdds: 1 / probOver(8.5, totalCorners),
    },
    {
      marketName: "Total Corners",
      category: "corners",
      selection: "Plus de 9.5 Corners",
      line: 9.5,
      expectedValue: totalCorners,
      modelProb: probOver(9.5, totalCorners),
      fairOdds: 1 / probOver(9.5, totalCorners),
    },
    {
      marketName: "Total Corners",
      category: "corners",
      selection: "Plus de 10.5 Corners",
      line: 10.5,
      expectedValue: totalCorners,
      modelProb: probOver(10.5, totalCorners),
      fairOdds: 1 / probOver(10.5, totalCorners),
    },
    {
      marketName: "Corners Domicile",
      category: "corners",
      selection: "Domicile +4.5 Corners",
      line: 4.5,
      expectedValue: rates.lambda_corners_home,
      modelProb: probOver(4.5, rates.lambda_corners_home),
      fairOdds: 1 / probOver(4.5, rates.lambda_corners_home),
    },
    {
      marketName: "Corners Extérieur",
      category: "corners",
      selection: "Extérieur +4.5 Corners",
      line: 4.5,
      expectedValue: rates.lambda_corners_away,
      modelProb: probOver(4.5, rates.lambda_corners_away),
      fairOdds: 1 / probOver(4.5, rates.lambda_corners_away),
    },
  ];

  // 3. CARTONS JAUNES
  const totalCards = rates.lambda_cards_home + rates.lambda_cards_away;
  const cards: StatMarketItem[] = [
    {
      marketName: "Total Cartons Jaunes",
      category: "cards",
      selection: "Plus de 3.5 Cartons",
      line: 3.5,
      expectedValue: totalCards,
      modelProb: probOver(3.5, totalCards),
      fairOdds: 1 / probOver(3.5, totalCards),
    },
    {
      marketName: "Total Cartons Jaunes",
      category: "cards",
      selection: "Plus de 4.5 Cartons",
      line: 4.5,
      expectedValue: totalCards,
      modelProb: probOver(4.5, totalCards),
      fairOdds: 1 / probOver(4.5, totalCards),
    },
    {
      marketName: "Cartons Domicile",
      category: "cards",
      selection: "Domicile +1.5 Cartons",
      line: 1.5,
      expectedValue: rates.lambda_cards_home,
      modelProb: probOver(1.5, rates.lambda_cards_home),
      fairOdds: 1 / probOver(1.5, rates.lambda_cards_home),
    },
    {
      marketName: "Cartons Extérieur",
      category: "cards",
      selection: "Extérieur +1.5 Cartons",
      line: 1.5,
      expectedValue: rates.lambda_cards_away,
      modelProb: probOver(1.5, rates.lambda_cards_away),
      fairOdds: 1 / probOver(1.5, rates.lambda_cards_away),
    },
  ];

  // 4. FAUTES
  const totalFouls = rates.lambda_fouls_home + rates.lambda_fouls_away;
  const fouls: StatMarketItem[] = [
    {
      marketName: "Total Fautes",
      category: "fouls",
      selection: "Plus de 21.5 Fautes",
      line: 21.5,
      expectedValue: totalFouls,
      modelProb: probOver(21.5, totalFouls),
      fairOdds: 1 / probOver(21.5, totalFouls),
    },
    {
      marketName: "Total Fautes",
      category: "fouls",
      selection: "Plus de 23.5 Fautes",
      line: 23.5,
      expectedValue: totalFouls,
      modelProb: probOver(23.5, totalFouls),
      fairOdds: 1 / probOver(23.5, totalFouls),
    },
    {
      marketName: "Fautes Domicile",
      category: "fouls",
      selection: "Domicile +11.5 Fautes",
      line: 11.5,
      expectedValue: rates.lambda_fouls_home,
      modelProb: probOver(11.5, rates.lambda_fouls_home),
      fairOdds: 1 / probOver(11.5, rates.lambda_fouls_home),
    },
    {
      marketName: "Fautes Extérieur",
      category: "fouls",
      selection: "Extérieur +11.5 Fautes",
      line: 11.5,
      expectedValue: rates.lambda_fouls_away,
      modelProb: probOver(11.5, rates.lambda_fouls_away),
      fairOdds: 1 / probOver(11.5, rates.lambda_fouls_away),
    },
  ];

  // 5. TIRS & TIRS CADRÉS
  const totalShots = rates.lambda_shots_home + rates.lambda_shots_away;
  const totalSOT = rates.lambda_sot_home + rates.lambda_sot_away;
  const shots: StatMarketItem[] = [
    {
      marketName: "Total Tirs du Match",
      category: "shots",
      selection: "Plus de 23.5 Tirs",
      line: 23.5,
      expectedValue: totalShots,
      modelProb: probOver(23.5, totalShots),
      fairOdds: 1 / probOver(23.5, totalShots),
    },
    {
      marketName: "Total Tirs du Match",
      category: "shots",
      selection: "Plus de 25.5 Tirs",
      line: 25.5,
      expectedValue: totalShots,
      modelProb: probOver(25.5, totalShots),
      fairOdds: 1 / probOver(25.5, totalShots),
    },
    {
      marketName: "Total Tirs Cadrés",
      category: "shots",
      selection: "Plus de 8.5 Tirs Cadrés",
      line: 8.5,
      expectedValue: totalSOT,
      modelProb: probOver(8.5, totalSOT),
      fairOdds: 1 / probOver(8.5, totalSOT),
    },
    {
      marketName: "Tirs Cadrés Domicile",
      category: "shots",
      selection: "Domicile +4.5 Tirs Cadrés",
      line: 4.5,
      expectedValue: rates.lambda_sot_home,
      modelProb: probOver(4.5, rates.lambda_sot_home),
      fairOdds: 1 / probOver(4.5, rates.lambda_sot_home),
    },
  ];

  // 6. HORS-JEU
  const totalOffsides = rates.lambda_offsides_home + rates.lambda_offsides_away;
  const offsides: StatMarketItem[] = [
    {
      marketName: "Total Hors-jeu",
      category: "offsides",
      selection: "Plus de 3.5 Hors-jeu",
      line: 3.5,
      expectedValue: totalOffsides,
      modelProb: probOver(3.5, totalOffsides),
      fairOdds: 1 / probOver(3.5, totalOffsides),
    },
    {
      marketName: "Hors-jeu Domicile",
      category: "offsides",
      selection: "Domicile +1.5 Hors-jeu",
      line: 1.5,
      expectedValue: rates.lambda_offsides_home,
      modelProb: probOver(1.5, rates.lambda_offsides_home),
      fairOdds: 1 / probOver(1.5, rates.lambda_offsides_home),
    },
    {
      marketName: "Hors-jeu Extérieur",
      category: "offsides",
      selection: "Extérieur +1.5 Hors-jeu",
      line: 1.5,
      expectedValue: rates.lambda_offsides_away,
      modelProb: probOver(1.5, rates.lambda_offsides_away),
      fairOdds: 1 / probOver(1.5, rates.lambda_offsides_away),
    },
  ];

  return { goals, corners, cards, fouls, shots, offsides };
}
