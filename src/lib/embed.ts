export function extractEmbedUrl(raw: string): string {
  const trimmed = raw.trim().replace(/&amp;/g, "&");
  const srcMatch = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  return (srcMatch?.[1] ?? trimmed).replace(/&amp;/g, "&");
}

export function isSafeHttpUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
