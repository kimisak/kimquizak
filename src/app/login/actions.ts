"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function signIn(_previous: string, form: FormData): Promise<string> {
  const ownerId = process.env.KIMQUIZAK_OWNER_USER_ID?.trim();
  if (!ownerId || !getSupabaseConfig()) return "Host login is not configured yet.";
  const email = form.get("email");
  const password = form.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    return "Enter your email and password.";
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || data.user?.id !== ownerId) {
      if (data.session) await supabase.auth.signOut({ scope: "local" });
      return "Unable to sign in with this account.";
    }
  } catch {
    return "Login is temporarily unavailable. Please try again.";
  }
  redirect("/account");
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("Could not sign out. Please try again.");
  redirect("/login");
}
