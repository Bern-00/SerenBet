/**
 * Route API : Prochains matchs réels via The Odds API Multi-Marchés
 *
 * Source : The Odds API (ODDS_API_KEY) — cotes réelles des bookmakers européens
 * Marchés réels extraits :
 * - h2h (1X2 Vainqueur)
 * - totals & alternate_totals (Over/Under Buts : 0.5, 1.5, 2.5, 3.5, 4.5)
 * - btts (Les deux équipes marquent : Oui / Non)
 * - double_chance (1X, X2, 12)
 * - draw_no_bet (DNB Domicile / DNB Extérieur)
 * - spreads (Handicap asiatique)
 */

import { NextResponse } from "next/server";

const ODDS_API_KEY = process.env.ODDS_API_KEY;

const SPORTS_CONFIG = [
  { key: "soccer_epl",                    name: "Premier League",    country: "England",  flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { key: "soccer_spain_la_liga",          name: "La Liga",           country: "Spain",    flag: "🇪🇸" },
  { key: "soccer_germany_bundesliga",     name: "Bundesliga",        country: "Germany",  flag: "🇩🇪" },
  { key: "soccer_italy_serie_a",         name: "Serie A",           country: "Italy",    flag: "🇮🇹" },
  { key: "soccer_france_ligue_1",        name: "Ligue 1",           country: "France",   flag: "🇫🇷" },
  { key: "soccer_uefa_champs_league",    name: "Champions League",  country: "Europe",   flag: "⭐" },
  { key: "soccer_uefa_europa_league",    name: "Europa League",     country: "Europe",   flag: "🟠" },
  { key: "soccer_portugal_primeira_liga",name: "Liga Portugal",     country: "Portugal", flag: "🇵🇹" },
  { key: "soccer_netherlands_eredivisie",name: "Eredivisie",        country: "Netherlands", flag: "🇳🇱" },
];

const LEAGUE_STAT_AVERAGES: Record<string, {
  goals_home: number; goals_away: number;
  corners_home: number; corners_away: number;
  cards_home: number; cards_away: number;
  fouls_home: number; fouls_away: number;
  shots_home: number; shots_away: number;
  sot_home: number; sot_away: number;
  offsides_home: number; offsides_away: number;
}> = {
  "Premier League":   { goals_home: 1.53, goals_away: 1.15, corners_home: 5.6,  corners_away: 4.3,  cards_home: 1.8,  cards_away: 2.1,  fouls_home: 10.6, fouls_away: 11.4, shots_home: 13.5, shots_away: 10.2, sot_home: 4.8, sot_away: 3.5, offsides_home: 1.8, offsides_away: 1.6 },
  "La Liga":          { goals_home: 1.62, goals_away: 1.11, corners_home: 5.8,  corners_away: 4.1,  cards_home: 2.4,  cards_away: 2.8,  fouls_home: 12.1, fouls_away: 13.2, shots_home: 14.1, shots_away: 9.8,  sot_home: 5.0, sot_away: 3.4, offsides_home: 2.0, offsides_away: 1.7 },
  "Bundesliga":       { goals_home: 1.72, goals_away: 1.32, corners_home: 5.4,  corners_away: 4.4,  cards_home: 1.9,  cards_away: 2.2,  fouls_home: 10.2, fouls_away: 11.0, shots_home: 14.8, shots_away: 11.3, sot_home: 5.2, sot_away: 3.9, offsides_home: 1.9, offsides_away: 1.8 },
  "Serie A":          { goals_home: 1.45, goals_away: 1.05, corners_home: 5.2,  corners_away: 4.0,  cards_home: 2.6,  cards_away: 2.9,  fouls_home: 13.5, fouls_away: 14.1, shots_home: 12.8, shots_away: 9.5,  sot_home: 4.4, sot_away: 3.2, offsides_home: 1.7, offsides_away: 1.5 },
  "Ligue 1":          { goals_home: 1.55, goals_away: 1.10, corners_home: 5.3,  corners_away: 4.2,  cards_home: 2.8,  cards_away: 3.1,  fouls_home: 13.8, fouls_away: 14.8, shots_home: 13.2, shots_away: 9.9,  sot_home: 4.6, sot_away: 3.4, offsides_home: 1.9, offsides_away: 1.6 },
  "Champions League": { goals_home: 1.80, goals_away: 1.25, corners_home: 6.0,  corners_away: 4.6,  cards_home: 1.7,  cards_away: 2.0,  fouls_home: 10.5, fouls_away: 11.5, shots_home: 14.5, shots_away: 10.8, sot_home: 5.1, sot_away: 3.8, offsides_home: 2.1, offsides_away: 1.8 },
  "default":          { goals_home: 1.55, goals_away: 1.10, corners_home: 5.4,  corners_away: 4.2,  cards_home: 2.1,  cards_away: 2.4,  fouls_home: 11.5, fouls_away: 12.5, shots_home: 13.5, shots_away: 10.0, sot_home: 4.8, sot_away: 3.5, offsides_home: 1.9, offsides_away: 1.6 },
};

function getStatRates(league: string) {
  return LEAGUE_STAT_AVERAGES[league] ?? LEAGUE_STAT_AVERAGES["default"];
}

function poissonProbs(lambdaHome: number, lambdaAway: number) {
  const MAX = 9;
  const fact = (n: number): number => n <= 1 ? 1 : n * fact(n - 1);
  const pmf = (k: number, l: number) => (Math.pow(l, k) * Math.exp(-l)) / fact(k);
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
  return { home: pHome / total, draw: pDraw / total, away: pAway / total };
}

export type RealMarketOddsItem = {
  category: "1X2" | "totals" | "btts" | "double_chance" | "draw_no_bet" | "handicap";
  selection: string;
  label: string;
  odds: number;
  bookmaker: string;
  line?: number;
  raw_outcome?: string;
};

export async function GET() {
  if (!ODDS_API_KEY) {
    return NextResponse.json({
      error: "ODDS_API_KEY manquante dans les variables d'environnement Vercel",
      matches: [],
      is_demo: true,
    }, { status: 500 });
  }

  // 1. Fetch des cotes principales (h2h, totals, spreads) sur tous les championnats
  const results = await Promise.allSettled(
    SPORTS_CONFIG.map(({ key, name, flag }) =>
      fetch(
        `https://api.the-odds-api.com/v4/sports/${key}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h,totals,spreads&oddsFormat=decimal`,
        { next: { revalidate: 1800 } }
      )
        .then(r => r.ok ? r.json() : [])
        .then(events => ({ events: Array.isArray(events) ? events : [], league: name, flag, sportKey: key }))
        .catch(() => ({ events: [], league: name, flag, sportKey: key }))
    )
  );

  const rawEventsList: Array<{ event: any; league: string; flag: string; sportKey: string }> = [];

  for (const res of results) {
    if (res.status !== "fulfilled") continue;
    const { events, league, flag, sportKey } = res.value;
    for (const ev of events) {
      if (ev.bookmakers?.length) {
        rawEventsList.push({ event: ev, league, flag, sportKey });
      }
    }
  }

  // 2. Pour les 15 premiers matchs, fetch en parallèle les marchés avancés (btts, alternate_totals, double_chance, draw_no_bet)
  const topEvents = rawEventsList.slice(0, 15);
  const additionalOddsMap = new Map<string, any>();

  await Promise.allSettled(
    topEvents.map(({ event, sportKey }) =>
      fetch(
        `https://api.the-odds-api.com/v4/sports/${sportKey}/events/${event.id}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=btts,alternate_totals,double_chance,draw_no_bet&oddsFormat=decimal`,
        { next: { revalidate: 1800 } }
      )
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.bookmakers) additionalOddsMap.set(event.id, data.bookmakers);
        })
        .catch(() => {})
    )
  );

  const matches: object[] = [];

  for (const { event, league, flag } of rawEventsList) {
    let bestHome = 0, bestDraw = 0, bestAway = 0, bestBk = "";
    const realMarkets: RealMarketOddsItem[] = [];

    // Extraction h2h
    for (const bk of event.bookmakers) {
      const h2h = bk.markets?.find((m: { key: string }) => m.key === "h2h");
      if (!h2h?.outcomes?.length) continue;
      const prices: Record<string, number> = {};
      for (const o of h2h.outcomes) prices[o.name] = o.price;
      const h = prices[event.home_team] ?? 0;
      const a = prices[event.away_team] ?? 0;
      const d = prices["Draw"] ?? 0;
      if (h > bestHome) { bestHome = h; bestBk = bk.key; }
      if (a > bestAway) bestAway = a;
      if (d > bestDraw) bestDraw = d;
    }

    if (!bestHome || !bestAway) continue;

    // Ajouter 1X2 réels
    realMarkets.push(
      { category: "1X2", selection: "home", label: `${event.home_team} gagne`, odds: bestHome, bookmaker: bestBk },
      { category: "1X2", selection: "away", label: `${event.away_team} gagne`, odds: bestAway, bookmaker: bestBk }
    );
    if (bestDraw > 1) {
      realMarkets.push({ category: "1X2", selection: "draw", label: "Match nul", odds: bestDraw, bookmaker: bestBk });
    }

    // Extraction totals & spreads principaux
    for (const bk of event.bookmakers) {
      for (const m of bk.markets ?? []) {
        if (m.key === "totals") {
          for (const o of m.outcomes ?? []) {
            if (o.price >= 1.30 && o.price <= 4.50) {
              const label = o.name === "Over" ? `Plus de ${o.point} Buts` : `Moins de ${o.point} Buts`;
              realMarkets.push({ category: "totals", selection: `${o.name} ${o.point}`, label, odds: o.price, bookmaker: bk.key, line: o.point, raw_outcome: o.name });
            }
          }
        } else if (m.key === "spreads") {
          for (const o of m.outcomes ?? []) {
            if (o.price >= 1.30 && o.price <= 4.50) {
              const ptStr = o.point > 0 ? `+${o.point}` : `${o.point}`;
              const label = `Handicap ${o.name} (${ptStr})`;
              realMarkets.push({ category: "handicap", selection: `${o.name} ${ptStr}`, label, odds: o.price, bookmaker: bk.key, line: o.point, raw_outcome: o.name });
            }
          }
        }
      }
    }

    // Extraction marchés avancés (event-level)
    const extraBks = additionalOddsMap.get(event.id);
    if (extraBks) {
      for (const bk of extraBks) {
        for (const m of bk.markets ?? []) {
          if (m.key === "btts") {
            for (const o of m.outcomes ?? []) {
              if (o.price >= 1.30 && o.price <= 4.50) {
                const label = o.name === "Yes" ? "Les deux équipes marquent : Oui" : "Les deux équipes marquent : Non";
                realMarkets.push({ category: "btts", selection: o.name === "Yes" ? "BTTS Oui" : "BTTS Non", label, odds: o.price, bookmaker: bk.key, raw_outcome: o.name });
              }
            }
          } else if (m.key === "double_chance") {
            for (const o of m.outcomes ?? []) {
              if (o.price >= 1.20 && o.price <= 4.50) {
                realMarkets.push({ category: "double_chance", selection: `Double Chance ${o.name}`, label: `Double Chance ${o.name}`, odds: o.price, bookmaker: bk.key, raw_outcome: o.name });
              }
            }
          } else if (m.key === "draw_no_bet") {
            for (const o of m.outcomes ?? []) {
              if (o.price >= 1.25 && o.price <= 4.50) {
                realMarkets.push({ category: "draw_no_bet", selection: `DNB ${o.name}`, label: `Remboursé si nul : ${o.name}`, odds: o.price, bookmaker: bk.key, raw_outcome: o.name });
              }
            }
          } else if (m.key === "alternate_totals") {
            for (const o of m.outcomes ?? []) {
              if (o.price >= 1.30 && o.price <= 4.50) {
                const label = o.name === "Over" ? `Plus de ${o.point} Buts` : `Moins de ${o.point} Buts`;
                realMarkets.push({ category: "totals", selection: `${o.name} ${o.point}`, label, odds: o.price, bookmaker: bk.key, line: o.point, raw_outcome: o.name });
              }
            }
          }
        }
      }
    }

    const stats = getStatRates(league);
    const modelProbs = poissonProbs(stats.goals_home, stats.goals_away);

    const implHome = 1 / bestHome;
    const implDraw = bestDraw > 1 ? 1 / bestDraw : 0;
    const implAway = 1 / bestAway;

    const edgeHome = modelProbs.home - implHome;
    const edgeDraw = modelProbs.draw - implDraw;
    const edgeAway = modelProbs.away - implAway;

    const evHome = modelProbs.home * bestHome - 1;
    const evDraw = modelProbs.draw * bestDraw - 1;
    const evAway = modelProbs.away * bestAway - 1;

    const candidates = [
      { outcome: "home" as const, edge: edgeHome, ev: evHome, odd: bestHome, prob: modelProbs.home },
      { outcome: "draw" as const, edge: edgeDraw, ev: evDraw, odd: bestDraw, prob: modelProbs.draw },
      { outcome: "away" as const, edge: edgeAway, ev: evAway, odd: bestAway, prob: modelProbs.away },
    ].filter(c =>
      c.odd >= 1.30 &&
      c.odd <= 4.50 &&
      c.prob >= 0.22 &&
      c.ev >= 0.02 &&
      c.ev <= 0.25
    );

    candidates.sort((a, b) => b.ev - a.ev);
    const best = candidates[0] ?? null;

    matches.push({
      id: `odds-${event.id}`,
      sport: "football",
      competition: league,
      competition_flag: flag,
      home_team: event.home_team,
      away_team: event.away_team,
      commence_time: event.commence_time,
      status: new Date(event.commence_time) > new Date() ? "Scheduled" : "Live",
      model_probs: modelProbs,
      market_odds: { home: bestHome, draw: bestDraw, away: bestAway },
      real_markets: realMarkets,
      best_bookmaker: bestBk,
      best_outcome: best?.outcome ?? null,
      best_edge: best ? parseFloat((best.edge * 100).toFixed(1)) : null,
      best_ev: best ? parseFloat(best.ev.toFixed(4)) : null,
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
    });
  }

  matches.sort((a: any, b: any) =>
    new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()
  );

  return NextResponse.json({
    source: "The Odds API (cotes réelles multi-marchés bookmakers européens)",
    total_matches: matches.length,
    matches,
    is_demo: false,
    fetched_at: new Date().toISOString(),
  });
}
