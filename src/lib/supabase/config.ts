export function getSupabaseConfig() {
  // Direct property access lets Next.js substitute the public browser values.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function requireSupabaseConfig() {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to enable Supabase.");
  }
  return config;
}
