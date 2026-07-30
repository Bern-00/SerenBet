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
  competition_flag?: string;
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

const LEAGUE_META: Record<string, { flag: string; country: string }> = {
  "Premier League":   { flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", country: "Angleterre" },
  "La Liga":          { flag: "🇪🇸", country: "Espagne" },
  "Bundesliga":       { flag: "🇩🇪", country: "Allemagne" },
  "Serie A":          { flag: "🇮🇹", country: "Italie" },
  "Ligue 1":          { flag: "🇫🇷", country: "France" },
  "Champions League": { flag: "⭐",  country: "Europe" },
  "Europa League":    { flag: "🟠",  country: "Europe" },
  "Liga Portugal":    { flag: "🇵🇹", country: "Portugal" },
  "Eredivisie":       { flag: "🇳🇱", country: "Pays-Bas" },
  "MLS":              { flag: "🇺🇸", country: "États-Unis" },
  "Copa América":     { flag: "🌎", country: "Amérique du Sud" },
  "Matchs Amicaux":   { flag: "🤝", country: "Match Amical International / Clubs" },
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

const MARKET_CATEGORY_FILTERS = [
  { key: "all",           label: "Tous les paris",         icon: "🔥" },
  { key: "1X2",          label: "1X2 Vainqueur",          icon: "🏆" },
  { key: "totals",       label: "Over/Under Buts",         icon: "⚽" },
  { key: "btts",         label: "Les 2 Marquent (BTTS)",   icon: "🤝" },
  { key: "double_chance",label: "Double Chance",           icon: "🛡️" },
  { key: "draw_no_bet",  label: "Draw No Bet (DNB)",       icon: "⚖️" },
  { key: "handicap",     label: "Handicap",                icon: "🎯" },
  { key: "cards",        label: "Cartons Jaunes",          icon: "🟨" },
  { key: "shots",        label: "Tirs Cadrés / Total",     icon: "🎯" },
  { key: "corners",      label: "Corners",                 icon: "🚩" },
];

const MARKET_BADGE_COLORS: Record<string, string> = {
  "1X2":          "var(--color-text)",
  "totals":       "var(--color-success)",
  "btts":         "var(--color-blue)",
  "double_chance":"var(--color-amber)",
  "draw_no_bet":  "var(--color-amber)",
  "handicap":     "#a78bfa",
  "cards":        "#fbbf24",
  "corners":      "#60a5fa",
  "shots":        "#34d399",
  "fouls":        "#f87171",
  "goals":        "var(--color-success)",
};

function selectBestEvent(m: LiveMatch, bankroll: number): BettingPick | null {
  const lambdaHome = m.stat_rates?.lambda_goals_home ?? 1.55;
  const lambdaAway = m.stat_rates?.lambda_goals_away ?? 1.10;
  const totalGoalsLambda = lambdaHome + lambdaAway;
  const model1X2 = m.model_probs;
  const candidates: BettingPick[] = [];

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
        outcome_label: `${item.selection} ★ Estimation Statistique`,
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

  candidates.sort((a, b) => b.model_probability - a.model_probability);
  return candidates[0];
}

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
  const badgeColor = MARKET_BADGE_COLORS[pick.market_type ?? "1X2"] ?? "var(--color-text)";
  const isStatModel = pick.bookmaker === "📊 Modèle Poisson";
  const isFriendly = pick.competition === "Matchs Amicaux" || pick.competition.toLowerCase().includes("amical") || pick.competition.toLowerCase().includes("friendly");

  const meta = LEAGUE_META[pick.competition] ?? { flag: "⚽", country: pick.competition };

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
              background: rank === 1 ? "var(--color-amber)" : "var(--color-surface-2)",
              color: rank === 1 ? "var(--color-ground)" : "var(--color-muted)",
            }}
          >
            {rank}
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className="font-mono text-[10px] font-bold rounded-full px-2 py-0.5 uppercase tracking-wide"
                style={{
                  background: `color-mix(in srgb, ${badgeColor} 12%, transparent)`,
                  color: badgeColor,
                  border: `1px solid color-mix(in srgb, ${badgeColor} 30%, transparent)`,
                }}
              >
                {pick.market_type ?? "1X2"}
              </span>

              {isFriendly && (
                <span
                  className="font-mono text-[10px] font-bold rounded-full px-2 py-0.5 uppercase tracking-wide flex items-center gap-1"
                  style={{
                    background: "color-mix(in srgb, var(--color-amber) 15%, transparent)",
                    color: "var(--color-amber)",
                    border: "1px solid color-mix(in srgb, var(--color-amber) 30%, transparent)",
                  }}
                >
                  🤝 Match Amical
                </span>
              )}

              {isStatModel && (
                <span
                  className="font-mono text-[10px] rounded-full px-2 py-0.5"
                  style={{
                    background: "color-mix(in srgb, var(--color-muted) 10%, transparent)",
                    color: "var(--color-muted)",
                    border: "1px dashed var(--color-border)",
                  }}
                >
                  Estimation Statistique
                </span>
              )}

              <span className="text-[11px] font-mono flex items-center gap-1" style={{ color: "var(--color-muted)" }}>
                <span>{meta.flag}</span>
                <span>{pick.competition}</span>
              </span>
            </div>

            <p className="font-semibold text-sm leading-snug">
              Miser{" "}
              <span style={{ color: "var(--color-amber)" }}>{stakeFromCurrentBankroll}€</span>{" "}
              sur{" "}
              <span style={{ color: "var(--color-text)" }}>
                {pick.outcome_label.replace(" ★ Estimation Statistique", "")}
              </span>{" "}
              <span style={{ color: "var(--color-muted)" }}>
                ({pick.home_team} vs {pick.away_team})
              </span>{" "}
              {!isStatModel && (
                <>
                  à la cote{" "}
                  <span className="font-mono font-bold">@{pick.odds.toFixed(2)}</span>
                </>
              )}
              {isStatModel && (
                <span className="font-mono text-xs" style={{ color: "var(--color-muted)" }}>
                  — Cote estimée @{pick.odds.toFixed(2)}
                </span>
              )}
            </p>

            <div
              className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
              style={{ color: "var(--color-muted)" }}
            >
              <span className="font-mono">🕒 {formatDate(pick.commence_time)}</span>
              <span>·</span>
              <span>{isStatModel ? "📊 Modèle Poisson (Estimation)" : `Bookmaker : ${pick.bookmaker}`}</span>
            </div>

            <div className="mt-2.5">
              <GeminiFactCheckBadge
                homeTeam={pick.home_team}
                awayTeam={pick.away_team}
                competition={pick.competition}
                suggestedOutcome={pick.outcome_label.replace(" ★ Estimation Statistique", "")}
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
          <span className="font-mono font-semibold" style={{ color: "var(--color-success)" }}>
            +{(pick.edge * 100).toFixed(1)}pp
          </span>
        </div>
        <div className="text-[11px]">
          <span style={{ color: "var(--color-muted)" }}>EV </span>
          <span className="font-mono font-semibold" style={{ color: "var(--color-success)" }}>
            +{(pick.expected_value * 100).toFixed(1)}%
          </span>
        </div>
        <div className="text-[11px]">
          <span style={{ color: "var(--color-muted)" }}>Modèle </span>
          <span className="font-mono font-semibold" style={{ color: "var(--color-blue)" }}>
            {(pick.model_probability * 100).toFixed(0)}%
          </span>
        </div>
        <div className="text-[11px]">
          <span style={{ color: "var(--color-muted)" }}>Kelly </span>
          <span className="font-mono font-semibold" style={{ color: "var(--color-amber)" }}>
            {(pick.kelly_fraction * 100).toFixed(1)}%
          </span>
        </div>

        <Link
          href="/admin/value-bets"
          className="ml-auto rounded-md px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: "var(--color-amber)", color: "var(--color-ground)" }}
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
  const [selectedLeague, setSelectedLeague] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"league" | "flat">("league");

  const fetchLiveSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/matches/today", { cache: "no-store" });
      if (!resp.ok) throw new Error("API error");
      const data = await resp.json();
      const matches: LiveMatch[] = data.matches ?? [];

      const extracted: BettingPick[] = [];

      for (const m of matches) {
        const best = selectBestEvent(m, bankroll);
        if (best) extracted.push(best);
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

  // Filtrage par date
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
    selectedDateKey === "all" ? picks : dateGroups[selectedDateKey] ?? [];

  if (selectedMarketCat !== "all") {
    filteredPicks = filteredPicks.filter((p) => p.market_type === selectedMarketCat);
  }

  if (selectedLeague !== "all") {
    filteredPicks = filteredPicks.filter((p) => p.competition === selectedLeague);
  }

  const actionable = filteredPicks
    .filter((p) => !p.is_suspicious && p.odds >= 1.25 && p.odds <= 4.50)
    .sort((a, b) => b.model_probability - a.model_probability);

  // Groupement par Championnat
  const leagueGroups = actionable.reduce((acc, p) => {
    const comp = p.competition;
    if (!acc[comp]) acc[comp] = [];
    acc[comp].push(p);
    return acc;
  }, {} as Record<string, BettingPick[]>);

  const availableLeagues = Array.from(new Set(picks.map((p) => p.competition)));

  const totalStake = actionable.reduce(
    (s, p) => s + Math.round(bankroll * p.kelly_fraction),
    0
  );
  const totalExpectedProfit = actionable.reduce(
    (s, p) => s + Math.round(bankroll * p.kelly_fraction) * p.expected_value,
    0
  );

  const realCount = actionable.filter((p) => p.bookmaker !== "📊 Modèle Poisson").length;
  const statCount = actionable.filter((p) => p.bookmaker === "📊 Modèle Poisson").length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <PageHeader
            eyebrow="Rigueur Quantitative · Classement par Championnat"
            title="Panoplie de Paris Suggérés par Ligues & Équipes"
          />
          <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
            Sélection de l'événement optimal par match, structuré par championnat (PL, La Liga, MLS, Amicaux...) avec cotes réelles + modèle Poisson.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle de Mode d'Affichage */}
          <div className="flex items-center rounded-lg p-1" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <button
              onClick={() => setViewMode("league")}
              className="rounded-md px-3 py-1 text-xs font-semibold transition-all"
              style={{
                background: viewMode === "league" ? "var(--color-blue)" : "transparent",
                color: viewMode === "league" ? "#ffffff" : "var(--color-muted)",
              }}
            >
              🏆 Par Championnat
            </button>
            <button
              onClick={() => setViewMode("flat")}
              className="rounded-md px-3 py-1 text-xs font-semibold transition-all"
              style={{
                background: viewMode === "flat" ? "var(--color-blue)" : "transparent",
                color: viewMode === "flat" ? "#ffffff" : "var(--color-muted)",
              }}
            >
              🔥 Vue Liste
            </button>
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
      </div>

      <DateFilterBar
        options={filterOptions}
        selectedKey={selectedDateKey}
        onSelectKey={setSelectedDateKey}
      />

      {/* Barre de Filtre par Championnat */}
      <div className="mb-4 flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
        <span className="text-[11px] font-mono tracking-wide mr-1" style={{ color: "var(--color-muted)" }}>
          Championnat :
        </span>
        <button
          type="button"
          onClick={() => setSelectedLeague("all")}
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all"
          style={{
            background: selectedLeague === "all" ? "var(--color-text)" : "var(--color-surface-2)",
            color: selectedLeague === "all" ? "var(--color-ground)" : "var(--color-text)",
          }}
        >
          🌐 Tous ({picks.length})
        </button>

        {availableLeagues.map((league) => {
          const active = selectedLeague === league;
          const meta = LEAGUE_META[league] ?? { flag: "⚽", country: league };
          const count = picks.filter((p) => p.competition === league).length;

          return (
            <button
              key={league}
              type="button"
              onClick={() => setSelectedLeague(league)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all"
              style={{
                background: active ? "var(--color-amber)" : "var(--color-surface-2)",
                color: active ? "var(--color-ground)" : "var(--color-text)",
              }}
            >
              <span>{meta.flag}</span>
              <span>{league}</span>
              <span className="font-mono text-[10px] font-bold opacity-80">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Barre de Filtre par type de pari */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-mono tracking-wide mr-1" style={{ color: "var(--color-muted)" }}>
          Type de pari :
        </span>
        {MARKET_CATEGORY_FILTERS.map((cat) => {
          const active = selectedMarketCat === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setSelectedMarketCat(cat.key)}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all"
              style={{
                background: active ? "var(--color-blue)" : "var(--color-surface-2)",
                color: active ? "#ffffff" : "var(--color-text)",
              }}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Stat-cards résumé */}
      <div
        className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-xl p-5"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
            Total suggestions
          </div>
          <div className="mt-1 font-mono text-2xl font-bold">{actionable.length}</div>
        </div>
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
            Championnats actifs
          </div>
          <div className="mt-1 font-mono text-2xl font-bold" style={{ color: "var(--color-blue)" }}>
            {Object.keys(leagueGroups).length}
          </div>
        </div>
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
            Exposition Kelly
          </div>
          <div className="mt-1 font-mono text-2xl font-bold" style={{ color: "var(--color-amber)" }}>
            {totalStake}€
          </div>
        </div>
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
            Profit Espéré (+EV)
          </div>
          <div className="mt-1 font-mono text-2xl font-bold" style={{ color: "var(--color-success)" }}>
            +{totalExpectedProfit.toFixed(0)}€
          </div>
        </div>
      </div>

      {loading && (
        <div className="py-16 text-center">
          <div className="font-mono text-xl animate-pulse mb-2">⚽</div>
          <p className="text-sm font-medium">Analyse et structuration par championnat...</p>
        </div>
      )}

      {!loading && actionable.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium">Aucune suggestion qualifiée pour ces critères</p>
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
            Essayez de sélectionner un autre championnat ou réinitialiser les filtres.
          </p>
        </Card>
      )}

      {/* AFFICHAGE PAR CHAMPIONNAT (DEFAULT MODE) */}
      {!loading && actionable.length > 0 && viewMode === "league" && (
        <div className="space-y-6">
          {Object.entries(leagueGroups).map(([leagueName, leaguePicks]) => {
            const meta = LEAGUE_META[leagueName] ?? { flag: "⚽", country: leagueName };
            const isFriendlyComp = leagueName === "Matchs Amicaux" || leagueName.toLowerCase().includes("amical");

            const leagueStake = leaguePicks.reduce((s, p) => s + Math.round(bankroll * p.kelly_fraction), 0);
            const leagueProfit = leaguePicks.reduce((s, p) => s + Math.round(bankroll * p.kelly_fraction) * p.expected_value, 0);

            return (
              <div key={leagueName} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
                {/* En-tête du Championnat */}
                <div
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                  style={{
                    background: "var(--color-surface)",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{meta.flag}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-bold text-base leading-none">{leagueName}</h2>
                        {isFriendlyComp && (
                          <span
                            className="font-mono text-[10px] font-bold rounded-full px-2 py-0.5 uppercase tracking-wide"
                            style={{
                              background: "color-mix(in srgb, var(--color-amber) 15%, transparent)",
                              color: "var(--color-amber)",
                              border: "1px solid color-mix(in srgb, var(--color-amber) 30%, transparent)",
                            }}
                          >
                            🤝 Matchs Amicaux
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono" style={{ color: "var(--color-muted)" }}>
                        {meta.country} · {leaguePicks.length} match{leaguePicks.length > 1 ? "s" : ""} évalué{leaguePicks.length > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span style={{ color: "var(--color-muted)" }}>Engagement : </span>
                      <span className="font-mono font-bold" style={{ color: "var(--color-amber)" }}>{leagueStake}€</span>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-muted)" }}>+EV Espéré : </span>
                      <span className="font-mono font-bold" style={{ color: "var(--color-success)" }}>+{leagueProfit.toFixed(0)}€</span>
                    </div>
                  </div>
                </div>

                {/* Liste des matchs de ce championnat */}
                <Card className="rounded-none border-none">
                  {leaguePicks.map((pick, i) => (
                    <SuggestionRow key={pick.id} pick={pick} rank={i + 1} bankroll={bankroll} />
                  ))}
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* AFFICHAGE EN VUE LISTE PLATE */}
      {!loading && actionable.length > 0 && viewMode === "flat" && (
        <Card className="overflow-hidden">
          {actionable.map((pick, i) => (
            <SuggestionRow key={pick.id} pick={pick} rank={i + 1} bankroll={bankroll} />
          ))}
        </Card>
      )}
    </div>
  );
}
