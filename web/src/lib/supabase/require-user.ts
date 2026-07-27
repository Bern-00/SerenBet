import { redirect } from "next/navigation";
import { createClient } from "./server";

/** Récupère l'utilisateur authentifié ou redirige vers /login.
 *
 * Ne pas se fier uniquement au layout admin pour ça : Next.js peut lancer
 * le data-fetching d'une page avant que le redirect() du layout parent ait
 * pris effet, donc chaque page qui a besoin de l'utilisateur doit vérifier
 * elle-même (sinon crash sur `user!.id` avec un user null). */
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
