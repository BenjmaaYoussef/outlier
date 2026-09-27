import fs from "node:fs";
import path from "node:path";
import { MEDIA_DIR, clearPosts, getSettings, insertCaptured, saveSettings, updatePost } from "./db";
import { emit } from "./events";
import type { Post } from "./types";

interface DemoPost {
  shortcode: string;
  authorHandle: string;
  authorName: string;
  authorFollowers: number;
  mediaType: "video" | "image" | "carousel";
  views: number | null;
  likes: number;
  comments: number;
  medianMetric: number;
  durationSec: number | null;
  palette: [string, string];
  visualHook: string;
  spokenHook: string | null;
  transcript: string | null;
  hasSpeech: boolean | null;
  body: string;
  coreIdea: string;
  caption: string;
}

function loadFixtures(): DemoPost[] {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "fixtures", "demo-posts.json"), "utf8"));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const w of text.split(" ")) {
    if ((cur + " " + w).trim().length > max) {
      lines.push(cur.trim());
      cur = w;
    } else cur += " " + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

/** A reel-shaped poster with the hook text on it, standing in for a real thumbnail. */
function posterSvg(p: DemoPost): string {
  const [a, b] = p.palette;
  const lines = wrap(p.visualHook, 18);
  const start = 640 - (lines.length * 78) / 2;
  const text = lines
    .map(
      (l, i) =>
        `<text x="360" y="${start + i * 78}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="800" font-size="62" fill="#fff" stroke="#000" stroke-opacity=".35" stroke-width="2" paint-order="stroke">${esc(l)}</text>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<radialGradient id="v" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient></defs>
<rect width="720" height="1280" fill="url(#g)"/>
<circle cx="360" cy="1010" r="150" fill="#fff" fill-opacity=".08"/>
<rect width="720" height="1280" fill="url(#v)"/>
${text}
<text x="40" y="1220" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#fff" fill-opacity=".85">@${esc(p.authorHandle)}</text>
</svg>`;
}

const g = globalThis as unknown as { __outlierDemoRun?: number };

/**
 * Loads 10 sample posts and plays them through the pipeline steps with short
 * delays, so the feed looks exactly like a live capture without any API keys.
 */
export async function loadDemo(opts: { animate?: boolean } = {}) {
  const runId = (g.__outlierDemoRun = (g.__outlierDemoRun ?? 0) + 1);
  const fixtures = loadFixtures();
  clearPosts();
  emit({ type: "reset" });
  fs.mkdirSync(MEDIA_DIR, { recursive: true });

  if (!getSettings().productName) {
    saveSettings({
      productName: "Sample testosterone support supplement",
      productDescription:
        "Daily capsule for men 30+ with zinc, magnesium, vitamin D3 and ashwagandha. Supports natural testosterone, energy and drive. (Sample product: edit this in Settings.)",
    });
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, opts.animate ? ms : 0));
  const ids: number[] = [];

  for (const f of fixtures) {
    if (g.__outlierDemoRun !== runId) return;
    fs.writeFileSync(path.join(MEDIA_DIR, `${f.shortcode}.svg`), posterSvg(f));
    const { post } = insertCaptured({
      shortcode: f.shortcode,
      url: `https://www.instagram.com/reel/${f.shortcode}/`,
      authorHandle: f.authorHandle,
      source: "demo",
    });
    ids.push(post.id);
    emit({ type: "post", id: post.id });
    await sleep(350);
  }

  const steps: Post["step"][] = ["fetching", "baseline", "transcribing", "structuring"];
  await Promise.all(
    fixtures.map(async (f, i) => {
      const id = ids[i];
      await sleep(250 * i);
      for (const step of steps) {
        if (g.__outlierDemoRun !== runId) return;
        updatePost(id, { status: "enriching", step });
        emit({ type: "post", id });
        await sleep(450 + Math.random() * 500);
      }
      const metric = f.mediaType === "video" ? "views" : "likes";
      const value = metric === "views" ? f.views : f.likes;
      updatePost(id, {
        status: "ready",
        step: "done",
        mediaType: f.mediaType,
        metric,
        views: f.views,
        likes: f.likes,
        comments: f.comments,
        medianMetric: f.medianMetric,
        baselineSize: 12,
        outlierScore: value ? Math.round((value / f.medianMetric) * 10) / 10 : null,
        caption: f.caption,
        visualHook: f.visualHook,
        spokenHook: f.spokenHook,
        transcript: f.transcript,
        hasSpeech: f.hasSpeech,
        body: f.body,
        coreIdea: f.coreIdea,
        authorName: f.authorName,
        authorFollowers: f.authorFollowers,
        durationSec: f.durationSec,
        postedAt: new Date(Date.now() - (i + 1) * 5 * 36e5).toISOString(),
        thumbnailPath: `${f.shortcode}.svg`,
      });
      emit({ type: "post", id });
    }),
  );
}
