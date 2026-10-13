import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();
  const isAccount = request.nextUrl.pathname === "/account" || request.nextUrl.pathname.startsWith("/account/");
  const loginRedirect = () => {
    const result = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.getAll().forEach(cookie => result.cookies.set(cookie));
    result.headers.set("Cache-Control", "private, no-store");
    return result;
  };
  // Public/local play remains available without cloud configuration.
  if (!config) return isAccount ? loginRedirect() : response;

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookieOptions: { secure: process.env.NODE_ENV === "production" },
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

  // Redirect before rendering AccountPage: React's development performance tracks
  // can fail on aborted async components. Page and API owner checks remain in place.
  if (isAccount) {
    const ownerId = process.env.KIMQUIZAK_OWNER_USER_ID?.trim();
    const { data, error } = await supabase.auth.getUser();
    if (error || !ownerId || !data.user || data.user.id !== ownerId) return loginRedirect();
  } else {
    await supabase.auth.getClaims();
  }
  return response;
}
