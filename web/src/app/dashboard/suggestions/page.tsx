"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader, Card } from "@/components/ui";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { GeminiFactCheckBadge } from "@/components/gemini-fact-check-badge";
import { DateFilterBar, type DateFilterOption } from "@/components/date-filter-bar";
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
import type { BettingPick, MarketCategory } from "@/lib/types";
import Link from "next/link";

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
  { key: "all", label: "Tous les paris réels", icon: "🔥" },
  { key: "1X2", label: "1X2 Vainqueur", icon: "🏆" },
  { key: "totals", label: "Over/Under Buts", icon: "⚽" },
  { key: "btts", label: "Les 2 Marquent (BTTS)", icon: "🤝" },
  { key: "double_chance", label: "Double Chance", icon: "🛡️" },
  { key: "draw_no_bet", label: "Draw No Bet (DNB)", icon: "⚖️" },
  { key: "handicap", label: "Handicap / Spreads", icon: "🎯" },
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
    pick.market_type === "btts"
      ? "var(--color-blue)"
      : pick.market_type === "totals"
        ? "var(--color-success)"
        : pick.market_type === "double_chance" || pick.market_type === "draw_no_bet"
          ? "var(--color-amber)"
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
        const matchCandidates: BettingPick[] = [];
        const lambdaHome = m.stat_rates?.lambda_goals_home ?? 1.55;
        const lambdaAway = m.stat_rates?.lambda_goals_away ?? 1.10;
        const totalGoalsLambda = lambdaHome + lambdaAway;

        // Probabilités du modèle
        const model1X2 = m.model_probs;
        const max1X2Prob = Math.max(model1X2.home, model1X2.away);
        const is1X2Dominant = max1X2Prob >= 0.70; // 70%+ de certitude sur 1X2

        // Scanner TOUS les marchés réels fournis par The Odds API pour ce match
        if (m.real_markets && m.real_markets.length > 0) {
          for (const item of m.real_markets) {
            let modelProb = 0;

            // Calcul de la probabilité modèle selon le type de marché réel
            if (item.category === "1X2") {
              if (item.selection === "home") modelProb = model1X2.home;
              else if (item.selection === "away") modelProb = model1X2.away;
              else if (item.selection === "draw") modelProb = model1X2.draw;
            } else if (item.category === "totals") {
              const line = item.line ?? 2.5;
              if (item.raw_outcome === "Over" || item.selection.startsWith("Over")) {
                modelProb = probOver(line, totalGoalsLambda);
              } else {
                modelProb = probUnder(line, totalGoalsLambda);
              }
            } else if (item.category === "btts") {
              const bttsProb = probBTTS(lambdaHome, lambdaAway);
              if (item.raw_outcome === "Yes" || item.selection.includes("Oui")) {
                modelProb = bttsProb;
              } else {
                modelProb = 1 - bttsProb;
              }
            } else if (item.category === "double_chance") {
              const dc = probDoubleChance(model1X2);
              if (item.raw_outcome?.includes("Home") && item.raw_outcome?.includes("Draw")) modelProb = dc.home_draw;
              else if (item.raw_outcome?.includes("Away") && item.raw_outcome?.includes("Draw")) modelProb = dc.away_draw;
              else modelProb = dc.home_away;
            } else if (item.category === "draw_no_bet") {
              const dnb = probDrawNoBet(model1X2);
              if (item.raw_outcome === m.home_team) modelProb = dnb.home;
              else modelProb = dnb.away;
            } else if (item.category === "handicap") {
              const line = item.line ?? 0;
              const hc = probHandicap(lambdaHome, lambdaAway, line);
              modelProb = item.raw_outcome === m.home_team ? hc.home : hc.away;
            }

            // Filtrage quant : cote entre 1.25 et 4.50, probabilité >= 22%, EV >= 2%
            if (item.odds >= 1.25 && item.odds <= 4.50 && modelProb >= 0.22) {
              const implP = 1 / item.odds;
              const edge = modelProb - implP;
              const ev = modelProb * item.odds - 1;

              if (ev >= 0.02 && ev <= 0.30) {
                const kellyRaw = edge / (item.odds - 1);
                const kelly = Math.min(Math.max(kellyRaw * 0.25, 0), 0.03);

                matchCandidates.push({
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

        // Sélection intelligente par match :
        // Si 1X2 < 70%, trier les marchés alternatifs par probabilité de réussite (confiance max)
        // Sinon, trier par EV (+EV)
        matchCandidates.sort((a, b) => {
          if (!is1X2Dominant) {
            return b.model_probability - a.model_probability;
          }
          return b.expected_value - a.expected_value;
        });

        // Retenir le SEUL événement le plus probable et le plus rentable pour ce match
        const topForMatch = matchCandidates.slice(0, 1);
        extracted.push(...topForMatch);
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
    .filter((p) => !p.is_suspicious && p.odds >= 1.25 && p.odds <= 4.50)
    .sort((a, b) => b.model_probability - a.model_probability);

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
            eyebrow="Rigueur Quantitatifs · Live Odds API Multi-Marchés"
            title="Panoplie de Paris Suggérés (Cotes Réelles Multi-Marchés Bookmakers)"
          />
          <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
            Sélection intelligente de l'événement le plus probable par match parmi les cotes réelles (1X2, Over/Under, BTTS, Double Chance, DNB, Handicap).
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
          Type de Pari Réel :
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
            Suggestions qualifiées
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
            Exposition Kelly Prudente
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

      {loading && (
        <div className="py-16 text-center">
          <div className="font-mono text-xl animate-pulse mb-2">⚽</div>
          <p className="text-sm font-medium">Analyse des cotes réelles multi-marchés et détection des événements optimaux...</p>
        </div>
      )}

      {!loading && (
        <Card className="overflow-hidden">
          {actionable.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium">Aucune suggestion qualifiée détectée pour ces critères</p>
              <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
                Seules les cotes réelles avec Edge positif et forte probabilité sont retenues.
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
