import { extractEmbedUrl } from "@/lib/embed";

export type StreetViewSource = {
  lat: number;
  lng: number;
  heading?: number;
  pitch?: number;
  zoom?: number;
  pano?: string;
};

export function isGoogleMapsShortLink(raw: string): boolean {
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:"
      && (url.hostname === "maps.app.goo.gl" || (url.hostname === "goo.gl" && url.pathname.startsWith("/maps/")));
  } catch {
    return false;
  }
}

function coordinatePair(value: string | null): { lat: number; lng: number } | null {
  const match = value?.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export function parseStreetViewSource(raw: string | null | undefined): StreetViewSource | null {
  if (!raw) return null;
  try {
    const url = new URL(extractEmbedUrl(raw));
    if (url.protocol !== "https:" || !/(^|\.)google\.com$/.test(url.hostname)) return null;
    const text = `${url.pathname}${url.search}`;
    const embedPair = text.match(/!1d(-?\d+(?:\.\d+)?)!2d(-?\d+(?:\.\d+)?)/);
    const mapPair = text.match(/!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/);
    const placePair = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    const atPair = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    const pair = coordinatePair(url.searchParams.get("viewpoint") ?? url.searchParams.get("cbll") ?? url.searchParams.get("ll") ?? url.searchParams.get("location") ?? url.searchParams.get("q"))
      ?? (embedPair ? coordinatePair(`${embedPair[1]},${embedPair[2]}`) : null)
      ?? (mapPair ? coordinatePair(`${mapPair[2]},${mapPair[1]}`) : null)
      ?? (placePair ? coordinatePair(`${placePair[1]},${placePair[2]}`) : null)
      ?? (atPair ? coordinatePair(`${atPair[1]},${atPair[2]}`) : null);
    if (!pair) return null;
    const embeddedHeading = text.match(/!3f(-?\d+(?:\.\d+)?)/);
    const embeddedPitch = text.match(/!4f(-?\d+(?:\.\d+)?)/);
    const embeddedZoom = text.match(/!5f(-?\d+(?:\.\d+)?)/);
    const addressHeading = text.match(/,(-?\d+(?:\.\d+)?)h(?:,|!)/);
    const addressTilt = text.match(/,(-?\d+(?:\.\d+)?)t(?:,|!)/);
    const heading = Number(url.searchParams.get("heading") ?? embeddedHeading?.[1] ?? addressHeading?.[1]);
    const pitch = Number(url.searchParams.get("pitch") ?? embeddedPitch?.[1] ?? (addressTilt ? 90 - Number(addressTilt[1]) : NaN));
    const fov = Number(url.searchParams.get("fov"));
    const zoom = Number(url.searchParams.get("svzoom") ?? embeddedZoom?.[1] ?? (Number.isFinite(fov) && fov > 0 ? Math.log2(180 / fov) : NaN));
    const panorama = url.searchParams.get("pano") ?? (text.includes("!6m8") ? text.match(/!1s([^!&]+)/)?.[1] : undefined);
    return {
      ...pair,
      ...(Number.isFinite(heading) ? { heading } : {}),
      ...(Number.isFinite(pitch) ? { pitch } : {}),
      ...(Number.isFinite(zoom) && zoom >= 0 ? { zoom } : {}),
      ...(panorama && !panorama.includes("%") ? { pano: panorama } : {}),
    };
  } catch {
    return null;
  }
}

export function formatStreetViewSource(source: StreetViewSource): string {
  const url = new URL("https://www.google.com/maps/@");
  url.searchParams.set("api", "1");
  url.searchParams.set("map_action", "pano");
  url.searchParams.set("viewpoint", `${source.lat.toFixed(7)},${source.lng.toFixed(7)}`);
  if (source.pano) url.searchParams.set("pano", source.pano);
  if (source.heading !== undefined) url.searchParams.set("heading", source.heading.toFixed(2));
  if (source.pitch !== undefined) url.searchParams.set("pitch", source.pitch.toFixed(2));
  if (source.zoom !== undefined) {
    url.searchParams.set("svzoom", source.zoom.toFixed(2));
    url.searchParams.set("fov", Math.max(10, Math.min(100, 180 / 2 ** source.zoom)).toFixed(1));
  }
  return url.toString();
}

export function getGeoExploreValue(faceValue: number, levels: 1 | 2, boardValues: readonly number[]): number {
  const values = Array.from(new Set([0, faceValue, ...boardValues.filter((value) => Number.isFinite(value) && value >= 0)]))
    .sort((a, b) => a - b);
  const index = values.indexOf(faceValue);
  return values[Math.max(0, index - levels)] ?? 0;
}

export const DEFAULT_GEO_STAGE_BANDS_KM = [25, 100, 500, 2000, 5000] as const;

export function getGeoStageBands(value: readonly number[] | null | undefined): number[] {
  if (value?.length !== 5 || value.some((band, index) => !Number.isFinite(band) || band <= 0 || (index > 0 && band <= value[index - 1]))) {
    return [...DEFAULT_GEO_STAGE_BANDS_KM];
  }
  return [...value];
}

export function distanceBetweenKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const radians = Math.PI / 180;
  const latDelta = (b.lat - a.lat) * radians;
  const lngDelta = (b.lng - a.lng) * radians;
  const sinLat = Math.sin(latDelta / 2);
  const sinLng = Math.sin(lngDelta / 2);
  const arc = sinLat ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * sinLng ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(Math.max(0, 1 - arc)));
}

export function getGeoStageScore(points: number, distanceKm: number | null, bands: readonly number[]): number {
  if (distanceKm === null || !Number.isFinite(distanceKm)) return 0;
  const index = getGeoStageBands(bands).findIndex((limit) => distanceKm <= limit);
  return index < 0 ? 0 : Math.round(Math.max(0, points) * (5 - index) / 5);
}
