"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui";
import { PickCard } from "@/components/pick-card";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { BettingPick, MarketCategory } from "@/lib/types";
import { DEMO_PICKS } from "@/lib/demo-data";
import {
  probOver,
  probUnder,
  probBTTS,
  probDoubleChance,
  probDrawNoBet,
  probHandicap,
  computeFullMarketPanoply,
} from "@/lib/statistical-model";

type RealMarketItem = {
  category: "1X2" | "totals" | "btts" | "double_chance" | "draw_no_bet" | "handicap";
  selection: string;
  label: string;
  odds: number;
  bookmaker: string;
  line?: number;
  raw_outcome?: string;
};

type LiveMatch = {
  id: string;
  sport: string;
  competition: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  status: string;
  model_probs: { home: number; draw: number; away: number };
  market_odds: { home: number; draw: number; away: number } | null;
  real_markets?: RealMarketItem[];
  best_bookmaker: string | null;
  best_outcome: "home" | "draw" | "away" | null;
  best_edge: number | null;
  best_ev: number | null;
  is_demo: false;
  stat_rates: {
    lambda_goals_home: number; lambda_goals_away: number;
    lambda_corners_home: number; lambda_corners_away: number;
    lambda_cards_home: number; lambda_cards_away: number;
    lambda_fouls_home: number; lambda_fouls_away: number;
    lambda_shots_home: number; lambda_shots_away: number;
    lambda_sot_home: number; lambda_sot_away: number;
    lambda_offsides_home: number; lambda_offsides_away: number;
  };
};

/**
 * Sélecteur d'événement optimal hybride pour Top Picks :
 * Scan des marchés réels bookmakers + modèle Poisson en fallback (Cartons, Tirs, Corners, Fautes).
 * Trie par probabilité de réussite (model_prob) pour garantir que le Top Pick est l'événement le plus probable.
 */
