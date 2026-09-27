export function compact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "–";
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return String(Math.round(n));
}

export type Heat = "hot" | "warm" | "cold" | "none";

/** How loud the outlier signal is, relative to the user's threshold. */
export function heat(score: number | null | undefined, threshold = 3): Heat {
  if (score === null || score === undefined) return "none";
  if (score >= threshold * 2) return "hot";
  if (score >= threshold) return "warm";
  return "cold";
}

export const HEAT_TEXT: Record<Heat, string> = {
  hot: "text-hot",
  warm: "text-warm",
  cold: "text-cold",
  none: "text-muted",
};

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return "–";
  return score >= 10 ? `${Math.round(score)}×` : `${score.toFixed(1)}×`;
}

export function mediaUrl(file: string | null | undefined): string | null {
  return file ? `/api/media/${encodeURIComponent(file)}` : null;
}

export const STEP_LABEL: Record<string, string> = {
  queued: "Waiting",
  fetching: "Fetching post",
  baseline: "Checking creator's usual views",
  transcribing: "Transcribing and reading hooks",
  reading: "Reading on-screen text",
  structuring: "Pulling out hook and body",
  done: "Ready",
};

export function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 60 * 86400) return `${Math.round(s / 86400)}d ago`;
  if (s < 365 * 86400) return `${Math.round(s / (30 * 86400))}mo ago`;
  return `${Math.round(s / (365 * 86400))}y ago`;
}
