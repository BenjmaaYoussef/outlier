import { getPostByShortcode, insertCaptured, listPosts } from "@/lib/db";
import { emit } from "@/lib/events";
import { CORS, error, json } from "@/lib/http";
import { parseInstagramUrl } from "@/lib/ig";
import { enqueue } from "@/lib/pipeline";
import { ScrapeError, getPostInfo, prefetched } from "@/lib/clients/scrapecreators";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new Response(null, { headers: CORS });
}

/**
 * Called by the Chrome extension (and the manual "Add link" box).
 * Body: { links: [{ url, authorHandle? }], source? }
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    links?: { url: string; authorHandle?: string | null }[];
    source?: "extension" | "manual";
  } | null;
  if (!body?.links?.length) return error("Send { links: [{ url }] }");

  const results = [];
  for (const link of body.links) {
    const parsed = parseInstagramUrl(link.url);
    if (!parsed) {
      results.push({ url: link.url, ok: false, reason: "Not an Instagram post or reel link" });
      continue;
    }
    // Check the post first: age-restricted, private or deleted posts are
    // skipped here so they don't take one of the user's capture slots.
    // (The lookup is reused by the pipeline, so it costs no extra credit.)
    if (env.scrapeCreatorsKey && !getPostByShortcode(parsed.shortcode)) {
      try {
        prefetched.set(parsed.shortcode, await getPostInfo(parsed.url));
      } catch (e) {
        if (e instanceof ScrapeError && e.unavailable) {
          results.push({ url: parsed.url, ok: false, skipped: true, reason: e.reason });
          continue;
        }
        // Temporary failure: keep the post; the pipeline retries the lookup.
      }
    }
    const { post, created } = insertCaptured({
      ...parsed,
      authorHandle: link.authorHandle ?? null,
      source: body.source ?? "extension",
    });
    if (created) {
      emit({ type: "post", id: post.id });
      enqueue(post.id);
    }
    results.push({ url: parsed.url, ok: true, id: post.id, created });
  }
  return json({ results, total: listPosts().length });
}
