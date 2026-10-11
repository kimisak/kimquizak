import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function getOwner() {
  const ownerId = process.env.KIMQUIZAK_OWNER_USER_ID?.trim();
  if (!ownerId || !getSupabaseConfig()) return null;
  const supabase = await createClient();
  // Ask Auth for current identity, including whether the user still exists.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.id !== ownerId) return null;
  return { supabase, userId: data.user.id };
}
