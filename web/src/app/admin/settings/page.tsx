import { requireUser } from "@/lib/supabase/require-user";
import { PageHeader, Card } from "@/components/ui";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/types";
import { saveSettings } from "./actions";

function Field({
  label,
  name,
  defaultValue,
  step,
  min,
  max,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: number;
  step: string;
  min: string;
  max: string;
  hint: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="number"
        name={name}
        defaultValue={defaultValue}
        step={step}
        min={min}
        max={max}
        required
        className="font-tabular mt-1.5 w-full rounded-md border px-3 py-2 font-mono text-sm"
        style={{
          background: "var(--color-surface-2)",
          borderColor: "var(--color-border)",
          color: "var(--color-text)",
        }}
      />
      <span className="mt-1 block text-xs" style={{ color: "var(--color-muted)" }}>
        {hint}
      </span>
    </label>
  );
}

export default async function SettingsPage() {
  const { supabase, user } = await requireUser();

  const { data } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<Settings>();

  const settings = data ?? DEFAULT_SETTINGS;

  return (
    <div>
      <PageHeader eyebrow="Configuration" title="Réglages" />

      <Card className="max-w-xl p-6">
        <form action={saveSettings} className="flex flex-col gap-5">
          <Field
            label="Bankroll de départ"
            name="starting_bankroll"
            defaultValue={settings.starting_bankroll}
            step="1"
            min="1"
            max="10000000"
            hint="Capital de référence pour le calcul du drawdown et du stop-loss."
          />
          <Field
            label="Multiplicateur de Kelly"
            name="kelly_multiplier"
            defaultValue={settings.kelly_multiplier}
            step="0.05"
            min="0.01"
            max="1"
            hint="Fraction du Kelly plein appliquée (0.25 = quart de Kelly, réduit la variance)."
          />
          <Field
            label="Plafond de mise"
            name="max_stake_fraction"
            defaultValue={settings.max_stake_fraction}
            step="0.01"
            min="0.01"
            max="1"
            hint="Jamais plus que cette fraction de la bankroll sur un seul pari."
          />
          <Field
            label="Seuil de stop-loss"
            name="stop_loss_fraction"
            defaultValue={settings.stop_loss_fraction}
            step="0.05"
            min="0.05"
            max="0.95"
            hint="Arrêt des mises recommandées si la bankroll tombe sous cette fraction du capital de départ."
          />

          <button
            type="submit"
            className="mt-2 self-start rounded-md px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: "var(--color-amber)", color: "var(--color-ground)" }}
          >
            Enregistrer
          </button>
        </form>
      </Card>
    </div>
  );
}
