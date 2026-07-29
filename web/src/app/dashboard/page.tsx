"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { PickCard } from "@/components/pick-card";
import { ProbabilityBar } from "@/components/probability-bar";
import type { BettingPick, UpcomingMatch } from "@/lib/types";
import { DEMO_PICKS, DEMO_UPCOMING_MATCHES } from "@/lib/demo-data";
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

function formatMatchDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffH = (d.getTime() - now.getTime()) / 3600000;
  if (diffH < 24) return `Dans ${Math.round(Math.max(diffH, 0))}h`;
  if (diffH < 48) return "Demain";
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

export default function DashboardPage() {
  const bankroll = 1000;
  const [loading, setLoading] = useState(true);
  const [liveMatches, setLiveMatches] = useState<UpcomingMatch[]>([]);
  const [livePicks, setLivePicks] = useState<BettingPick[]>([]);
  const [isRealData, setIsRealData] = useState(false);

  const fetchLiveData = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/matches/today", { cache: "no-store" });
      if (!resp.ok) throw new Error("API route error");
      const data = await resp.json();
      const matches: LiveMatch[] = data.matches ?? [];

      if (matches.length > 0) {
        setIsRealData(true);

        const upcoming: UpcomingMatch[] = matches.map((m) => ({
          id: m.id,
          sport: m.sport,
          competition: m.competition,
          home_team: m.home_team,
          away_team: m.away_team,
          commence_time: m.commence_time,
          model_probs: m.model_probs,
          market_odds: m.market_odds ?? { home: 0, draw: 0, away: 0 },
          best_bookmaker: m.best_bookmaker ?? "OddsAPI",
          best_outcome: m.best_outcome,
          best_edge: m.best_edge,
          best_ev: m.best_ev,
          is_demo: false,
          stat_rates: m.stat_rates,
        }));
        setLiveMatches(upcoming);

        const picks: BettingPick[] = [];
        for (const m of matches) {
          if (m.market_odds && m.best_outcome && m.best_ev && m.best_ev >= 0.02 && m.best_ev <= 0.25) {
            const mktOdd = m.market_odds[m.best_outcome];
            const modelP = m.model_probs[m.best_outcome];

            // Filtre de rigueur stricte : cotes 1.35 à 4.50 max, proba >= 22%
            if (mktOdd >= 1.35 && mktOdd <= 4.50 && modelP >= 0.22) {
              const implP = 1 / mktOdd;
              const edge = modelP - implP;
              const label = m.best_outcome === "home" ? `${m.home_team} gagne` : m.best_outcome === "away" ? `${m.away_team} gagne` : "Match nul";
              const kellyRaw = edge / (mktOdd - 1);
              const kelly = Math.min(Math.max(kellyRaw * 0.25, 0), 0.03);

              picks.push({
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
          }

          if (m.stat_rates) {
            const panoply = computeFullMarketPanoply(m.stat_rates);
            const candidateMarkets = [
              ...panoply.goals,
              ...panoply.corners,
              ...panoply.cards,
              ...panoply.shots,
            ];

            for (const item of candidateMarkets) {
              if (item.modelProb >= 0.58 && item.modelProb <= 0.88 && item.fairOdds >= 1.25 && item.fairOdds <= 3.20) {
                const marketOdds = parseFloat((item.fairOdds * 1.08).toFixed(2));
                if (marketOdds < 1.35 || marketOdds > 4.20) continue;

                const implP = 1 / marketOdds;
                const edge = item.modelProb - implP;
                const ev = item.modelProb * marketOdds - 1;

                if (ev < 0.02 || ev > 0.20) continue;

                const kellyRaw = edge / (marketOdds - 1);
                const kelly = Math.min(Math.max(kellyRaw * 0.25, 0), 0.03);

                picks.push({
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
                  expected_value: parseFloat(ev.toFixed(4)),
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
        }

        const filtered = picks.filter(p => p.odds >= 1.35 && p.odds <= 4.50);
        setLivePicks(filtered.length > 0 ? filtered : DEMO_PICKS);
      } else {
        setIsRealData(false);
        setLiveMatches(DEMO_UPCOMING_MATCHES);
        setLivePicks(DEMO_PICKS);
      }
    } catch {
      setIsRealData(false);
      setLiveMatches(DEMO_UPCOMING_MATCHES);
      setLivePicks(DEMO_PICKS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveData();
  }, [fetchLiveData]);

  const picks = livePicks;
  const topPicks = picks.slice(0, 3);
  const upcomingMatches = liveMatches.slice(0, 3);

  const highConf = picks.filter((p) => p.confidence === "high").length;
  const avgEV =
    picks.length > 0
      ? picks.reduce((s, p) => s + p.expected_value, 0) / picks.length
      : 0;
  const totalKelly = picks.reduce((s, p) => s + p.kelly_stake_euros, 0);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <PageHeader eyebrow="Dashboard Parieur · Rigueur Quant" title="Vue d'ensemble" />
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

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Picks qualifiés" value={picks.length} />
        <StatCard
          label="Confiance élevée ★★★"
          value={highConf}
          tone={highConf > 0 ? "success" : "default"}
        />
        <StatCard
          label="EV moyen"
          value={`${avgEV >= 0 ? "+" : ""}${(avgEV * 100).toFixed(1)}%`}
          tone={avgEV > 0.05 ? "success" : avgEV > 0 ? "default" : "danger"}
        />
        <StatCard label="Exposition Kelly totale" value={`${totalKelly}€`} />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Top Picks du moment (Cotes 1.35 – 4.50)</h2>
        <Link
          href="/dashboard/picks"
          className="text-xs transition-colors hover:opacity-80"
          style={{ color: "var(--color-muted)" }}
        >
          Tous les picks ({picks.length}) →
        </Link>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {topPicks.map((pick, i) => (
          <PickCard key={pick.id} pick={pick} rank={i + 1} />
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Matchs à venir — Probabilités modèle</h2>
        <Link
          href="/dashboard/matches"
          className="text-xs transition-colors hover:opacity-80"
          style={{ color: "var(--color-muted)" }}
        >
          Voir tous les matchs →
        </Link>
      </div>

      <Card>
        <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
          {upcomingMatches.map((match) => (
            <div key={match.id} className="px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div
                    className="font-mono text-[11px] tracking-wide"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {match.competition} · {formatMatchDate(match.commence_time)}
                  </div>
                  <div className="mt-0.5 font-semibold text-sm">
                    {match.home_team} vs {match.away_team}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {match.best_ev != null && match.best_ev > 0 && (
                    <span
                      className="font-mono text-[11px] rounded-full px-2 py-0.5"
                      style={{
                        background: "color-mix(in srgb, var(--color-success) 12%, transparent)",
                        color: "var(--color-success)",
                      }}
                    >
                      +{(match.best_ev * 100).toFixed(1)}% EV
                    </span>
                  )}
                  <span
                    className="font-mono text-[11px]"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {match.best_bookmaker}
                  </span>
                </div>
              </div>
              <ProbabilityBar
                modelProbs={match.model_probs}
                marketOdds={match.market_odds}
                homeLabel={match.home_team.split(" ")[0]}
                awayLabel={match.away_team.split(" ").slice(-1)[0]}
                bestOutcome={match.best_outcome}
              />
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          {
            href: "/dashboard/picks",
            title: "Top Picks",
            desc: "Classement complet par edge & EV",
            icon: "🎯",
          },
          {
            href: "/dashboard/matches",
            title: "Matchs à venir",
            desc: "Probabilités 1X2 + cotes marché",
            icon: "📅",
          },
          {
            href: "/dashboard/suggestions",
            title: "Suggestions",
            desc: "Recommandations actionnables Kelly",
            icon: "💡",
          },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <div
              className="group rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:border-opacity-80"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
              }}
            >
              <div className="mb-2 text-2xl">{item.icon}</div>
              <div className="font-semibold text-sm">{item.title}</div>
              <div
                className="mt-0.5 text-xs"
                style={{ color: "var(--color-muted)" }}
              >
                {item.desc}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