function selectBestPickForMatch(m: LiveMatch, bankroll: number): BettingPick | null {
  const lambdaHome = m.stat_rates?.lambda_goals_home ?? 1.55;
  const lambdaAway = m.stat_rates?.lambda_goals_away ?? 1.10;
  const totalGoalsLambda = lambdaHome + lambdaAway;
  const model1X2 = m.model_probs;

  const candidates: BettingPick[] = [];

  // 1. Scan marchés réels bookmakers
  if (m.real_markets && m.real_markets.length > 0) {
    for (const item of m.real_markets) {
      let modelProb = 0;

      if (item.category === "1X2") {
        if (item.selection === "home") modelProb = model1X2.home;
        else if (item.selection === "away") modelProb = model1X2.away;
        else if (item.selection === "draw") modelProb = model1X2.draw;
      } else if (item.category === "totals") {
        const line = item.line ?? 2.5;
        modelProb = (item.raw_outcome === "Over" || item.selection.startsWith("Over"))
          ? probOver(line, totalGoalsLambda)
          : probUnder(line, totalGoalsLambda);
      } else if (item.category === "btts") {
        const bttsProb = probBTTS(lambdaHome, lambdaAway);
        modelProb = (item.raw_outcome === "Yes" || item.selection.includes("Oui")) ? bttsProb : 1 - bttsProb;
      } else if (item.category === "double_chance") {
        const dc = probDoubleChance(model1X2);
        if (item.raw_outcome?.includes(m.home_team)) modelProb = dc.home_draw;
        else if (item.raw_outcome?.includes(m.away_team)) modelProb = dc.away_draw;
        else modelProb = dc.home_away;
      } else if (item.category === "draw_no_bet") {
        const dnb = probDrawNoBet(model1X2);
        modelProb = item.raw_outcome === m.home_team ? dnb.home : dnb.away;
      } else if (item.category === "handicap") {
        const line = item.line ?? 0;
        const hc = probHandicap(lambdaHome, lambdaAway, line);
        modelProb = item.raw_outcome === m.home_team ? hc.home : hc.away;
      }

      if (item.odds >= 1.25 && item.odds <= 4.50 && modelProb >= 0.22) {
        const implP = 1 / item.odds;
        const edge = modelProb - implP;
        const ev = modelProb * item.odds - 1;

        if (ev >= 0.02 && ev <= 0.30) {
          const kellyRaw = edge / (item.odds - 1);
          const kelly = Math.min(Math.max(kellyRaw * 0.25, 0), 0.03);

          candidates.push({
            id: `live-${m.id}-${item.category}-${item.selection}-${item.bookmaker}`,
            match_id: m.id,
            home_team: m.home_team,
            away_team: m.away_team,
            competition: m.competition,
            sport: m.sport,
            commence_time: m.commence_time,
            market_type: item.category as MarketCategory,
            outcome: item.selection,
            outcome_label: item.label,
            odds: item.odds,
            model_probability: modelProb,
            market_probability: implP,
            edge,
            expected_value: parseFloat(ev.toFixed(4)),
            confidence: modelProb >= 0.65 ? "high" : modelProb >= 0.45 ? "medium" : "low",
            kelly_fraction: kelly,
            kelly_stake_euros: Math.round(bankroll * kelly),
            bookmaker: item.bookmaker,
            is_suspicious: false,
            is_demo: false,
          });
        }
      }
    }
  }

  // 2. Scan marchés statistiques Poisson (Cartons, Tirs, Corners, Fautes)
  if (m.stat_rates) {
    const panoply = computeFullMarketPanoply(m.stat_rates);
    const statMarkets = [
      ...panoply.cards,
      ...panoply.shots,
      ...panoply.corners,
      ...panoply.fouls,
    ];

    for (const item of statMarkets) {
      if (item.modelProb < 0.45 || item.modelProb > 0.96) continue;
      if (item.fairOdds < 1.20 || item.fairOdds > 4.50) continue;

      const marketOdds = parseFloat((item.fairOdds * 1.08).toFixed(2));
      if (marketOdds < 1.30 || marketOdds > 4.50) continue;

      const implP = 1 / marketOdds;
      const edge = item.modelProb - implP;
      const ev = item.modelProb * marketOdds - 1;
      if (ev < 0.015 || ev > 0.30) continue;

      const kellyRaw = edge / (marketOdds - 1);
      const kelly = Math.min(Math.max(kellyRaw * 0.25, 0), 0.025);

      candidates.push({
        id: `stat-${m.id}-${item.category}-${item.selection}`,
        match_id: m.id,
        home_team: m.home_team,
        away_team: m.away_team,
        competition: m.competition,
        sport: m.sport,
        commence_time: m.commence_time,
        market_type: item.category as MarketCategory,
        outcome: item.selection,
        outcome_label: `${item.selection} (Modèle Stat.)`,
        odds: marketOdds,
        model_probability: item.modelProb,
        market_probability: implP,
        edge,
        expected_value: parseFloat(ev.toFixed(4)),
        confidence: item.modelProb >= 0.65 ? "high" : item.modelProb >= 0.45 ? "medium" : "low",
        kelly_fraction: kelly,
        kelly_stake_euros: Math.round(bankroll * kelly),
        bookmaker: "📊 Modèle Poisson",
        is_suspicious: false,
        is_demo: false,
      });
    }
  }

  if (candidates.length === 0) return null;

  // Trier par probabilité de réussite (événement le plus probable de se produire)
  candidates.sort((a, b) => b.model_probability - a.model_probability);
  return candidates[0];
}

