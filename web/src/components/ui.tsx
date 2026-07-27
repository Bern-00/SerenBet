export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border ${className}`}
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "success" | "danger";
}) {
  const color =
    tone === "success"
      ? "var(--color-success)"
      : tone === "danger"
        ? "var(--color-danger)"
        : "var(--color-text)";
  return (
    <div
      className="rounded-md border p-4"
      style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)" }}
    >
      <div className="text-[11px] tracking-wide" style={{ color: "var(--color-muted)" }}>
        {label}
      </div>
      <div className="font-tabular mt-1.5 font-mono text-xl" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

const PILL_TONES = {
  amber: {
    bg: "color-mix(in srgb, var(--color-amber) 15%, transparent)",
    fg: "var(--color-amber)",
  },
  muted: { bg: "var(--color-surface-2)", fg: "var(--color-muted)" },
  success: {
    bg: "color-mix(in srgb, var(--color-success) 15%, transparent)",
    fg: "var(--color-success)",
  },
  danger: {
    bg: "color-mix(in srgb, var(--color-danger) 15%, transparent)",
    fg: "var(--color-danger)",
  },
} as const;

export function Pill({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: keyof typeof PILL_TONES;
}) {
  const s = PILL_TONES[tone];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px]"
      style={{ background: s.bg, color: s.fg }}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      className="rounded-md border border-dashed p-8 text-center"
      style={{ borderColor: "var(--color-border)" }}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
        {description}
      </p>
    </div>
  );
}

export function PageHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6">
      <div
        className="font-mono text-[11px] tracking-widest uppercase"
        style={{ color: "var(--color-muted)" }}
      >
        {eyebrow}
      </div>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
    </div>
  );
}
