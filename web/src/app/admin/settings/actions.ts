"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié.");

  const starting_bankroll = Number(formData.get("starting_bankroll"));
  const kelly_multiplier = Number(formData.get("kelly_multiplier"));
  const max_stake_fraction = Number(formData.get("max_stake_fraction"));
  const stop_loss_fraction = Number(formData.get("stop_loss_fraction"));

  if (starting_bankroll <= 0) {
    throw new Error("La bankroll de départ doit être positive.");
  }
  if (kelly_multiplier <= 0 || kelly_multiplier > 1) {
    throw new Error("Le multiplicateur de Kelly doit être dans ]0, 1].");
  }
  if (max_stake_fraction <= 0 || max_stake_fraction > 1) {
    throw new Error("Le plafond de mise doit être dans ]0, 1].");
  }
  if (stop_loss_fraction <= 0 || stop_loss_fraction >= 1) {
    throw new Error("Le seuil de stop-loss doit être dans ]0, 1[.");
  }

  const { error } = await supabase.from("settings").upsert(
    {
      user_id: user.id,
      starting_bankroll,
      kelly_multiplier,
      max_stake_fraction,
      stop_loss_fraction,
    },
    { onConflict: "user_id" },
  );

  if (error) throw new Error(error.message);

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
}
