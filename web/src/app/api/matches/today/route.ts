/**
 * Route API : Matchs du jour en temps réel via SofaScore RapidAPI
 * + cotes réelles via The Odds API
 *
 * Source 1 : SofaScore via RapidAPI (SOFASCORE_RAPIDAPI_KEY)
 *   - Endpoint : /api/v1/sport/football/scheduled-events/{date}
 *   - Filtrage : uniquement les Big Leagues (PL, La Liga, Bundesliga, Serie A, Ligue 1, UCL)
 *
 * Source 2 : The Odds API (ODDS_API_KEY)
 *   - Endpoint : /v4/sports/{sport}/odds
 *   - Cotes réelles h2h des bookmakers européens
 *
 * Les statistiques (corners, cartons, tirs, fautes, hors-jeu) sont estimées
 * par notre modèle Poisson interne à partir des moyennes de la ligue.
 */

import { NextResponse } from "next/server";

const SOFASCORE_KEY = process.env.SOFASCORE_RAPIDAPI_KEY;
const SOFASCORE_HOST = process.env.SOFASCORE_RAPIDAPI_HOST ?? "sofascore.p.rapidapi.com";
const ODDS_API_KEY = process.env.ODDS_API_KEY;

// Big Leagues filtrées — uniquement les tournois de référence
const BIG_LEAGUE_TOURNAMENT_IDS = new Set([
  17,    // Premier League
  8,     // Champions League
  7,     // La Liga
  35,    // Bundesliga
  23,    // Serie A
  34,    // Ligue 1
  679,   // Europa League
  18,    // FA Cup
  52,    // Coupe du monde des clubs
  77,    // Liga Portugal
  37,    // Eredivisie
]);

const BIG_LEAGUE_NAMES: Record<number, string> = {
  17: "Premier League",
  8: "Champions League",
  7: "La Liga",
  35: "Bundesliga",
  23: "Serie A",
  34: "Ligue 1",
  679: "Europa League",
  18: "FA Cup",
  52: "Coupe du Monde des Clubs",
  77: "Liga Portugal",
  37: "Eredivisie",
};

// Odds API sport keys pour les Big Leagues
const ODDS_API_SPORT_KEYS = [
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_germany_bundesliga",
  "soccer_italy_serie_a",
  "soccer_france_ligue_1",
  "soccer_uefa_champs_league",
  "soccer_uefa_europa_league",
  "soccer_portugal_primeira_liga",
  "soccer_netherlands_eredivisie",
];

// Lambda moyennes par ligue pour les stats secondaires (Poisson-based)
// Source : analyses statistiques publiques saison 2023-24
const LEAGUE_STAT_AVERAGES: Record<string, {
  goals_home: number; goals_away: number;
  corners_home: number; corners_away: number;
  cards_home: number; cards_away: number;
  fouls_home: number; fouls_away: number;
  shots_home: number; shots_away: number;
  sot_home: number; sot_away: number;
  offsides_home: number; offsides_away: number;
}> = {
  "Premier League":    { goals_home: 1.53, goals_away: 1.15, corners_home: 5.6,  corners_away: 4.3,  cards_home: 1.8,  cards_away: 2.1,  fouls_home: 10.6, fouls_away: 11.4, shots_home: 13.5, shots_away: 10.2, sot_home: 4.8,  sot_away: 3.5,  offsides_home: 1.8, offsides_away: 1.6 },
  "La Liga":           { goals_home: 1.62, goals_away: 1.11, corners_home: 5.8,  corners_away: 4.1,  cards_home: 2.4,  cards_away: 2.8,  fouls_home: 12.1, fouls_away: 13.2, shots_home: 14.1, shots_away: 9.8,  sot_home: 5.0,  sot_away: 3.4,  offsides_home: 2.0, offsides_away: 1.7 },
  "Bundesliga":        { goals_home: 1.72, goals_away: 1.32, corners_home: 5.4,  corners_away: 4.4,  cards_home: 1.9,  cards_away: 2.2,  fouls_home: 10.2, fouls_away: 11.0, shots_home: 14.8, shots_away: 11.3, sot_home: 5.2,  sot_away: 3.9,  offsides_home: 1.9, offsides_away: 1.8 },
  "Serie A":           { goals_home: 1.45, goals_away: 1.05, corners_home: 5.2,  corners_away: 4.0,  cards_home: 2.6,  cards_away: 2.9,  fouls_home: 13.5, fouls_away: 14.1, shots_home: 12.8, shots_away: 9.5,  sot_home: 4.4,  sot_away: 3.2,  offsides_home: 1.7, offsides_away: 1.5 },
  "Ligue 1":           { goals_home: 1.55, goals_away: 1.10, corners_home: 5.3,  corners_away: 4.2,  cards_home: 2.8,  cards_away: 3.1,  fouls_home: 13.8, fouls_away: 14.8, shots_home: 13.2, shots_away: 9.9,  sot_home: 4.6,  sot_away: 3.4,  offsides_home: 1.9, offsides_away: 1.6 },
  "Champions League":  { goals_home: 1.80, goals_away: 1.25, corners_home: 6.0,  corners_away: 4.6,  cards_home: 1.7,  cards_away: 2.0,  fouls_home: 10.5, fouls_away: 11.5, shots_home: 14.5, shots_away: 10.8, sot_home: 5.1,  sot_away: 3.8,  offsides_home: 2.1, offsides_away: 1.8 },
  "default":           { goals_home: 1.55, goals_away: 1.10, corners_home: 5.4,  corners_away: 4.2,  cards_home: 2.1,  cards_away: 2.4,  fouls_home: 11.5, fouls_away: 12.5, shots_home: 13.5, shots_away: 10.0, sot_home: 4.8,  sot_away: 3.5,  offsides_home: 1.9, offsides_away: 1.6 },
};

