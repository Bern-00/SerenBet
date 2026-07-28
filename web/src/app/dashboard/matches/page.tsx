"use client";

import { useState } from "react";
import { PageHeader, Card, Pill } from "@/components/ui";
import { ProbabilityBar } from "@/components/probability-bar";
import { MatchMarketPanoply } from "@/components/match-market-panoply";
import { DateFilterBar, type DateFilterOption } from "@/components/date-filter-bar";
import { DEMO_UPCOMING_MATCHES } from "@/lib/demo-data";
import type { UpcomingMatch } from "@/lib/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayKey(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
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

function formatOddsRow(label: string, odds: number, modelProb: number) {
  const implicitProb = 1 / odds;
  const edge = modelProb - implicitProb;
  return { label, odds, modelProb, implicitProb, edge };
}

function ValueBadge({ ev }: { ev: number | null }) {
  if (ev == null) return null;
  if (ev >= 0.06)
    return (
      <Pill tone="success">
        ✓ Value +{(ev * 100).toFixed(1)}%
      </Pill>
    );
  if (ev >= 0.03)
    return (
      <Pill tone="amber">
        ~ Neutre +{(ev * 100).toFixed(1)}%
      </Pill>
    );
  return <Pill tone="muted">Éviter</Pill>;
}

function MatchDetailCard({ match }: { match: UpcomingMatch }) {
  const rows = [
    formatOddsRow(
      match.home_team,
      match.market_odds.home,
      match.model_probs.home
    ),
    formatOddsRow("Nul", match.market_odds.draw, match.model_probs.draw),
    formatOddsRow(
      match.away_team,
      match.market_odds.away,
      match.model_probs.away
    ),
  ];
  const keys: Array<"home" | "draw" | "away"> = ["home", "draw", "away"];

  return (
    <Card className="overflow-hidden mb-6">
      {/* En-tête du match */}
      <div
        className="px-6 py-4"
        style={{ background: "var(--color-surface-2)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div
              className="font-mono text-[11px] tracking-widest uppercase"
              style={{ color: "var(--color-muted)" }}
            >
              {match.competition} · {match.sport}
            </div>
            <h3 className="mt-1 text-lg font-bold">
              {match.home_team}{" "}
              <span style={{ color: "var(--color-muted)" }}>vs</span>{" "}
              {match.away_team}
            </h3>
            <div
              className="mt-0.5 text-xs font-mono"
              style={{ color: "var(--color-muted)" }}
            >
              🕒 {formatDate(match.commence_time)} (Mise à jour 24h)
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <ValueBadge ev={match.best_ev} />
            {match.is_demo && <Pill tone="muted">démo réelles</Pill>}
          </div>
        </div>

        {/* Barre de probabilités 1X2 */}
        <div className="mt-4">
          <ProbabilityBar
            modelProbs={match.model_probs}
            marketOdds={match.market_odds}
            homeLabel={match.home_team.split(" ")[0]}
            awayLabel={match.away_team.split(" ").slice(-1)[0]}
            bestOutcome={match.best_outcome}
          />
        </div>
      </div>

      {/* Tableau cotes 1X2 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
              {["Résultat", "Cote marché", "Prob. implicite", "Prob. modèle", "Edge"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-5 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const key = keys[i];
              const isBest = match.best_outcome === key;
              return (
                <tr
                  key={row.label}
                  style={{
                    borderBottom: "1px solid var(--color-border)",
                    background: isBest
                      ? "color-mix(in srgb, var(--color-success) 5%, transparent)"
                      : undefined,
                  }}
                >
                  <td className="px-5 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      {row.label}
                      {isBest && (
                        <span
                          className="font-mono text-[10px] rounded-full px-1.5 py-0.5"
                          style={{
                            background:
                              "color-mix(in srgb, var(--color-success) 15%, transparent)",
                            color: "var(--color-success)",
                          }}
                        >
                          ← value
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono font-bold text-right">
                    {row.odds.toFixed(2)}
                  </td>
                  <td
                    className="px-5 py-3 font-mono text-right"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {(row.implicitProb * 100).toFixed(1)}%
                  </td>
                  <td
                    className="px-5 py-3 font-mono text-right font-semibold"
                    style={{ color: "var(--color-blue)" }}
                  >
                    {(row.modelProb * 100).toFixed(1)}%
                  </td>
                  <td
                    className="px-5 py-3 font-mono text-right font-semibold"
                    style={{
                      color:
                        row.edge > 0.06
                          ? "var(--color-success)"
                          : row.edge > 0.02
                            ? "var(--color-amber)"
                            : "var(--color-danger)",
                    }}
                  >
                    {row.edge >= 0 ? "+" : ""}
                    {(row.edge * 100).toFixed(1)}pp
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Panoplie complète de statistiques (Corners, Cartons, Fautes, Tirs, Hors-jeu) */}
      {match.stat_rates && (
        <div className="px-5 py-3 border-t" style={{ borderColor: "var(--color-border)" }}>
          <MatchMarketPanoply
            statRates={match.stat_rates}
            homeTeam={match.home_team}
            awayTeam={match.away_team}
          />
        </div>
      )}
    </Card>
  );
}

export default function MatchesPage() {
  const matches = DEMO_UPCOMING_MATCHES;

  // Calcul des groupes par date (YYYY-MM-DD)
  const dateGroups = matches.reduce((acc, m) => {
    const key = formatDayKey(m.commence_time);
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {} as Record<string, UpcomingMatch[]>);

  const dateKeys = Object.keys(dateGroups).sort();

  const [selectedDateKey, setSelectedDateKey] = useState<string>("all");

  const filterOptions: DateFilterOption[] = [
    { key: "all", label: "Tous les matchs", count: matches.length },
    ...dateKeys.map((key) => {
      const firstMatch = dateGroups[key][0];
      return {
        key,
        label: formatDayLabel(firstMatch.commence_time),
        count: dateGroups[key].length,
      };
    }),
  ];

  const filteredMatches =
    selectedDateKey === "all"
      ? matches
      : dateGroups[selectedDateKey] ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <PageHeader
            eyebrow="Calendrier 24h & Panoplie de Marchés"
            title="Matchs & Probabilités Avancées"
          />
          <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
            Fréquence de mise à jour : <span className="font-mono text-amber-500 font-semibold">Toutes les 24 heures</span>.
            Inclus : Buts, Corners, Cartons jaunes, Fautes, Tirs & Cadrés, Hors-jeu.
          </p>
        </div>
        <span
          className="rounded-full px-3 py-1.5 text-[11px] font-mono flex items-center gap-2"
          style={{
            background: "color-mix(in srgb, var(--color-blue) 12%, transparent)",
            color: "var(--color-blue)",
            border: "1px solid color-mix(in srgb, var(--color-blue) 30%, transparent)",
          }}
        >
          <span>🔄 Sync auto 24h active</span>
        </span>
      </div>

      {/* Barre de filtre de date (jour par jour) */}
      <DateFilterBar
        options={filterOptions}
        selectedKey={selectedDateKey}
        onSelectKey={setSelectedDateKey}
      />

      {/* Légende */}
      <div
        className="mb-6 flex flex-wrap items-center gap-4 rounded-lg px-5 py-3 text-[11px]"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <span style={{ color: "var(--color-muted)" }}>Visualisation :</span>
        <span
          className="flex items-center gap-1.5"
          style={{ color: "var(--color-blue)" }}
        >
          <span
            className="inline-block h-3 w-8 rounded-full"
            style={{ background: "var(--color-blue)" }}
          />
          Domicile
        </span>
        <span
          className="flex items-center gap-1.5"
          style={{ color: "var(--color-muted)" }}
        >
          <span
            className="inline-block h-3 w-8 rounded-full"
            style={{ background: "var(--color-muted)" }}
          />
          Nul
        </span>
        <span
          className="flex items-center gap-1.5"
          style={{ color: "var(--color-amber)" }}
        >
          <span
            className="inline-block h-3 w-8 rounded-full"
            style={{ background: "var(--color-amber)" }}
          />
          Extérieur
        </span>
        <span style={{ color: "var(--color-muted)" }} className="ml-auto font-mono">
          📊 Cliquer sur "Panoplie complète" dans chaque match pour déplier Corners, Cartons & Fautes
        </span>
      </div>

      {/* Liste des matchs filtrés */}
      <div>
        {filteredMatches.length === 0 ? (
          <div
            className="rounded-md border border-dashed p-12 text-center"
            style={{ borderColor: "var(--color-border)" }}
          >
            <p className="text-sm font-medium">Aucun match pour cette date</p>
            <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
              Sélectionnez une autre journée dans la barre de filtre.
            </p>
          </div>
        ) : (
          filteredMatches.map((match) => (
            <MatchDetailCard key={match.id} match={match} />
          ))
        )}
      </div>
    </div>
  );
}
