import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Google Maps API key is not configured" }, { status: 503 });
  }
  // Maps JavaScript API keys are sent to browsers by design. Restrict this key
  // to the app's HTTP referrers and the Maps JavaScript API in Google Cloud.
  return NextResponse.json({ apiKey }, { headers: { "Cache-Control": "no-store" } });
}
