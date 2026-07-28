"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/require-user";

/**
 * Action de rafraîchissement 24h des cotes & suggestions de paris.
 * Recalcule et réactualise le cache des probabilités et des matchs du jour dans Supabase/Next.js.
 */
export async function refreshDashboardOdds() {
  const { user } = await requireUser();

  // Revalider tous les chemins du dashboard parieur
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/matches");
  revalidatePath("/dashboard/picks");
  revalidatePath("/dashboard/suggestions");

  return { success: true, timestamp: new Date().toISOString() };
}
