import { NextResponse } from "next/server";
import { getOwner } from "@/lib/auth/owner";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!await getOwner()) {
    return NextResponse.json({ error: "Sign in as the host to use Street View." }, {
      status: 401, headers: { "Cache-Control": "private, no-store" },
    });
  }
  // A deployment-scoped key takes precedence. Otherwise select the matching
  // environment's key; production must never fall back to the development key.
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim()
    || (process.env.NODE_ENV === "production"
      ? process.env.GOOGLE_MAPS_API_PROD_KEY?.trim()
      : process.env.GOOGLE_MAPS_API_DEV_KEY?.trim());
  if (!apiKey) {
    return NextResponse.json({ error: "Google Maps API key is not configured" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
  // Maps JavaScript API keys are sent to browsers by design. Restrict this key
  // to the app's HTTP referrers and the Maps JavaScript API in Google Cloud.
  return NextResponse.json({ apiKey }, { headers: { "Cache-Control": "private, no-store" } });
}
