"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { PickCard } from "@/components/pick-card";
import { ProbabilityBar } from "@/components/probability-bar";
import type { BettingPick, UpcomingMatch, MarketCategory } from "@/lib/types";
import { DEMO_PICKS, DEMO_UPCOMING_MATCHES } from "@/lib/demo-data";
import {
  probOver,
  probUnder,
  probBTTS,
  probDoubleChance,
  probDrawNoBet,
  probHandicap,
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
          if (!m.real_markets || m.real_markets.length === 0) continue;

          const lambdaHome = m.stat_rates?.lambda_goals_home ?? 1.55;
          const lambdaAway = m.stat_rates?.lambda_goals_away ?? 1.10;
          const totalGoalsLambda = lambdaHome + lambdaAway;
          const model1X2 = m.model_probs;
          const candidates: BettingPick[] = [];

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

          // Événement le plus probable pour ce match
          candidates.sort((a, b) => b.model_probability - a.model_probability);
          if (candidates[0]) picks.push(candidates[0]);
        }

        // Tri global : probabilité décroissante — les vrais top picks en premier
        picks.sort((a, b) => b.model_probability - a.model_probability);

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
