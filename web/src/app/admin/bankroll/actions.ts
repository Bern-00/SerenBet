"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS, type BankrollEvent, type Settings } from "@/lib/types";

export async function recordBet(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié.");

  const description = String(formData.get("description") ?? "").trim();
  const stake = Number(formData.get("stake"));
  const odds = Number(formData.get("odds"));
  const outcome = String(formData.get("outcome") ?? "");

  if (!description) throw new Error("Description requise.");
  if (!(stake > 0)) throw new Error("La mise doit être positive.");
  if (!(odds > 1)) throw new Error("La cote doit être > 1.");
  if (!["win", "loss", "pending"].includes(outcome)) {
    throw new Error("Résultat invalide.");
  }

  const [{ data: settingsRow }, { data: events }] = await Promise.all([
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
  ]);

  const startingBankroll = settingsRow?.starting_bankroll ?? DEFAULT_SETTINGS.starting_bankroll;
  const currentBankroll =
    startingBankroll + (events ?? []).reduce((sum, e) => sum + e.profit, 0);

  if (stake > currentBankroll) {
    throw new Error("La mise dépasse la bankroll actuelle.");
  }

  const profit =
    outcome === "win" ? stake * (odds - 1) : outcome === "loss" ? -stake : 0;
  const bankrollAfter = outcome === "pending" ? null : currentBankroll + profit;

  const { error } = await supabase.from("bankroll_events").insert({
    user_id: user.id,
    description,
    stake,
    odds,
    outcome,
    profit,
    bankroll_after: bankrollAfter,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/bankroll");
  revalidatePath("/admin");
}
