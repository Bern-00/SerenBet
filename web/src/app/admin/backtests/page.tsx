import { requireUser } from "@/lib/supabase/require-user";
import { PageHeader, Card, Pill, EmptyState } from "@/components/ui";
import type { BacktestRun } from "@/lib/types";

export default async function BacktestsPage() {
  const { supabase, user } = await requireUser();

  const { data } = await supabase
    .from("backtest_runs")
    .select("*")
    .eq("user_id", user.id)
    .order("run_at", { ascending: false })
    .returns<BacktestRun[]>();

  const runs = data ?? [];

  return (
    <div>
      <PageHeader eyebrow="Validation du modèle" title="Backtests" />

      <Card>
        {runs.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Aucun backtest enregistré"
              description="Les résultats de engine/scripts/run_*_backtest.py apparaîtront ici une fois synchronisés avec Supabase."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  {[
                    "Date",
                    "Compétition",
                    "Méthode",
                    "Matchs test",
                    "Log-loss modèle",
                    "Log-loss baseline",
                    "Accuracy",
                    "Verdict",
                  ].map((h) => (
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
                {runs.map((run) => (
                  <tr key={run.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td className="px-4 py-3" style={{ color: "var(--color-muted)" }}>
                      {new Date(run.run_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      {run.competition ?? run.sport}
                      {run.season ? ` · ${run.season}` : ""}
                    </td>
                    <td className="px-4 py-3 capitalize">{run.method.replace("_", " ")}</td>
                    <td className="font-tabular px-4 py-3 text-right font-mono">
                      {run.n_test_matches ?? "—"}
                    </td>
                    <td className="font-tabular px-4 py-3 text-right font-mono">
                      {run.model_log_loss?.toFixed(4) ?? "—"}
                    </td>
                    <td className="font-tabular px-4 py-3 text-right font-mono">
                      {run.baseline_log_loss?.toFixed(4) ?? "—"}
                    </td>
                    <td className="font-tabular px-4 py-3 text-right font-mono">
                      {run.model_accuracy != null ? `${(run.model_accuracy * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {run.beats_baseline == null ? (
                        <Pill tone="muted">n/a</Pill>
                      ) : run.beats_baseline ? (
                        <Pill tone="success">bat le baseline</Pill>
                      ) : (
                        <Pill tone="danger">ne bat pas le baseline</Pill>
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
