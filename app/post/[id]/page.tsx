"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { toast } from "sonner";
import { ArrowLeft, Bookmark, ExternalLink } from "lucide-react";
import { HookList, samePick } from "@/components/HookList";
import { OutlierMark } from "@/components/OutlierMark";
import { Writer } from "@/components/Writer";
import { compact, mediaUrl, timeAgo, STEP_LABEL } from "@/lib/format";
import { useLivePosts, useSettings } from "@/lib/useLivePosts";
import type { HookPick } from "@/lib/types";

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number(use(params).id);
  const { posts, setPosts, loaded } = useLivePosts();
  const [settings] = useSettings();
  const [picks, setPicks] = useState<HookPick[]>([]);
  const [fullTranscript, setFullTranscript] = useState(false);
  const post = posts.find((p) => p.id === id);
  const threshold = settings?.outlierThreshold ?? 3;

  async function toggleSave() {
    if (!post) return;
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, saved: !p.saved } : p)));
    await fetch(`/api/posts/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ saved: !post.saved }) });
    toast(post.saved ? "Removed from saved" : "Saved");
  }

  // "s" saves the post
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || e.metaKey || e.ctrlKey) return;
      if (e.key === "s") toggleSave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!loaded) return <main className="mx-auto max-w-[1400px] px-6 py-10 text-muted">Loading…</main>;
  if (!post)
    return (
      <main className="mx-auto max-w-[1400px] px-6 py-10">
        <p>This post isn&apos;t in your feed anymore.</p>
        <Link href="/" className="mt-3 inline-block underline">Back to feed</Link>
      </main>
    );

  const thumb = mediaUrl(post.thumbnailPath);
  const video = mediaUrl(post.videoPath);
  const metricValue = post.metric === "likes" ? post.likes : post.views;
  const togglePick = (h: HookPick) =>
    setPicks((ps) => (ps.some((p) => samePick(p, h)) ? ps.filter((p) => !samePick(p, h)) : [...ps, h]));
  const longTranscript = (post.transcript?.length ?? 0) > 600;

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft size={15} /> Feed
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr_420px]">
        {/* media */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-2xl bg-black ring-1 ring-line">
            {video ? (
              <video src={video} poster={thumb ?? undefined} controls playsInline className="aspect-[9/16] w-full object-cover" />
            ) : thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" className="aspect-[9/16] w-full object-cover" />
            ) : (
              <div className="shimmer aspect-[9/16] w-full" />
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={toggleSave}
              className={clsx(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm ring-1 ring-line",
                post.saved ? "bg-ink text-bg" : "bg-surface hover:bg-surface-2",
              )}
            >
              <Bookmark size={14} fill={post.saved ? "currentColor" : "none"} /> {post.saved ? "Saved" : "Save"}
            </button>
            <a
              href={post.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-surface py-2 text-sm ring-1 ring-line hover:bg-surface-2"
            >
              <ExternalLink size={14} /> Instagram
            </a>
          </div>
        </div>

        {/* anatomy */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <OutlierMark score={post.outlierScore} threshold={threshold} className="text-[88px]" />
            <div className="pb-2 text-[14.5px] leading-snug">
              <div className="tabular">
                <span className="font-semibold">{compact(metricValue)} {post.metric ?? "views"}</span>
                <span className="text-ink-2"> vs. usually {compact(post.medianMetric)}</span>
              </div>
              <div className="text-muted">
                Median of @{post.authorHandle}&apos;s last {post.baselineSize ?? "–"} reels
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-baseline gap-x-2 text-[14.5px]">
            <span className="font-semibold">@{post.authorHandle}</span>
            {post.authorName && <span className="text-ink-2">{post.authorName}</span>}
            <span className="text-muted">
              {post.authorFollowers !== null && <> · {compact(post.authorFollowers)} followers</>}
              {post.postedAt && <> · posted {timeAgo(post.postedAt)}</>}
              {post.durationSec && <> · {Math.round(post.durationSec)}s</>}
            </span>
          </div>

          {post.status !== "ready" && (
            <p className="mt-4 rounded-xl bg-surface-2 p-3 text-sm text-ink-2">
              {post.status === "error" ? post.errorMsg : `${STEP_LABEL[post.step]}…`}
            </p>
          )}
          {post.status === "ready" && post.errorMsg && (
            <p className="mt-4 rounded-xl bg-warm/10 p-3 text-sm text-ink-2">{post.errorMsg}</p>
          )}

          <Section title="Hooks" note="Pick the ones to send to MarioBot. None picked sends all of them.">
            <HookList post={post} picks={picks} onToggle={togglePick} />
          </Section>

          {post.coreIdea && (
            <Section title="Core idea">
              <p className="max-w-[65ch] font-display text-[20px] font-medium leading-snug">{post.coreIdea}</p>
            </Section>
          )}

          {post.body && (
            <Section title="Body">
              <div className="prose-out max-w-[70ch] whitespace-pre-line text-ink-2">{post.body}</div>
            </Section>
          )}

          <Section title="Caption">
            <p className="max-w-[70ch] whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{post.caption || "No caption."}</p>
          </Section>

          <Section title="Full transcript">
            {post.transcript ? (
              <>
                <p className={clsx("max-w-[70ch] whitespace-pre-line text-[15px] leading-relaxed text-ink-2", !fullTranscript && longTranscript && "line-clamp-6")}>
                  {post.transcript}
                </p>
                {longTranscript && (
                  <button onClick={() => setFullTranscript((f) => !f)} className="mt-2 text-sm underline">
                    {fullTranscript ? "Show less" : "Show full transcript"}
                  </button>
                )}
              </>
            ) : (
              <p className="text-[15px] text-muted">
                {post.hasSpeech === false ? "No speech in this video, only music." : post.mediaType === "video" ? "No transcript available." : "Not a video, so there's no transcript."}
              </p>
            )}
          </Section>
        </div>

        {/* writer */}
        <div className="lg:col-span-2 xl:col-span-1 xl:sticky xl:top-20 xl:self-start">
          <Writer posts={[post]} picks={picks} />
        </div>
      </div>
    </main>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-line pt-5">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
        <h2 className="font-display text-[17px] font-bold">{title}</h2>
        {note && <span className="text-[13px] text-muted">{note}</span>}
      </div>
      {children}
    </section>
  );
}
