"use client";

export type DateFilterOption = {
  key: string; // ISO date format YYYY-MM-DD ou "all" ou "today" ou "tomorrow"
  label: string; // ex: "Aujourd'hui (27 Jul)", "28 Jul", etc.
  count: number;
};

type DateFilterBarProps = {
  options: DateFilterOption[];
  selectedKey: string;
  onSelectKey: (key: string) => void;
};

export function DateFilterBar({
  options,
  selectedKey,
  onSelectKey,
}: DateFilterBarProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
      <span
        className="text-[11px] font-mono tracking-wide mr-1"
        style={{ color: "var(--color-muted)" }}
      >
        Filtre 24h :
      </span>
      {options.map((opt) => {
        const active = selectedKey === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onSelectKey(opt.key)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all"
            style={{
              background: active
                ? "var(--color-amber)"
                : "var(--color-surface)",
              color: active ? "var(--color-ground)" : "var(--color-text)",
              border: active
                ? "1px solid var(--color-amber)"
                : "1px solid var(--color-border)",
            }}
          >
            <span>{opt.label}</span>
            <span
              className="font-mono text-[10px] rounded-full px-1.5 py-0.2"
              style={{
                background: active
                  ? "color-mix(in srgb, var(--color-ground) 20%, transparent)"
                  : "var(--color-surface-2)",
                color: active ? "var(--color-ground)" : "var(--color-muted)",
              }}
            >
              {opt.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
