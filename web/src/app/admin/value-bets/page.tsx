import { requireUser } from "@/lib/supabase/require-user";
import { PageHeader, Card, Pill, EmptyState } from "@/components/ui";
import type { ValueBet } from "@/lib/types";
import { updateValueBetStatus } from "./actions";

const STATUS_TONE: Record<ValueBet["status"], "amber" | "success" | "muted" | "danger"> = {
  detected: "amber",
  placed: "success",
  skipped: "muted",
  expired: "danger",
};

export default async function ValueBetsPage() {
  const { supabase, user } = await requireUser();

  const { data } = await supabase
    .from("value_bets")
    .select("*")
    .eq("user_id", user.id)
    .order("detected_at", { ascending: false })
    .returns<ValueBet[]>();

  const valueBets = data ?? [];

  return (
    <div>
      <PageHeader eyebrow="Comparateur marché" title="Value bets" />

      <Card>
        {valueBets.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Aucun value bet enregistré"
              description="Les détections du moteur Python (find_value_bets) apparaîtront ici une fois synchronisées avec Supabase."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  {["Match", "Marché", "Cote", "Modèle", "Edge", "EV", "Statut", ""].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[11px] font-semibold tracking-wide uppercase"
                      style={{ color: "var(--color-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {valueBets.map((vb) => (
                  <tr key={vb.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {vb.home_team} – {vb.away_team}
                      </div>
                      <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                        {vb.competition ?? vb.sport}
                        {vb.bookmaker ? ` · ${vb.bookmaker}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize">{vb.outcome}</td>
                    <td className="font-tabular px-4 py-3 text-right font-mono">
                      {vb.odds.toFixed(2)}
                    </td>
                    <td className="font-tabular px-4 py-3 text-right font-mono">
                      {(vb.model_probability * 100).toFixed(1)}%
                    </td>
                    <td
                      className="font-tabular px-4 py-3 text-right font-mono"
                      style={{ color: "var(--color-success)" }}
                    >
                      +{(vb.edge * 100).toFixed(1)}pp
                    </td>
                    <td
                      className="font-tabular px-4 py-3 text-right font-mono"
                      style={{ color: "var(--color-success)" }}
                    >
                      {vb.expected_value >= 0 ? "+" : ""}
                      {(vb.expected_value * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <Pill tone={STATUS_TONE[vb.status]}>{vb.status}</Pill>
                        {vb.is_suspicious && <Pill tone="danger">edge suspect</Pill>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {vb.status === "detected" && (
                        <div className="flex gap-2">
                          <form action={updateValueBetStatus}>
                            <input type="hidden" name="id" value={vb.id} />
                            <input type="hidden" name="status" value="placed" />
                            <button
                              type="submit"
                              className="text-xs font-medium"
                              style={{ color: "var(--color-success)" }}
                            >
                              Placé
                            </button>
                          </form>
                          <form action={updateValueBetStatus}>
                            <input type="hidden" name="id" value={vb.id} />
                            <input type="hidden" name="status" value="skipped" />
                            <button
                              type="submit"
                              className="text-xs"
                              style={{ color: "var(--color-muted)" }}
                            >
                              Ignorer
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
