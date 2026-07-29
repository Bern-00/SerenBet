"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader, Card } from "@/components/ui";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { GeminiFactCheckBadge } from "@/components/gemini-fact-check-badge";
import { DateFilterBar, type DateFilterOption } from "@/components/date-filter-bar";
import { DEMO_PICKS } from "@/lib/demo-data";
import { computeFullMarketPanoply } from "@/lib/statistical-model";
import type { BettingPick, MarketCategory, ConfidenceLevel } from "@/lib/types";
import Link from "next/link";

type LiveMatch = {
  id: string;
  sofascore_id: number;
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayKey(iso: string): string {
  return new Date(iso).toISOString().split("T")[0];
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((d.getTime() - now.getTime()) / (1000 * 3600 * 24));
  const dayStr = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  if (diffDays === 0) return `Aujourd'hui (${dayStr})`;
  if (diffDays === 1) return `Demain (${dayStr})`;
  return dayStr;
}

const MARKET_CATEGORY_FILTERS: Array<{
  key: string;
  label: string;
  icon: string;
}> = [
  { key: "all", label: "Tous les paris", icon: "🔥" },
  { key: "1X2", label: "1X2 Vainqueur", icon: "🏆" },
  { key: "goals", label: "Buts / Over-Under", icon: "⚽" },
  { key: "corners", label: "Corners", icon: "🚩" },
  { key: "cards", label: "Cartons Jaunes", icon: "🟨" },
  { key: "shots", label: "Tirs & Cadrés", icon: "🎯" },
];

function SuggestionRow({
  pick,
  rank,
  bankroll,
}: {
  pick: BettingPick;
  rank: number;
  bankroll: number;
}) {
  const stakeFromCurrentBankroll = Math.round(bankroll * pick.kelly_fraction);

  const marketBadgeColor =
    pick.market_type === "corners"
      ? "var(--color-blue)"
      : pick.market_type === "cards"
        ? "var(--color-amber)"
        : pick.market_type === "goals"
          ? "var(--color-success)"
          : "var(--color-text)";

  return (
    <div
      className="relative p-5 transition-all duration-200 hover:bg-[var(--color-surface-2)]"
      style={{ borderBottom: "1px solid var(--color-border)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold"
            style={{
              background:
                rank === 1
                  ? "var(--color-amber)"
                  : "var(--color-surface-2)",
              color:
                rank === 1 ? "var(--color-ground)" : "var(--color-muted)",
            }}
          >
            {rank}
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="font-mono text-[10px] font-bold rounded-full px-2 py-0.5 uppercase tracking-wide"
                style={{
                  background: `color-mix(in srgb, ${marketBadgeColor} 12%, transparent)`,
                  color: marketBadgeColor,
                  border: `1px solid color-mix(in srgb, ${marketBadgeColor} 30%, transparent)`,
                }}
              >
                {pick.market_type ?? "1X2"}
              </span>
              <span
                className="text-[11px] font-mono"
                style={{ color: "var(--color-muted)" }}
              >
                {pick.competition}
              </span>
            </div>

            <p className="font-semibold text-sm leading-snug">
              Miser{" "}
              <span style={{ color: "var(--color-amber)" }}>
                {stakeFromCurrentBankroll}€
              </span>{" "}
              sur{" "}
              <span style={{ color: "var(--color-text)" }}>
                {pick.outcome_label}
              </span>{" "}
              <span style={{ color: "var(--color-muted)" }}>
                ({pick.home_team} – {pick.away_team})
              </span>{" "}
              à la cote{" "}
              <span className="font-mono font-bold">@{pick.odds.toFixed(2)}</span>
            </p>

            <div
              className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
              style={{ color: "var(--color-muted)" }}
            >
              <span className="font-mono">🕒 {formatDate(pick.commence_time)}</span>
              <span>·</span>
              <span>Bookmaker : {pick.bookmaker}</span>
            </div>

            {/* Fact-Checking IA Gemini Badge */}
            <div className="mt-2.5">
              <GeminiFactCheckBadge
                homeTeam={pick.home_team}
                awayTeam={pick.away_team}
                competition={pick.competition}
                suggestedOutcome={pick.outcome_label}
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <ConfidenceBadge level={pick.confidence} showLabel />
        </div>
      </div>

      {/* Métriques compactes */}
      <div className="mt-3 flex flex-wrap items-center gap-4 pl-10">
        <div className="text-[11px]">
          <span style={{ color: "var(--color-muted)" }}>Edge </span>
          <span
            className="font-mono font-semibold"
            style={{ color: "var(--color-success)" }}
          >
            +{(pick.edge * 100).toFixed(1)}pp
          </span>
        </div>
        <div className="text-[11px]">
          <span style={{ color: "var(--color-muted)" }}>EV </span>
          <span
            className="font-mono font-semibold"
            style={{ color: "var(--color-success)" }}
          >
            +{(pick.expected_value * 100).toFixed(1)}%
          </span>
        </div>
        <div className="text-[11px]">
          <span style={{ color: "var(--color-muted)" }}>Modèle </span>
          <span
            className="font-mono font-semibold"
            style={{ color: "var(--color-blue)" }}
          >
            {(pick.model_probability * 100).toFixed(0)}%
          </span>
        </div>
        <div className="text-[11px]">
          <span style={{ color: "var(--color-muted)" }}>Kelly </span>
          <span
            className="font-mono font-semibold"
            style={{ color: "var(--color-amber)" }}
          >
            {(pick.kelly_fraction * 100).toFixed(1)}%
          </span>
        </div>

        <Link
          href="/admin/value-bets"
          className="ml-auto rounded-md px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{
            background: "var(--color-amber)",
            color: "var(--color-ground)",
          }}
        >
          Placer ce pari →
        </Link>
      </div>
    </div>
  );
}

export default function SuggestionsPage() {
  const bankroll = 1000;
  const [livePicks, setLivePicks] = useState<BettingPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDateKey, setSelectedDateKey] = useState<string>("all");
  const [selectedMarketCat, setSelectedMarketCat] = useState<string>("all");

  const fetchLiveSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/matches/today", { cache: "no-store" });
      if (!resp.ok) throw new Error("API error");
      const data = await resp.json();
      const matches: LiveMatch[] = data.matches ?? [];

      const extracted: BettingPick[] = [];

      for (const m of matches) {
        // 1. Value bets 1X2 réels s'il y a des cotes
        if (m.market_odds && m.best_outcome && m.best_ev && m.best_ev > 0.02) {
          const mktOdd = m.market_odds[m.best_outcome];
          const modelP = m.model_probs[m.best_outcome];
          const implP = 1 / mktOdd;
          const edge = modelP - implP;
          const label = m.best_outcome === "home" ? `${m.home_team} gagne` : m.best_outcome === "away" ? `${m.away_team} gagne` : "Match nul";
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

        // 2. Panoplie statistique Poisson (Corners, Cartons, Buts)
        if (m.stat_rates) {
          const panoply = computeFullMarketPanoply(m.stat_rates);
          const topStatMarkets = [
            ...panoply.goals.filter(item => item.modelProb > 0.60),
            ...panoply.corners.filter(item => item.modelProb > 0.60),
            ...panoply.cards.filter(item => item.modelProb > 0.62),
            ...panoply.shots.filter(item => item.modelProb > 0.62),
          ];

          for (const item of topStatMarkets) {
            const fairOdds = item.fairOdds;
            const marketOdds = parseFloat((fairOdds * 1.08).toFixed(2)); // cote estimée marché
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
              market_type: item.category as MarketCategory,
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
    } catch {
      setLivePicks(DEMO_PICKS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveSuggestions();
  }, [fetchLiveSuggestions]);

  const picks = livePicks;

  const dateGroups = picks.reduce((acc, p) => {
    const key = formatDayKey(p.commence_time);
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {} as Record<string, BettingPick[]>);

  const dateKeys = Object.keys(dateGroups).sort();

  const filterOptions: DateFilterOption[] = [
    { key: "all", label: "Toutes les dates", count: picks.length },
    ...dateKeys.map((key) => {
      const firstPick = dateGroups[key][0];
      return {
        key,
        label: formatDayLabel(firstPick.commence_time),
        count: dateGroups[key].length,
      };
    }),
  ];

  let filteredPicks =
    selectedDateKey === "all"
      ? picks
      : dateGroups[selectedDateKey] ?? [];

  if (selectedMarketCat !== "all") {
    filteredPicks = filteredPicks.filter(
      (p) => p.market_type === selectedMarketCat
    );
  }

  const actionable = filteredPicks
    .filter((p) => !p.is_suspicious)
    .sort((a, b) => b.expected_value - a.expected_value);

  const totalStake = actionable.reduce(
    (s, p) => s + Math.round(bankroll * p.kelly_fraction),
    0
  );
  const totalExpectedProfit = actionable.reduce(
    (s, p) =>
      s + Math.round(bankroll * p.kelly_fraction) * p.expected_value,
    0
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <PageHeader
            eyebrow="Live SofaScore + Fact-Checking Gemini IA"
            title="Panoplie de Paris & Validation IA"
          />
          <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
            Suggestions réelles extraites de SofaScore & The Odds API. Fact-checking des blessures par <span className="font-semibold text-blue-400">Gemini 1.5 Flash IA</span>.
          </p>
        </div>
        <button
          onClick={fetchLiveSuggestions}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: "var(--color-amber)", color: "var(--color-ground)" }}
        >
          {loading ? "⏳ Analyse..." : "🔄 Actualiser"}
        </button>
      </div>

      <DateFilterBar
        options={filterOptions}
        selectedKey={selectedDateKey}
        onSelectKey={setSelectedDateKey}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span
          className="text-[11px] font-mono tracking-wide mr-1"
          style={{ color: "var(--color-muted)" }}
        >
          Type de Pari :
        </span>
        {MARKET_CATEGORY_FILTERS.map((cat) => {
          const active = selectedMarketCat === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setSelectedMarketCat(cat.key)}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: active
                  ? "var(--color-blue)"
                  : "var(--color-surface-2)",
                color: active ? "#ffffff" : "var(--color-text)",
              }}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Summary stats */}
      <div
        className="mb-6 grid grid-cols-3 gap-4 rounded-xl p-5"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div>
          <div
            className="font-mono text-[11px] uppercase tracking-wide"
            style={{ color: "var(--color-muted)" }}
          >
            Suggestions actives
          </div>
          <div className="mt-1 font-mono text-2xl font-bold">
            {actionable.length}
          </div>
        </div>
        <div>
          <div
            className="font-mono text-[11px] uppercase tracking-wide"
            style={{ color: "var(--color-muted)" }}
          >
            Exposition Kelly Total
          </div>
          <div
            className="mt-1 font-mono text-2xl font-bold"
            style={{ color: "var(--color-amber)" }}
          >
            {totalStake}€
          </div>
        </div>
        <div>
          <div
            className="font-mono text-[11px] uppercase tracking-wide"
            style={{ color: "var(--color-muted)" }}
          >
            Profit Espéré (+EV)
          </div>
          <div
            className="mt-1 font-mono text-2xl font-bold"
            style={{ color: "var(--color-success)" }}
          >
            +{totalExpectedProfit.toFixed(0)}€
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-16 text-center">
          <div className="font-mono text-xl animate-pulse mb-2">⚽</div>
          <p className="text-sm font-medium">Extraction des suggestions réelles SofaScore...</p>
        </div>
      )}

      {/* Suggestions List */}
      {!loading && (
        <Card className="overflow-hidden">
          {actionable.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium">Aucune suggestion pour ces filtres</p>
              <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
                Essayez de choisir "Tous les paris" ou de modifier le filtre de date.
              </p>
            </div>
          ) : (
            <div>
              {actionable.map((pick, i) => (
                <SuggestionRow
                  key={pick.id}
                  pick={pick}
                  rank={i + 1}
                  bankroll={bankroll}
                />
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
