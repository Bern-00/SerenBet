import Link from "next/link";
import { requireUser } from "@/lib/supabase/require-user";
import { PageHeader, Card, StatCard, Pill, EmptyState } from "@/components/ui";
import {
  DEFAULT_SETTINGS,
  type BacktestRun,
  type BankrollEvent,
  type Settings,
  type ValueBet,
} from "@/lib/types";

export default async function AdminOverviewPage() {
  const { supabase, user } = await requireUser();

  const [{ data: settingsRow }, { data: events }, { data: openValueBets }, { data: lastBacktest }] =
    await Promise.all([
      supabase
        .from("settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle<Settings>(),
      supabase
        .from("bankroll_events")
        .select("profit")
        .eq("user_id", user.id)
        .returns<Pick<BankrollEvent, "profit">[]>(),
      supabase
        .from("value_bets")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "detected")
        .order("detected_at", { ascending: false })
        .returns<ValueBet[]>(),
      supabase
        .from("backtest_runs")
        .select("*")
        .eq("user_id", user.id)
        .order("run_at", { ascending: false })
        .limit(1)
        .maybeSingle<BacktestRun>(),
    ]);

  const startingBankroll = settingsRow?.starting_bankroll ?? DEFAULT_SETTINGS.starting_bankroll;
  const currentBankroll =
    startingBankroll + (events ?? []).reduce((sum, e) => sum + e.profit, 0);
  const drawdown = Math.max(0, 1 - currentBankroll / startingBankroll);
  const valueBets = openValueBets ?? [];
  const edge =
    lastBacktest?.baseline_log_loss != null && lastBacktest?.model_log_loss != null
      ? lastBacktest.baseline_log_loss - lastBacktest.model_log_loss
      : null;

  return (
    <div>
      <PageHeader eyebrow="Tableau de bord" title="Vue d'ensemble" />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Bankroll" value={`${currentBankroll.toFixed(2)}€`} />
        <StatCard
          label="Edge dernier backtest (log-loss)"
          value={edge != null ? `${edge >= 0 ? "+" : ""}${edge.toFixed(3)}` : "—"}
          tone={edge != null ? (edge > 0 ? "success" : "danger") : "default"}
        />
        <StatCard label="Value bets ouverts" value={valueBets.length} />
        <StatCard
          label="Drawdown"
          value={`${(drawdown * 100).toFixed(1)}%`}
          tone={drawdown > 0 ? "danger" : "default"}
        />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Value bets détectés</h2>
        <Link href="/admin/value-bets" className="text-xs" style={{ color: "var(--color-muted)" }}>
          Tout voir →
        </Link>
      </div>
      <Card>
        {valueBets.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Aucun value bet ouvert"
              description="Rien à examiner pour l'instant."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  {["Match", "Marché", "Cote", "EV", "Statut"].map((h) => (
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
                {valueBets.slice(0, 5).map((vb) => (
                  <tr key={vb.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td className="px-4 py-3">
                      {vb.home_team} – {vb.away_team}
                    </td>
                    <td className="px-4 py-3 capitalize">{vb.outcome}</td>
                    <td className="font-tabular px-4 py-3 text-right font-mono">
                      {vb.odds.toFixed(2)}
                    </td>
                    <td
                      className="font-tabular px-4 py-3 text-right font-mono"
                      style={{ color: "var(--color-success)" }}
                    >
                      +{(vb.expected_value * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone={vb.is_suspicious ? "danger" : "amber"}>
                        {vb.is_suspicious ? "edge suspect" : "value"}
                      </Pill>
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
