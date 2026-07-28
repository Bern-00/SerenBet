import { requireUser } from "@/lib/supabase/require-user";
import { PageHeader } from "@/components/ui";
import { PickCard } from "@/components/pick-card";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { ValueBet, Settings, BettingPick } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";
import { DEMO_PICKS, valueBetToPick } from "@/lib/demo-data";

export default async function PicksPage() {
  const { supabase, user } = await requireUser();

  const [{ data: settingsRow }, { data: realValueBets }] = await Promise.all([
    supabase
      .from("settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle<Settings>(),
    supabase
      .from("value_bets")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "detected")
      .order("edge", { ascending: false })
      .returns<ValueBet[]>(),
  ]);

  const bankroll =
    settingsRow?.starting_bankroll ?? DEFAULT_SETTINGS.starting_bankroll;
  const kellyMult =
    settingsRow?.kelly_multiplier ?? DEFAULT_SETTINGS.kelly_multiplier;

  const realPicks = (realValueBets ?? []).map((vb) =>
    valueBetToPick(vb, bankroll, kellyMult)
  );
  const hasRealData = realPicks.length > 0;
  const picks: BettingPick[] = hasRealData ? realPicks : DEMO_PICKS;

  // Trier par EV décroissant
  const sorted = [...picks].sort((a, b) => b.expected_value - a.expected_value);

  const highConf = sorted.filter((p) => p.confidence === "high");
  const medConf = sorted.filter((p) => p.confidence === "medium");
  const lowConf = sorted.filter((p) => p.confidence === "low");

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <PageHeader eyebrow="Classement par EV" title="Top Picks" />
        {!hasRealData && (
          <span
            className="rounded-full px-3 py-1 text-[11px] font-mono"
            style={{
              background:
                "color-mix(in srgb, var(--color-muted) 10%, transparent)",
              color: "var(--color-muted)",
              border: "1px dashed var(--color-border)",
            }}
          >
            données illustratives
          </span>
        )}
      </div>

      {/* Résumé par niveau de confiance */}
      <div className="mb-6 flex flex-wrap gap-3">
        {[
          { level: "high" as const, picks: highConf, label: "Confiance élevée" },
          { level: "medium" as const, picks: medConf, label: "Confiance moyenne" },
          { level: "low" as const, picks: lowConf, label: "Confiance faible" },
        ].map(({ level, picks: ps, label }) => (
          <div
            key={level}
            className="flex items-center gap-2 rounded-full px-4 py-2"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <ConfidenceBadge level={level} />
            <span className="text-xs font-medium">{label}</span>
            <span
              className="font-mono text-xs font-bold"
              style={{ color: "var(--color-muted)" }}
            >
              × {ps.length}
            </span>
          </div>
        ))}
      </div>

      {/* Picks ★★★ */}
      {highConf.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <ConfidenceBadge level="high" size="md" />
            <h2 className="text-sm font-semibold">Confiance élevée</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {highConf.map((pick, i) => (
              <PickCard key={pick.id} pick={pick} rank={i + 1} />
            ))}
          </div>
        </section>
      )}

      {/* Picks ★★ */}
      {medConf.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <ConfidenceBadge level="medium" size="md" />
            <h2 className="text-sm font-semibold">Confiance moyenne</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {medConf.map((pick, i) => (
              <PickCard
                key={pick.id}
                pick={pick}
                rank={highConf.length + i + 1}
              />
            ))}
          </div>
        </section>
      )}

      {/* Picks ★ */}
      {lowConf.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <ConfidenceBadge level="low" size="md" />
            <h2 className="text-sm font-semibold">Confiance faible</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lowConf.map((pick, i) => (
              <PickCard
                key={pick.id}
                pick={pick}
                rank={highConf.length + medConf.length + i + 1}
              />
            ))}
          </div>
        </section>
      )}

      {picks.length === 0 && (
        <div
          className="rounded-md border border-dashed p-12 text-center"
          style={{ borderColor: "var(--color-border)" }}
        >
          <p className="text-sm font-medium">Aucun pick disponible</p>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--color-muted)" }}
          >
            Le moteur Python alimentera cette section après synchronisation.
          </p>
        </div>
      )}
    </div>
  );
}
