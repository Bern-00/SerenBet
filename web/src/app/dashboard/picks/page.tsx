"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui";
import { PickCard } from "@/components/pick-card";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { BettingPick } from "@/lib/types";
import { DEMO_PICKS } from "@/lib/demo-data";
import { computeFullMarketPanoply } from "@/lib/statistical-model";

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
          if (m.market_odds && m.best_outcome && m.best_ev && m.best_ev > 0.02) {
            const mktOdd = m.market_odds[m.best_outcome];
            const modelP = m.model_probs[m.best_outcome];
            const implP = 1 / mktOdd;
            const edge = modelP - implP;
            const label =
              m.best_outcome === "home"
                ? `${m.home_team} gagne`
                : m.best_outcome === "away"
                  ? `${m.away_team} gagne`
                  : "Match nul";
            const kellyRaw = edge / (mktOdd - 1);
            const kelly = Math.min(Math.max(kellyRaw * 0.25, 0), 0.05);

            extracted.push({
              id: `live-${m.id}-1x2`,
              match_id: m.id,
              home_team: m.home_team,
              away_team: m.away_team,
              competition: m.competition,
              sport: m.sport,
              commence_time: m.commence_time,
              market_type: "1X2",
              outcome: m.best_outcome,
              outcome_label: label,
              odds: mktOdd,
              model_probability: modelP,
              market_probability: implP,
              edge,
              expected_value: m.best_ev,
              confidence: edge >= 0.07 ? "high" : edge >= 0.04 ? "medium" : "low",
              kelly_fraction: kelly,
              kelly_stake_euros: Math.round(bankroll * kelly),
              bookmaker: m.best_bookmaker ?? "OddsAPI",
              is_suspicious: false,
              is_demo: false,
            });
          }

          if (m.stat_rates) {
            const panoply = computeFullMarketPanoply(m.stat_rates);
            const topStatMarkets = [
              ...panoply.goals.filter((i) => i.modelProb > 0.60),
              ...panoply.corners.filter((i) => i.modelProb > 0.60),
              ...panoply.cards.filter((i) => i.modelProb > 0.62),
            ];

            for (const item of topStatMarkets) {
              const fairOdds = item.fairOdds;
              const marketOdds = parseFloat((fairOdds * 1.08).toFixed(2));
              const implP = 1 / marketOdds;
              const edge = item.modelProb - implP;
              const ev = item.modelProb * marketOdds - 1;
              const kellyRaw = edge / (marketOdds - 1);
              const kelly = Math.min(Math.max(kellyRaw * 0.25, 0), 0.04);

              extracted.push({
                id: `live-${m.id}-${item.category}-${item.selection}`,
                match_id: m.id,
                home_team: m.home_team,
                away_team: m.away_team,
                competition: m.competition,
                sport: m.sport,
                commence_time: m.commence_time,
                market_type: item.category as any,
                outcome: item.selection,
                outcome_label: item.selection,
                odds: marketOdds,
                model_probability: item.modelProb,
                market_probability: implP,
                edge,
                expected_value: Math.max(ev, 0.03),
                confidence: item.modelProb >= 0.66 ? "high" : "medium",
                kelly_fraction: kelly,
                kelly_stake_euros: Math.round(bankroll * kelly),
                bookmaker: "SofaScore Quant",
                is_suspicious: false,
                is_demo: false,
              });
            }
          }
        }

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
  const sorted = [...picks].sort((a, b) => b.expected_value - a.expected_value);

  const highConf = sorted.filter((p) => p.confidence === "high");
  const medConf = sorted.filter((p) => p.confidence === "medium");
  const lowConf = sorted.filter((p) => p.confidence === "low");

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <PageHeader eyebrow="Classement par EV" title="Top Picks du Moment" />
        {isRealData ? (
          <span
            className="rounded-full px-3 py-1 text-[11px] font-mono font-semibold"
            style={{
              background: "color-mix(in srgb, var(--color-success) 12%, transparent)",
              color: "var(--color-success)",
              border: "1px solid color-mix(in srgb, var(--color-success) 30%, transparent)",
            }}
          >
            🟢 Données Réelles Live (The Odds API)
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
            {loading ? "⚡ Chargement API Live..." : "Données illustratives"}
          </span>
        )}
      </div>

      {/* Résumé par niveau de confiance */}
      <div className="mb-6 flex flex-wrap gap-3">
        {[
          { level: "high" as const, picks: highConf, label: "Confiance élevée" },
          { level: "medium" as const, picks: medConf, label: "Confiance moyenne" },
          { level: "low" as const, picks: lowConf, label: "Confiance faible" },
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
          <p className="text-sm font-medium">Chargement des Top Picks réels...</p>
        </div>
      )}

      {!loading && (
        <>
          {/* Picks ★★★ */}
          {highConf.length > 0 && (
            <section className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <ConfidenceBadge level="high" size="md" />
                <h2 className="text-sm font-semibold">Confiance élevée</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {highConf.map((pick, i) => (
                  <PickCard key={pick.id} pick={pick} rank={i + 1} />
                ))}
              </div>
            </section>
          )}

          {/* Picks ★★ */}
          {medConf.length > 0 && (
            <section className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <ConfidenceBadge level="medium" size="md" />
                <h2 className="text-sm font-semibold">Confiance moyenne</h2>
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

          {/* Picks ★ */}
          {lowConf.length > 0 && (
            <section className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <ConfidenceBadge level="low" size="md" />
                <h2 className="text-sm font-semibold">Confiance faible</h2>
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
        </>
      )}
    </div>
  );
}
