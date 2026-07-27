"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateValueBetStatus(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié.");

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!["detected", "placed", "skipped", "expired"].includes(status)) {
    throw new Error("Statut invalide.");
  }

  const { error } = await supabase
    .from("value_bets")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/value-bets");
}
