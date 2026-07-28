import type { BettingPick } from "@/lib/types";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { Pill } from "@/components/ui";
import Link from "next/link";

type PickCardProps = {
  pick: BettingPick;
  rank?: number; // position dans le classement (1, 2, 3…)
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

export function PickCard({ pick, rank }: PickCardProps) {
  const evColor =
    pick.expected_value >= 0.07
      ? "var(--color-success)"
      : pick.expected_value >= 0.04
        ? "var(--color-amber)"
        : "var(--color-muted)";

  return (
    <div
      className="group relative rounded-xl border p-5 transition-all duration-200 hover:shadow-lg"
      style={{
        background: "var(--color-surface)",
        borderColor:
          pick.confidence === "high"
            ? "color-mix(in srgb, var(--color-success) 35%, var(--color-border))"
            : "var(--color-border)",
      }}
    >
      {/* Rang + badges */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {rank && (
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold"
              style={{
                background:
                  rank === 1
                    ? "var(--color-amber)"
                    : rank === 2
                      ? "var(--color-surface-2)"
                      : "var(--color-surface-2)",
                color:
                  rank === 1 ? "var(--color-ground)" : "var(--color-muted)",
              }}
            >
              {rank}
            </span>
          )}
          <div>
            <div className="text-[11px] font-mono tracking-wide" style={{ color: "var(--color-muted)" }}>
              {pick.competition}
            </div>
            <div className="mt-0.5 font-semibold text-sm leading-snug">
              {pick.home_team} – {pick.away_team}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ConfidenceBadge level={pick.confidence} />
          {pick.is_demo && (
            <Pill tone="muted">démo</Pill>
          )}
          {pick.is_suspicious && (
            <Pill tone="danger">suspect</Pill>
          )}
        </div>
      </div>

      {/* Suggestion principale */}
      <div
        className="mb-4 rounded-lg px-4 py-3"
        style={{ background: "var(--color-surface-2)" }}
      >
        <div className="text-[11px] uppercase tracking-widest font-mono mb-1" style={{ color: "var(--color-muted)" }}>
          Suggestion
        </div>
        <div className="font-semibold text-sm">
          <span style={{ color: "var(--color-amber)" }}>{pick.outcome_label}</span>
          {" "}
          <span
            className="font-mono font-bold"
            style={{ color: "var(--color-text)" }}
          >
            @{pick.odds.toFixed(2)}
          </span>
          {" "}
          <span style={{ color: "var(--color-muted)" }}>via {pick.bookmaker}</span>
        </div>
        <div className="mt-1 text-[11px]" style={{ color: "var(--color-muted)" }}>
          {formatDate(pick.commence_time)}
        </div>
      </div>

      {/* Métriques */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="font-mono text-xs font-bold" style={{ color: "var(--color-blue)" }}>
            {(pick.model_probability * 100).toFixed(0)}%
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: "var(--color-muted)" }}>Modèle</div>
        </div>
        <div>
          <div className="font-mono text-xs font-bold" style={{ color: "var(--color-muted)" }}>
            {(pick.market_probability * 100).toFixed(0)}%
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: "var(--color-muted)" }}>Marché</div>
        </div>
        <div>
          <div className="font-mono text-xs font-bold" style={{ color: "var(--color-success)" }}>
            +{(pick.edge * 100).toFixed(1)}pp
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: "var(--color-muted)" }}>Edge</div>
        </div>
        <div>
          <div className="font-mono text-xs font-bold" style={{ color: evColor }}>
            {pick.expected_value >= 0 ? "+" : ""}{(pick.expected_value * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: "var(--color-muted)" }}>EV</div>
        </div>
      </div>

      {/* Mise Kelly */}
      <div
        className="mt-4 flex items-center justify-between rounded-lg px-4 py-2.5"
        style={{
          background: "color-mix(in srgb, var(--color-amber) 8%, transparent)",
          border: "1px solid color-mix(in srgb, var(--color-amber) 20%, transparent)",
        }}
      >
        <div>
          <span
            className="text-[11px] font-mono"
            style={{ color: "var(--color-amber)" }}
          >
            Mise Kelly suggérée
          </span>
          <span
            className="ml-2 font-mono text-sm font-bold"
            style={{ color: "var(--color-amber)" }}
          >
            {pick.kelly_stake_euros}€
          </span>
          <span
            className="ml-1 text-[10px]"
            style={{ color: "var(--color-muted)" }}
          >
            ({(pick.kelly_fraction * 100).toFixed(1)}% bankroll)
          </span>
        </div>
        <Link
          href="/admin/value-bets"
          className="text-[11px] font-semibold rounded-md px-3 py-1 transition-opacity hover:opacity-80"
          style={{
            background: "var(--color-amber)",
            color: "var(--color-ground)",
          }}
        >
          Placer →
        </Link>
      </div>
    </div>
  );
}