export default function PicksPage() {
  const bankroll = 1000;
  const [loading, setLoading] = useState(true);
  const [livePicks, setLivePicks] = useState<BettingPick[]>([]);
  const [isRealData, setIsRealData] = useState(false);

  const fetchLivePicks = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/matches/today", { cache: "no-store" });
      if (!resp.ok) throw new Error("API route error");
      const data = await resp.json();
      const matches: LiveMatch[] = data.matches ?? [];

      if (matches.length > 0) {
        setIsRealData(true);
        const extracted: BettingPick[] = [];

        for (const m of matches) {
          const best = selectBestPickForMatch(m, bankroll);
          if (best) extracted.push(best);
        }

        // Tri global : probabilité de réussite décroissante (les événements les plus sûrs en haut)
        extracted.sort((a, b) => b.model_probability - a.model_probability);

        setLivePicks(extracted.length > 0 ? extracted : DEMO_PICKS);
      } else {
        setIsRealData(false);
        setLivePicks(DEMO_PICKS);
      }
    } catch {
      setIsRealData(false);
      setLivePicks(DEMO_PICKS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLivePicks();
  }, [fetchLivePicks]);

  const picks = livePicks;

  const highConf = picks.filter((p) => p.confidence === "high");
  const medConf = picks.filter((p) => p.confidence === "medium");
  const lowConf = picks.filter((p) => p.confidence === "low");

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <PageHeader
          eyebrow="Moteur Hybride · Cotes Réelles Bookmakers + Modèle Statistique Poisson"
          title="Top Picks — Événements les Plus Probables"
        />
        {isRealData ? (
          <span
            className="rounded-full px-3 py-1 text-[11px] font-mono font-semibold"
            style={{
              background: "color-mix(in srgb, var(--color-success) 12%, transparent)",
              color: "var(--color-success)",
              border: "1px solid color-mix(in srgb, var(--color-success) 30%, transparent)",
            }}
          >
            🟢 Multi-Marchés Live (The Odds API + Poisson)
          </span>
        ) : (
          <span
            className="rounded-full px-3 py-1 text-[11px] font-mono"
            style={{
              background: "color-mix(in srgb, var(--color-muted) 10%, transparent)",
              color: "var(--color-muted)",
              border: "1px dashed var(--color-border)",
            }}
          >
            {loading ? "⚡ Analyse en cours..." : "Données illustratives"}
          </span>
        )}
      </div>

      <div className="mb-4 rounded-lg p-3 text-xs" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}>
        💡 <strong style={{ color: "var(--color-text)" }}>Méthode Top Picks :</strong> Analyse complète des marchés réels (1X2, Over/Under, BTTS, Double Chance, DNB, Handicap) + estimations Poisson (Cartons, Tirs Cadrés/Total, Corners, Fautes). Chaque match est représenté par l'événement ayant le <strong style={{ color: "var(--color-amber)" }}>taux de probabilité de réussite le plus élevé</strong>.
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        {[
          { level: "high" as const, picks: highConf, label: "Confiance élevée (≥65%)" },
          { level: "medium" as const, picks: medConf, label: "Confiance moyenne (45–64%)" },
          { level: "low" as const, picks: lowConf, label: "Confiance faible (22–44%)" },
        ].map(({ level, picks: ps, label }) => (
          <div
            key={level}
            className="flex items-center gap-2 rounded-full px-4 py-2"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <ConfidenceBadge level={level} />
            <span className="text-xs font-medium">{label}</span>
            <span
              className="font-mono text-xs font-bold"
              style={{ color: "var(--color-muted)" }}
            >
              × {ps.length}
            </span>
          </div>
        ))}
      </div>

      {loading && (
        <div className="py-16 text-center">
          <div className="font-mono text-xl animate-pulse mb-2">⚽</div>
          <p className="text-sm font-medium">Détection des Top Picks (Bookmakers + Poisson)...</p>
        </div>
      )}

      {!loading && (
        <>
          {highConf.length > 0 && (
            <section className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <ConfidenceBadge level="high" size="md" />
                <h2 className="text-sm font-semibold">Confiance élevée — Probabilité ≥ 65%</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {highConf.map((pick, i) => (
                  <PickCard key={pick.id} pick={pick} rank={i + 1} />
                ))}
              </div>
            </section>
          )}

          {medConf.length > 0 && (
            <section className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <ConfidenceBadge level="medium" size="md" />
                <h2 className="text-sm font-semibold">Confiance moyenne — Probabilité 45–64%</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {medConf.map((pick, i) => (
                  <PickCard
                    key={pick.id}
                    pick={pick}
                    rank={highConf.length + i + 1}
                  />
                ))}
              </div>
            </section>
          )}

          {lowConf.length > 0 && (
            <section className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <ConfidenceBadge level="low" size="md" />
                <h2 className="text-sm font-semibold">Confiance faible — Probabilité 22–44%</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {lowConf.map((pick, i) => (
                  <PickCard
                    key={pick.id}
                    pick={pick}
                    rank={highConf.length + medConf.length + i + 1}
                  />
                ))}
              </div>
            </section>
          )}

          {picks.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm font-medium">Aucun top pick qualifié détecté</p>
              <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
                Aucun événement ne valide le critère Edge positif et probabilité minimale.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