function getStatRates(league: string) {
  return LEAGUE_STAT_AVERAGES[league] ?? LEAGUE_STAT_AVERAGES["default"];
}

function poissonProbs(lambdaHome: number, lambdaAway: number) {
  // Distribution de Poisson tronquée à MAX_GOALS=9
  const MAX = 9;
  const pmf = (k: number, l: number) =>
    (Math.pow(l, k) * Math.exp(-l)) / Array.from({ length: k + 1 }, (_, i) => i || 1).reduce((a, b) => a * b);

  let pHome = 0, pDraw = 0, pAway = 0;
  for (let i = 0; i <= MAX; i++) {
    for (let j = 0; j <= MAX; j++) {
      const p = pmf(i, lambdaHome) * pmf(j, lambdaAway);
      if (i > j) pHome += p;
      else if (i === j) pDraw += p;
      else pAway += p;
    }
  }
  const total = pHome + pDraw + pAway;
  return {
    home: pHome / total,
    draw: pDraw / total,
    away: pAway / total,
  };
}

type OddsRow = {
  home: number;
  draw: number;
  away: number;
  bookmaker: string;
};

async function fetchOddsAPI(): Promise<Map<string, OddsRow>> {
  const oddsMap = new Map<string, OddsRow>();
  if (!ODDS_API_KEY) return oddsMap;

  try {
    // Fetch tous les sports en parallèle
    const results = await Promise.allSettled(
      ODDS_API_SPORT_KEYS.map((sportKey) =>
        fetch(
          `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`,
          { next: { revalidate: 3600 } } // cache 1h
        ).then((r) => (r.ok ? r.json() : []))
      )
    );

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const events = Array.isArray(result.value) ? result.value : [];
      for (const event of events) {
        if (!event.bookmakers?.length) continue;
        const bk = event.bookmakers[0];
        const h2h = bk.markets?.find((m: { key: string }) => m.key === "h2h");
        if (!h2h?.outcomes?.length) continue;
        const prices: Record<string, number> = {};
        for (const o of h2h.outcomes) prices[o.name] = o.price;
        const home = prices[event.home_team];
        const away = prices[event.away_team];
        const draw = prices["Draw"];
        if (home && away) {
          // Clé de recherche normalisée
          const key = `${event.home_team.toLowerCase()}|${event.away_team.toLowerCase()}`;
          oddsMap.set(key, { home, draw: draw ?? 0, away, bookmaker: bk.key });
        }
      }
    }
  } catch {
    // silently fail — on continuera sans cotes de marché
  }

  return oddsMap;
}

async function fetchSofaScoreToday(dateStr: string) {
  if (!SOFASCORE_KEY) {
    return { events: [], error: "SOFASCORE_RAPIDAPI_KEY manquante dans .env.local" };
  }

  const url = `https://sofascore.p.rapidapi.com/api/v1/sport/football/scheduled-events/${dateStr}`;
  const resp = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": SOFASCORE_KEY,
      "X-RapidAPI-Host": SOFASCORE_HOST,
    },
    next: { revalidate: 1800 }, // cache 30 min
  });

  if (!resp.ok) {
    const text = await resp.text();
    return { events: [], error: `SofaScore API error ${resp.status}: ${text.slice(0, 200)}` };
  }

  const data = await resp.json();
  return { events: data.events ?? [], error: null };
}

