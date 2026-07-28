"use client";

import { useState } from "react";
import {
  computeFullMarketPanoply,
  type StatMarketItem,
  type FullMatchMarkets,
} from "@/lib/statistical-model";
import type { DetailedMatchStatsRates } from "@/lib/types";

type MatchMarketPanoplyProps = {
  statRates: DetailedMatchStatsRates;
  homeTeam: string;
  awayTeam: string;
};

const CATEGORY_TABS: Array<{
  key: keyof FullMatchMarkets;
  label: string;
  icon: string;
}> = [
  { key: "goals", label: "Buts & Over/Under", icon: "⚽" },
  { key: "corners", label: "Corners", icon: "🚩" },
  { key: "cards", label: "Cartons Jaunes", icon: "🟨" },
  { key: "fouls", label: "Fautes", icon: "🛑" },
  { key: "shots", label: "Tirs & Cadrés", icon: "🎯" },
  { key: "offsides", label: "Hors-jeu", icon: "🚩" },
];

export function MatchMarketPanoply({
  statRates,
  homeTeam,
  awayTeam,
}: MatchMarketPanoplyProps) {
  const [activeTab, setActiveTab] = useState<keyof FullMatchMarkets>("goals");
  const [isOpen, setIsOpen] = useState(false);

  const fullMarkets = computeFullMarketPanoply(statRates);
  const items: StatMarketItem[] = fullMarkets[activeTab] ?? [];

  return (
    <div
      className="mt-3 rounded-lg border overflow-hidden"
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      {/* Bouton pour développer / réduire la panoplie */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left text-xs font-semibold transition-colors hover:bg-[var(--color-surface-2)]"
      >
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-[11px] rounded-full px-2 py-0.5"
            style={{
              background:
                "color-mix(in srgb, var(--color-blue) 15%, transparent)",
              color: "var(--color-blue)",
            }}
          >
            Modèle Poisson Advanced
          </span>
          <span>Panoplie complète de probabilités & marchés</span>
        </div>
        <span
          className="font-mono text-xs transition-transform duration-200"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            color: "var(--color-muted)",
          }}
        >
          ▼
        </span>
      </button>

      {/* Contenu de la panoplie quand ouvert */}
      {isOpen && (
        <div className="p-4 border-t" style={{ borderColor: "var(--color-border)" }}>
          {/* Onglets de catégories */}
          <div className="mb-4 flex flex-wrap gap-1.5 border-b pb-3" style={{ borderColor: "var(--color-border)" }}>
            {CATEGORY_TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: active
                      ? "var(--color-amber)"
                      : "var(--color-surface-2)",
                    color: active
                      ? "var(--color-ground)"
                      : "var(--color-muted)",
                  }}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Grille de marchés pour l'onglet actif */}
          <div className="grid gap-2.5 sm:grid-cols-2">
            {items.map((item, idx) => {
              const probPercent = (item.modelProb * 100).toFixed(1);
              return (
                <div
                  key={idx}
                  className="rounded-md border p-3"
                  style={{
                    background: "var(--color-surface-2)",
                    borderColor: "var(--color-border)",
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div
                        className="text-[10px] font-mono tracking-wide"
                        style={{ color: "var(--color-muted)" }}
                      >
                        {item.marketName}
                      </div>
                      <div className="font-semibold text-xs mt-0.5">
                        {item.selection}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className="font-mono text-sm font-bold"
                        style={{ color: "var(--color-blue)" }}
                      >
                        {probPercent}%
                      </div>
                      <div
                        className="text-[10px] font-mono"
                        style={{ color: "var(--color-muted)" }}
                      >
                        Cote équitable @{item.fairOdds.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Barre de probabilité */}
                  <div
                    className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
                    style={{ background: "var(--color-ground)" }}
                  >
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${probPercent}%`,
                        background:
                          item.modelProb > 0.6
                            ? "var(--color-success)"
                            : item.modelProb > 0.4
                              ? "var(--color-blue)"
                              : "var(--color-amber)",
                      }}
                    />
                  </div>

                  <div
                    className="mt-1 flex justify-between text-[10px]"
                    style={{ color: "var(--color-muted)" }}
                  >
                    <span>Moyenne attendue (λ) : {item.expectedValue.toFixed(1)}</span>
                    <span>Modèle Poisson</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
