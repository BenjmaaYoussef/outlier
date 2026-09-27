import { env } from "../env";

const BASE = "https://api.scrapecreators.com";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** An API failure. `unavailable` means the post itself can't be scraped (age-restricted, private, deleted). */
export class ScrapeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly unavailable: boolean,
    readonly reason: string | null = null,
  ) {
    super(message);
  }
}

function classify(status: number, detail: string): { unavailable: boolean; reason: string | null } {
  const d = detail.toLowerCase();
  if (d.includes("age restricted") || d.includes("age-restricted")) return { unavailable: true, reason: "age-restricted" };
  if (d.includes("private")) return { unavailable: true, reason: "private" };
  if (status === 404 || d.includes("not found") || d.includes("deleted") || d.includes("doesn't exist")) return { unavailable: true, reason: "deleted or not found" };
  if (status === 403) return { unavailable: true, reason: "restricted by Instagram" };
  return { unavailable: false, reason: null };
}

async function call(path: string, params: Record<string, string>, timeoutMs = 60_000): Promise<any> {
  if (!env.scrapeCreatorsKey) throw new Error("SCRAPECREATORS_API_KEY is missing. Add it to .env.local.");
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    headers: { "x-api-key": env.scrapeCreatorsKey },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`ScrapeCreators ${path} returned ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok || json?.success === false) {
    const detail = String(json?.message || json?.error || text.slice(0, 200));
    const { unavailable, reason } = classify(res.status, detail);
    throw new ScrapeError(`ScrapeCreators ${path} failed (${res.status}): ${detail}`, res.status, unavailable, reason);
  }
  return json;
}

export interface PostInfo {
  shortcode: string;
  mediaType: "video" | "image" | "carousel";
  caption: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  durationSec: number | null;
  postedAt: string | null;
  authorHandle: string | null;
  authorName: string | null;
  authorFollowers: number | null;
  authorId: string | null;
  isPaidPartnership: boolean;
}

export async function getPostInfo(url: string): Promise<PostInfo> {
  const json = await call("/v1/instagram/post", { url });
  const m = json?.data?.xdt_shortcode_media;
  if (!m) throw new ScrapeError("ScrapeCreators returned no post data", 404, true, "private or deleted");
  const typename: string = m.__typename || "";
  const mediaType = typename.includes("Sidecar") ? "carousel" : m.is_video ? "video" : "image";
  // For carousels, use the first video slide if there is one.
  const firstVideo = m.edge_sidecar_to_children?.edges?.map((e: any) => e.node).find((n: any) => n.is_video);
  return {
    shortcode: m.shortcode,
    mediaType,
    caption: m.edge_media_to_caption?.edges?.[0]?.node?.text ?? "",
    views: m.video_play_count ?? m.video_view_count ?? null,
    likes: m.edge_media_preview_like?.count ?? m.edge_liked_by?.count ?? null,
    comments: m.edge_media_to_parent_comment?.count ?? m.edge_media_to_comment?.count ?? null,
    videoUrl: m.video_url ?? firstVideo?.video_url ?? null,
    thumbnailUrl: m.display_url ?? m.thumbnail_src ?? null,
    durationSec: m.video_duration ?? null,
    postedAt: m.created_at ?? (m.taken_at_timestamp ? new Date(m.taken_at_timestamp * 1000).toISOString() : null),
    authorHandle: m.owner?.username ?? null,
    authorName: m.owner?.full_name ?? null,
    authorFollowers: m.owner?.edge_followed_by?.count ?? null,
    authorId: m.owner?.id ?? null,
    isPaidPartnership: Boolean(m.is_paid_partnership),
  };
}

export interface RecentStats {
  views: number[];
  likes: number[];
}

/** The creator's recent reels, used as the "normal performance" baseline. */
export async function getRecentReels(handle: string, userId?: string | null): Promise<RecentStats> {
  const params: Record<string, string> = userId ? { user_id: userId } : { handle };
  const json = await call("/v1/instagram/user/reels", { ...params, trim: "true" });
  const items: any[] = json?.items ?? [];
  const views: number[] = [];
  const likes: number[] = [];
  for (const it of items) {
    const m = it.media ?? it;
    const v = m.play_count ?? m.ig_play_count ?? m.view_count;
    if (typeof v === "number") views.push(v);
    if (typeof m.like_count === "number") likes.push(m.like_count);
  }
  return { views, likes };
}

/** AI transcript of a video. Returns null when there is no speech (music only). */
export async function getTranscript(url: string): Promise<string | null> {
  const json = await call("/v2/instagram/media/transcript", { url }, 90_000);
  const parts: string[] = (json?.transcripts ?? [])
    .map((t: any) => (typeof t?.text === "string" ? t.text.trim() : ""))
    .filter(Boolean);
  return parts.length ? parts.join("\n\n") : null;
}

/** User-facing text for a post that can't be analyzed. */
export function unavailableMessage(reason: string | null): string {
  return `Unavailable: this post is ${reason ?? "restricted"}, so it can't be analyzed. Remove it from the feed.`;
}

/** Posts looked up during capture, handed to the pipeline so we don't pay twice. */
const g = globalThis as unknown as { __outlierPrefetch?: Map<string, PostInfo> };
export const prefetched = g.__outlierPrefetch ?? (g.__outlierPrefetch = new Map());
