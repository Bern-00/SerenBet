"use client";

/**
 * ProbabilityBar — Barre visuelle de probabilités 1X2
 * Montre 3 segments colorés : domicile (bleu), nul (gris), extérieur (ambre)
 * La barre du bas montre la probabilité implicite du marché (ligne pointillée).
 */

type ProbabilityBarProps = {
  modelProbs: { home: number; draw: number; away: number };
  marketOdds?: { home: number; draw: number; away: number };
  homeLabel?: string;
  awayLabel?: string;
  bestOutcome?: "home" | "draw" | "away" | null;
};

function oddsToProb(odds: number): number {
  return 1 / odds;
}

function normalizeProbs(probs: {
  home: number;
  draw: number;
  away: number;
}): { home: number; draw: number; away: number } {
  const total = probs.home + probs.draw + probs.away;
  return {
    home: probs.home / total,
    draw: probs.draw / total,
    away: probs.away / total,
  };
}

export function ProbabilityBar({
  modelProbs,
  marketOdds,
  homeLabel = "Dom.",
  awayLabel = "Ext.",
  bestOutcome,
}: ProbabilityBarProps) {
  const norm = normalizeProbs(modelProbs);

  const marketProbs = marketOdds
    ? normalizeProbs({
        home: oddsToProb(marketOdds.home),
        draw: oddsToProb(marketOdds.draw),
        away: oddsToProb(marketOdds.away),
      })
    : null;

  const segments: Array<{
    key: "home" | "draw" | "away";
    value: number;
    color: string;
    label: string;
  }> = [
    {
      key: "home",
      value: norm.home,
      color: "var(--color-blue)",
      label: homeLabel,
    },
    {
      key: "draw",
      value: norm.draw,
      color: "var(--color-muted)",
      label: "Nul",
    },
    {
      key: "away",
      value: norm.away,
      color: "var(--color-amber)",
      label: awayLabel,
    },
  ];

  return (
    <div className="space-y-2">
      {/* Labels */}
      <div className="flex justify-between text-[11px]" style={{ color: "var(--color-muted)" }}>
        {segments.map((s) => (
          <span
            key={s.key}
            className="font-mono font-semibold"
            style={{
              color:
                bestOutcome === s.key ? s.color : "var(--color-muted)",
            }}
          >
            {s.label} {(s.value * 100).toFixed(0)}%
          </span>
        ))}
      </div>

      {/* Barre modèle */}
      <div
        className="relative flex h-5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--color-surface-2)" }}
        title="Probabilités du modèle"
      >
        {segments.map((s, i) => (
          <div
            key={s.key}
            className="relative h-full transition-all duration-500"
            style={{
              width: `${s.value * 100}%`,
              background: s.color,
              opacity: bestOutcome && bestOutcome !== s.key ? 0.45 : 1,
              borderRadius:
                i === 0
                  ? "9999px 0 0 9999px"
                  : i === segments.length - 1
                    ? "0 9999px 9999px 0"
                    : "0",
            }}
          >
            {/* Ring de mise en évidence sur le best outcome */}
            {bestOutcome === s.key && (
              <div
                className="absolute inset-0"
                style={{
                  boxShadow: `inset 0 0 0 2px rgba(255,255,255,0.4)`,
                  borderRadius: "inherit",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Barre marché (fine, sous la principale) */}
      {marketProbs && (
        <>
          <div
            className="relative flex h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: "var(--color-surface-2)" }}
            title="Probabilité implicite du marché"
          >
            {segments.map((s, i) => (
              <div
                key={s.key}
                className="h-full transition-all duration-500"
                style={{
                  width: `${marketProbs[s.key] * 100}%`,
                  background: s.color,
                  opacity: 0.35,
                  borderRadius:
                    i === 0
                      ? "9999px 0 0 9999px"
                      : i === segments.length - 1
                        ? "0 9999px 9999px 0"
                        : "0",
                }}
              />
            ))}
          </div>
          <div
            className="text-[10px]"
            style={{ color: "var(--color-muted)", opacity: 0.7 }}
          >
            Barre fine = probabilité implicite marché
          </div>
        </>
      )}
    </div>
  );
}
