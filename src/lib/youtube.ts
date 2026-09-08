function normalizeUrl(raw: string): string {
  return raw.trim().replace(/&amp;/g, "&");
}

export function extractYouTubeId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(normalizeUrl(raw));
    const hostname = parsed.hostname.replace(/^www\./, "");
    if (hostname === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
      return id && /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (hostname.endsWith("youtube.com")) {
      const queryId = parsed.searchParams.get("v");
      if (queryId) return /^[\w-]{6,}$/.test(queryId) ? queryId : null;
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(parts[0]) && parts[1]) {
        return /^[\w-]{6,}$/.test(parts[1]) ? parts[1] : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function parseTimeValue(value: string): number {
  if (/^\d+$/.test(value)) return Number(value);
  const match = value.toLowerCase().match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

export function getYouTubeStartSeconds(raw: string | null | undefined): number {
  if (!raw) return 0;
  try {
    const parsed = new URL(normalizeUrl(raw));
    const value = parsed.searchParams.get("start") ?? parsed.searchParams.get("t");
    return value ? Math.max(0, Math.floor(parseTimeValue(value))) : 0;
  } catch {
    return 0;
  }
}

export function buildYouTubeEmbedUrl(
  raw: string | null | undefined,
  options: { startSeconds?: number; endSeconds?: number; autoplay?: boolean; enableJsApi?: boolean } = {},
): string {
  const id = extractYouTubeId(raw);
  if (!id) return "";
  const params = new URLSearchParams({ rel: "0", playsinline: "1" });
  const start = Math.max(0, Math.floor(options.startSeconds ?? getYouTubeStartSeconds(raw)));
  if (start > 0) params.set("start", String(start));
  if (options.endSeconds != null && options.endSeconds > start) {
    params.set("end", String(Math.floor(options.endSeconds)));
  }
  if (options.autoplay) params.set("autoplay", "1");
  if (options.enableJsApi) params.set("enablejsapi", "1");
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}
