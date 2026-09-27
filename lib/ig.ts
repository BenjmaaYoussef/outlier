/** Extracts the shortcode from an Instagram post/reel link. */
export function parseInstagramUrl(input: string): { shortcode: string; url: string } | null {
  const m = input.trim().match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})/);
  if (!m) return null;
  const kind = m[1] === "p" ? "p" : "reel";
  return { shortcode: m[2], url: `https://www.instagram.com/${kind}/${m[2]}/` };
}
