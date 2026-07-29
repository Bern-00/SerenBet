"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "waddlybernlouisjean@gmail.com";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // Admin → panneau admin, tout autre compte → dashboard parieur uniquement
  if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    redirect("/admin");
  }
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(
    `/login?message=${encodeURIComponent(
      "Compte créé — vérifie ta boîte mail pour confirmer, puis connecte-toi.",
    )}`,
  );
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
