import { NextRequest, NextResponse } from "next/server";
import { isGoogleMapsShortLink, parseStreetViewSource } from "@/lib/geoguesser";

function allowedGoogleMapsUrl(url: URL): boolean {
  return url.protocol === "https:"
    && /(^|\.)google\.com$/.test(url.hostname)
    && url.pathname.startsWith("/maps");
}

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = (await request.json() as { url?: unknown }).url;
  } catch {
    return NextResponse.json({ error: "Enter a Google Maps link." }, { status: 400 });
  }
  if (typeof raw !== "string" || raw.length > 2048 || !isGoogleMapsShortLink(raw)) {
    return NextResponse.json({ error: "Use a Google Maps share link from maps.app.goo.gl." }, { status: 400 });
  }

  let current = new URL(raw);
  try {
    for (let hop = 0; hop < 6; hop += 1) {
      if (allowedGoogleMapsUrl(current) && parseStreetViewSource(current.toString())) {
        return NextResponse.json({ url: current.toString() }, { headers: { "Cache-Control": "no-store" } });
      }
      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      const location = response.headers.get("location");
      if (!location || response.status < 300 || response.status >= 400) break;
      const next = new URL(location, current);
      if (!isGoogleMapsShortLink(next.toString()) && !allowedGoogleMapsUrl(next)) break;
      current = next;
    }
  } catch {
    return NextResponse.json({ error: "Could not open that Google Maps share link. Try copying the full URL from your browser's address bar." }, { status: 502 });
  }
  return NextResponse.json({ error: "The share link did not lead to a location with coordinates. Open it in Google Maps, then copy the full URL from the address bar." }, { status: 422 });
}