export async function GET() {
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD

  // 1. Fetcher SofaScore pour les matchs du jour
  const { events, error: sofaError } = await fetchSofaScoreToday(dateStr);

  // 2. Fetcher cotes réelles (en parallèle)
  const oddsMap = await fetchOddsAPI();

  // 3. Filtrer uniquement les Big Leagues
  const bigLeagueEvents = events.filter((ev: Record<string, unknown>) => {
    const tournament = ev.tournament as Record<string, unknown> | undefined;
    if (!tournament) return false;
    const uniqueTournament = tournament.uniqueTournament as Record<string, unknown> | undefined;
    if (!uniqueTournament) return false;
    return BIG_LEAGUE_TOURNAMENT_IDS.has(uniqueTournament.id as number);
  });

  // 4. Construire les objets UpcomingMatch enrichis
  const matches = bigLeagueEvents.map((ev: Record<string, unknown>) => {
    const tournament = ev.tournament as Record<string, unknown>;
    const uniqueTournament = tournament.uniqueTournament as Record<string, unknown>;
    const leagueName = BIG_LEAGUE_NAMES[uniqueTournament.id as number] ?? String(tournament.name ?? "Football");

    const homeTeam = ev.homeTeam as Record<string, unknown>;
    const awayTeam = ev.awayTeam as Record<string, unknown>;
    const homeTeamName = String(homeTeam?.name ?? "");
    const awayTeamName = String(awayTeam?.name ?? "");

    const startTimestamp = ev.startTimestamp as number;
    const commence_time = new Date(startTimestamp * 1000).toISOString();

    // Chercher les cotes dans The Odds API
    const oddsKey = `${homeTeamName.toLowerCase()}|${awayTeamName.toLowerCase()}`;
    const marketOdds = oddsMap.get(oddsKey);

    // Stats ligues (moyennes Poisson)
    const stats = getStatRates(leagueName);
    const modelProbs = poissonProbs(stats.goals_home, stats.goals_away);

    // Calculer le best edge si on a des cotes
    let best_outcome: "home" | "draw" | "away" | null = null;
    let best_edge: number | null = null;
    let best_ev: number | null = null;

    if (marketOdds) {
      const outcomes: Array<["home" | "draw" | "away", number, number]> = [
        ["home", modelProbs.home, marketOdds.home],
        ["draw", modelProbs.draw, marketOdds.draw],
        ["away", modelProbs.away, marketOdds.away],
      ];
      for (const [outcome, modelP, mktOdd] of outcomes) {
        if (!mktOdd || mktOdd <= 1) continue;
        const impliedP = 1 / mktOdd;
        const edge = modelP - impliedP;
        const ev = modelP * mktOdd - 1;
        if (ev > 0.02 && (best_ev === null || ev > best_ev)) {
          best_outcome = outcome;
          best_edge = parseFloat((edge * 100).toFixed(1));
          best_ev = parseFloat(ev.toFixed(4));
        }
      }
    }

    return {
      id: `sofa-${ev.id}`,
      sofascore_id: ev.id,
      sport: "football",
      competition: leagueName,
      home_team: homeTeamName,
      away_team: awayTeamName,
      commence_time,
      status: (ev.status as Record<string, unknown>)?.description ?? "Scheduled",
      model_probs: modelProbs,
      market_odds: marketOdds
        ? { home: marketOdds.home, draw: marketOdds.draw, away: marketOdds.away }
        : null,
      best_bookmaker: marketOdds?.bookmaker ?? null,
      best_outcome,
      best_edge,
      best_ev,
      is_demo: false,
      stat_rates: {
        lambda_goals_home: stats.goals_home,
        lambda_goals_away: stats.goals_away,
        lambda_corners_home: stats.corners_home,
        lambda_corners_away: stats.corners_away,
        lambda_cards_home: stats.cards_home,
        lambda_cards_away: stats.cards_away,
        lambda_fouls_home: stats.fouls_home,
        lambda_fouls_away: stats.fouls_away,
        lambda_shots_home: stats.shots_home,
        lambda_shots_away: stats.shots_away,
        lambda_sot_home: stats.sot_home,
        lambda_sot_away: stats.sot_away,
        lambda_offsides_home: stats.offsides_home,
        lambda_offsides_away: stats.offsides_away,
      },
    };
  });

  return NextResponse.json({
    date: dateStr,
    source: "SofaScore (RapidAPI) + The Odds API",
    total_events_today: events.length,
    big_league_events: matches.length,
    matches,
    errors: sofaError ? [sofaError] : [],
    fetched_at: new Date().toISOString(),
  });
}
