import fs from "node:fs/promises";
import path from "node:path";
import { MEDIA_DIR, getBaseline, getPost, saveBaseline, updatePost } from "./db";
import { emit } from "./events";
import { download, median, openingFrames } from "./media";
import { ScrapeError, getPostInfo, getRecentReels, getTranscript, prefetched, unavailableMessage } from "./clients/scrapecreators";
import { readVisualHook, structurePost } from "./clients/openrouter";
import type { Post } from "./types";

const CONCURRENCY = 3;

const g = globalThis as unknown as { __outlierQueue?: { pending: number[]; running: Set<number> } };
const queue = g.__outlierQueue ?? (g.__outlierQueue = { pending: [], running: new Set() });

export function enqueue(id: number) {
  if (queue.running.has(id) || queue.pending.includes(id)) return;
  queue.pending.push(id);
  pump();
}

function pump() {
  while (queue.running.size < CONCURRENCY && queue.pending.length) {
    const id = queue.pending.shift()!;
    queue.running.add(id);
    processPost(id)
      .catch(() => {})
      .finally(() => {
        queue.running.delete(id);
        pump();
      });
  }
}

function set(id: number, patch: Partial<Post>) {
  updatePost(id, patch);
  emit({ type: "post", id });
}

/** Runs the full enrichment for one captured post. Each run starts clean. */
export async function processPost(id: number) {
  const post = getPost(id);
  if (!post) return;
  set(id, { status: "enriching", step: "fetching", errorMsg: null });

  try {
    // 1. Post details
    const info = prefetched.get(post.shortcode) ?? (await getPostInfo(post.url));
    prefetched.delete(post.shortcode);
    let thumbnailPath: string | null = null;
    let videoPath: string | null = null;
    if (info.thumbnailUrl) thumbnailPath = await download(info.thumbnailUrl, `${info.shortcode}.jpg`).catch(() => null);
    if (info.videoUrl) videoPath = await download(info.videoUrl, `${info.shortcode}.mp4`).catch(() => null);

    const metric: Post["metric"] = info.mediaType === "video" && info.views !== null ? "views" : "likes";
    set(id, {
      mediaType: info.mediaType,
      metric,
      caption: info.caption,
      views: info.views,
      likes: info.likes,
      comments: info.comments,
      durationSec: info.durationSec,
      postedAt: info.postedAt,
      authorHandle: info.authorHandle ?? post.authorHandle,
      authorName: info.authorName,
      authorFollowers: info.authorFollowers,
      thumbnailPath,
      videoPath,
      step: "baseline",
    });

    // 2. Creator baseline -> outlier score
    const handle = info.authorHandle ?? post.authorHandle;
    if (handle) {
      let base = getBaseline(handle);
      if (!base) {
        const recent = await getRecentReels(handle, info.authorId).catch(() => ({ views: [], likes: [] }));
        base = {
          medianViews: median(recent.views),
          medianLikes: median(recent.likes),
          sampleSize: Math.max(recent.views.length, recent.likes.length),
        };
        saveBaseline(handle, base);
      }
      const med = metric === "views" ? base.medianViews : base.medianLikes;
      const value = metric === "views" ? info.views : info.likes;
      const score = med && value !== null ? value / med : null;
      set(id, {
        medianMetric: med,
        baselineSize: base.sampleSize,
        outlierScore: score !== null ? Math.round(score * 10) / 10 : null,
      });
    }

    // 3. Hooks: transcript (audio) and on-screen text (visual) in parallel
    set(id, { step: "transcribing" });
    const isVideo = Boolean(info.videoUrl);
    let transcriptError: string | null = null;
    const [transcript, visualHook] = await Promise.all([
      isVideo
        ? getTranscript(post.url).catch((e) => {
            transcriptError = (e as Error).message;
            return null;
          })
        : Promise.resolve(null),
      videoPath
        ? openingFrames(videoPath).then(readVisualHook)
        : thumbnailPath
          ? fs.readFile(path.join(MEDIA_DIR, thumbnailPath)).then((buf) => readVisualHook([buf]))
          : Promise.resolve(null),
    ]);
    set(id, {
      transcript,
      hasSpeech: isVideo && !transcriptError ? Boolean(transcript) : null,
      visualHook,
      step: "structuring",
    });

    // 4. Spoken hook / body / core idea
    const s = await structurePost({ caption: info.caption, transcript, visualHook });
    set(id, {
      spokenHook: transcript ? s.spokenHook : null,
      body: s.body,
      coreIdea: s.coreIdea,
      status: "ready",
      step: "done",
      errorMsg: transcriptError ? `Transcript unavailable: ${transcriptError}` : null,
    });
  } catch (e) {
    const msg = e instanceof ScrapeError && e.unavailable ? unavailableMessage(e.reason) : (e as Error).message;
    set(id, { status: "error", errorMsg: msg });
  }
}
