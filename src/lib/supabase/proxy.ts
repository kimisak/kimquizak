import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();
  // Keep the existing local/demo app usable without cloud configuration.
  // Private routes must enforce their own verified owner checks when added.
  if (!config) return response;

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        // Preserve prior cookie writes if the SDK performs more than one batch.
        const previousCookies = response.cookies.getAll();
        response = NextResponse.next({ request });
        previousCookies.forEach(cookie => response.cookies.set(cookie));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        response.headers.set("Cache-Control", "private, no-store");
        response.headers.set("Pragma", "no-cache");
        response.headers.set("Expires", "0");
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  // Verify/refresh tokens; constructing a client or reading getSession() alone
  // does not provide verified identity. This helper is not an access guard.
  await supabase.auth.getClaims();
  return response;
}
