import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Client Supabase pour Server Components / Server Actions / Route Handlers.
 * `cookies()` est asynchrone depuis Next.js 15/16 — toujours `await`. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Appelé depuis un Server Component : sans effet, le proxy
            // (voir src/lib/supabase/session.ts) se charge du refresh.
          }
        },
      },
    },
  );
}
