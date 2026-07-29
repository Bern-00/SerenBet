import { redirect } from "next/navigation";
import { createClient } from "./server";

/**
 * Email de l'administrateur unique du système SerenBet.
 * Seul cet email a accès au panneau Admin (/admin).
 * Les autres comptes n'ont accès qu'au Dashboard Parieur (/dashboard).
 */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "waddlybernlouisjean@gmail.com";

/** Récupère l'utilisateur authentifié ou redirige vers /login. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase, user };
}

/**
 * Récupère l'utilisateur authentifié ET vérifie qu'il est admin.
 * Si l'utilisateur n'est pas admin, redirige vers /dashboard.
 * Usage : dans les layouts/pages /admin uniquement.
 */
export async function requireAdmin() {
  const { supabase, user } = await requireUser();

  if (user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    redirect("/dashboard");
  }

  return { supabase, user };
}

/** Retourne true si l'utilisateur connecté est l'admin. */
export async function isAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    return user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  } catch {
    return false;
  }
}
