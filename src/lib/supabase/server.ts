import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseConfig } from "./config";

// Create a fresh client for each request, never a shared server singleton.
export async function createClient() {
  const { url, publishableKey } = requireSupabaseConfig();
  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. The proxy refreshes them
          // before rendering; Server Actions and Route Handlers can write here.
        }
      },
    },
  });
}
