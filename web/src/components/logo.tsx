/**
 * Mark SerenBet : courbe de probabilité du modèle (bleu) qui s'écarte
 * d'une ligne de marché en pointillés (gris) — le point de divergence,
 * marqué en ambre, est "l'edge". Le concept central du produit, pas une
 * icône décorative.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M20,64 C36,64 36,28 50,28 C64,28 64,64 80,64"
        fill="none"
        stroke="var(--color-blue)"
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="50"
        x2="84"
        y2="50"
        stroke="var(--color-muted)"
        strokeWidth="2"
        strokeDasharray="4 5"
        opacity="0.5"
      />
      <line
        x1="62"
        y1="37"
        x2="70"
        y2="57"
        stroke="var(--color-amber)"
        strokeWidth="6.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({
  size = 28,
  wordmarkClassName = "text-lg",
}: {
  size?: number;
  wordmarkClassName?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className={`font-sans font-extrabold tracking-tight ${wordmarkClassName}`}>
        Seren<span style={{ color: "var(--color-amber)" }}>Bet</span>
      </span>
    </span>
  );
}
