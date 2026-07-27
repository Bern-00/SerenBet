import { requireUser } from "@/lib/supabase/require-user";
import { PageHeader, Card, StatCard, Pill, EmptyState } from "@/components/ui";
import { DEFAULT_SETTINGS, type BankrollEvent, type Settings } from "@/lib/types";
import { recordBet } from "./actions";

export default async function BankrollPage() {
  const { supabase, user } = await requireUser();

  const [{ data: settingsRow }, { data: events }] = await Promise.all([
    supabase
      .from("settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle<Settings>(),
    supabase
      .from("bankroll_events")
      .select("*")
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: false })
      .returns<BankrollEvent[]>(),
  ]);

  const startingBankroll = settingsRow?.starting_bankroll ?? DEFAULT_SETTINGS.starting_bankroll;
  const stopLossFraction = settingsRow?.stop_loss_fraction ?? DEFAULT_SETTINGS.stop_loss_fraction;
  const eventList = events ?? [];
  const currentBankroll = startingBankroll + eventList.reduce((sum, e) => sum + e.profit, 0);
  const drawdown = Math.max(0, 1 - currentBankroll / startingBankroll);
  const stopLossTriggered = currentBankroll <= startingBankroll * stopLossFraction;

  return (
    <div>
      <PageHeader eyebrow="Capital" title="Bankroll" />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Bankroll actuelle" value={`${currentBankroll.toFixed(2)}€`} />
        <StatCard label="Capital de départ" value={`${startingBankroll.toFixed(2)}€`} />
        <StatCard
          label="Drawdown"
          value={`${(drawdown * 100).toFixed(1)}%`}
          tone={drawdown > 0 ? "danger" : "default"}
        />
        <StatCard
          label="Stop-loss"
          value={stopLossTriggered ? "Déclenché" : "OK"}
          tone={stopLossTriggered ? "danger" : "success"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          {eventList.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="Aucun pari enregistré"
                description="Ajoute ton premier pari avec le formulaire à droite."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                    {["Date", "Description", "Mise", "Cote", "Résultat", "Profit"].map((h) => (
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
                  {eventList.map((event) => (
                    <tr key={event.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <td className="px-4 py-3" style={{ color: "var(--color-muted)" }}>
                        {new Date(event.occurred_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-4 py-3">{event.description}</td>
                      <td className="font-tabular px-4 py-3 text-right font-mono">
                        {event.stake.toFixed(2)}€
                      </td>
                      <td className="font-tabular px-4 py-3 text-right font-mono">
                        {event.odds.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <Pill
                          tone={
                            event.outcome === "win"
                              ? "success"
                              : event.outcome === "loss"
                                ? "danger"
                                : "muted"
                          }
                        >
                          {event.outcome}
                        </Pill>
                      </td>
                      <td
                        className="font-tabular px-4 py-3 text-right font-mono"
                        style={{
                          color:
                            event.profit > 0
                              ? "var(--color-success)"
                              : event.profit < 0
                                ? "var(--color-danger)"
                                : "var(--color-muted)",
                        }}
                      >
                        {event.profit > 0 ? "+" : ""}
                        {event.profit.toFixed(2)}€
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="h-fit p-5">
          <h2 className="text-sm font-semibold">Enregistrer un pari</h2>
          <form action={recordBet} className="mt-4 flex flex-col gap-3">
            <label className="text-xs" style={{ color: "var(--color-muted)" }}>
              Description
              <input
                type="text"
                name="description"
                required
                placeholder="Ex: Newcastle - Liverpool, domicile"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                style={{
                  background: "var(--color-surface-2)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs" style={{ color: "var(--color-muted)" }}>
                Mise (€)
                <input
                  type="number"
                  name="stake"
                  step="0.01"
                  min="0.01"
                  required
                  className="font-tabular mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm"
                  style={{
                    background: "var(--color-surface-2)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
              </label>
              <label className="text-xs" style={{ color: "var(--color-muted)" }}>
                Cote
                <input
                  type="number"
                  name="odds"
                  step="0.01"
                  min="1.01"
                  required
                  className="font-tabular mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm"
                  style={{
                    background: "var(--color-surface-2)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
              </label>
            </div>
            <label className="text-xs" style={{ color: "var(--color-muted)" }}>
              Résultat
              <select
                name="outcome"
                required
                defaultValue="pending"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                style={{
                  background: "var(--color-surface-2)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
              >
                <option value="pending">En attente</option>
                <option value="win">Gagné</option>
                <option value="loss">Perdu</option>
              </select>
            </label>
            <button
              type="submit"
              className="mt-2 rounded-md px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--color-amber)", color: "var(--color-ground)" }}
            >
              Ajouter
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
