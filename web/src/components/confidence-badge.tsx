"use client";

import type { ConfidenceLevel } from "@/lib/types";

type ConfidenceBadgeProps = {
  level: ConfidenceLevel;
  showLabel?: boolean;
  size?: "sm" | "md";
};

const CONFIG = {
  high: {
    stars: 3,
    label: "Confiance élevée",
    color: "var(--color-success)",
    bg: "color-mix(in srgb, var(--color-success) 12%, transparent)",
  },
  medium: {
    stars: 2,
    label: "Confiance moyenne",
    color: "var(--color-amber)",
    bg: "color-mix(in srgb, var(--color-amber) 12%, transparent)",
  },
  low: {
    stars: 1,
    label: "Confiance faible",
    color: "var(--color-muted)",
    bg: "var(--color-surface-2)",
  },
} as const;

export function ConfidenceBadge({
  level,
  showLabel = false,
  size = "sm",
}: ConfidenceBadgeProps) {
  const cfg = CONFIG[level];
  const starSize = size === "md" ? "text-sm" : "text-[11px]";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono ${starSize}`}
      style={{ background: cfg.bg, color: cfg.color }}
      title={cfg.label}
    >
      {Array.from({ length: 3 }, (_, i) => (
        <span
          key={i}
          style={{ opacity: i < cfg.stars ? 1 : 0.25 }}
        >
          ★
        </span>
      ))}
      {showLabel && (
        <span className="ml-0.5 text-[10px] font-sans">{cfg.label}</span>
      )}
    </span>
  );
}
