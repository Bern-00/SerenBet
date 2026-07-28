"use client";

import { useState } from "react";
import { PageHeader, Card } from "@/components/ui";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { DateFilterBar, type DateFilterOption } from "@/components/date-filter-bar";
import { DEMO_PICKS } from "@/lib/demo-data";
import type { BettingPick, MarketCategory } from "@/lib/types";
import Link from "next/link";

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
      {/* Ligne principale de la suggestion */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {/* Rang */}
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
            {/* Tag Marché */}
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

            {/* Recommandation en une ligne */}
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

            {/* Sous-info */}
            <div
              className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
              style={{ color: "var(--color-muted)" }}
            >
              <span className="font-mono">🕒 {formatDate(pick.commence_time)}</span>
              <span>·</span>
              <span>Bookmaker : {pick.bookmaker}</span>
            </div>
          </div>
        </div>

        {/* Badges droite */}
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
          <span style={{ color: "var(--color-muted)" }}>Marché </span>
          <span className="font-mono font-semibold">
            {(pick.market_probability * 100).toFixed(0)}%
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

        {/* CTA placer */}
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
  const picks: BettingPick[] = DEMO_PICKS;

  // Filtrage par date
  const dateGroups = picks.reduce((acc, p) => {
    const key = formatDayKey(p.commence_time);
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {} as Record<string, BettingPick[]>);

  const dateKeys = Object.keys(dateGroups).sort();
  const [selectedDateKey, setSelectedDateKey] = useState<string>("all");
  const [selectedMarketCat, setSelectedMarketCat] = useState<string>("all");

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
            eyebrow="Suggestions Multi-Marchés 24h"
            title="Panoplie de Paris Suggérés du Jour"
          />
          <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
            Tous les matchs des Big Leagues (PL, La Liga, Ligue 1, Serie A, Champions League). Paris sur Vainqueur, Buts, Corners, Cartons et Tirs.
          </p>
        </div>
      </div>

      {/* Filtres 24h (Par Date) */}
      <DateFilterBar
        options={filterOptions}
        selectedKey={selectedDateKey}
        onSelectKey={setSelectedDateKey}
      />

      {/* Filtres par Catégorie de Marché (Buts, Corners, Cartons, Tirs...) */}
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

      {/* Récapitulatif d'exposition */}
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
            Suggestions sélectionnées
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
            Exposition totale Kelly
          </div>
          <div
            className="mt-1 font-mono text-2xl font-bold"
            style={{ color: "var(--color-amber)" }}
          >
            {totalStake}€
          </div>
          <div className="text-[11px]" style={{ color: "var(--color-muted)" }}>
            {((totalStake / bankroll) * 100).toFixed(1)}% de la bankroll
          </div>
        </div>
        <div>
          <div
            className="font-mono text-[11px] uppercase tracking-wide"
            style={{ color: "var(--color-muted)" }}
          >
            Profit espéré total
          </div>
          <div
            className="mt-1 font-mono text-2xl font-bold"
            style={{ color: "var(--color-success)" }}
          >
            +{totalExpectedProfit.toFixed(0)}€
          </div>
          <div className="text-[11px]" style={{ color: "var(--color-muted)" }}>
            en espérance mathématique
          </div>
        </div>
      </div>

      {/* Suggestions */}
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
    </div>
  );
}
