"use client";
import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, Ban, Bookmark, Check, Images, Music2, RotateCw, Trash2 } from "lucide-react";
import { OutlierMark } from "./OutlierMark";
import { STEP_LABEL, compact, heat, mediaUrl } from "@/lib/format";
import type { Post } from "@/lib/types";

const STEPS = ["fetching", "baseline", "transcribing", "structuring"];

export function PostCard({
  post,
  threshold,
  selected,
  onToggleSelect,
  onToggleSave,
  onRetry,
  onRemove,
}: {
  post: Post;
  threshold: number;
  selected: boolean;
  onToggleSelect: () => void;
  onToggleSave: () => void;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const ready = post.status === "ready";
  const thumb = mediaUrl(post.thumbnailPath);
  const h = heat(post.outlierScore, threshold);
  const metricValue = post.metric === "likes" ? post.likes : post.views;
  // Age-restricted, private or deleted: retrying can't help.
  const unavailable = post.status === "error" && Boolean(post.errorMsg?.startsWith("Unavailable"));

  return (
    <article
      className={clsx(
        "arrive group relative flex flex-col rounded-[14px] bg-surface p-1.5 transition-shadow",
        selected ? "ring-2 ring-ink" : "ring-1 ring-line hover:ring-ink-2/40",
      )}
    >
      <div className="relative aspect-[9/14] overflow-hidden rounded-[10px] bg-surface-2">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="shimmer h-full w-full" />
        )}

        {ready && (
          <Link href={`/post/${post.id}`} className="absolute inset-0" aria-label={`Open post by @${post.authorHandle}`} />
        )}

        {/* select + save */}
        {ready && (
          <>
            <button
              onClick={onToggleSelect}
              aria-pressed={selected}
              aria-label={selected ? "Remove from selection" : "Select for MarioBot"}
              className={clsx(
                "absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full border-2 transition",
                selected
                  ? "border-white bg-ink text-bg"
                  : "border-white/80 bg-black/20 text-transparent opacity-0 backdrop-blur group-hover:opacity-100 focus-visible:opacity-100",
              )}
            >
              <Check size={15} strokeWidth={3} />
            </button>
            <button
              onClick={onToggleSave}
              aria-pressed={post.saved}
              aria-label={post.saved ? "Unsave" : "Save"}
              className={clsx(
                "absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/30 text-white backdrop-blur transition",
                post.saved ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
              )}
            >
              <Bookmark size={14} fill={post.saved ? "currentColor" : "none"} />
            </button>
          </>
        )}

        {/* media type hints */}
        {ready && (post.mediaType === "carousel" || post.hasSpeech === false) && (
          <div className="pointer-events-none absolute right-2 bottom-2 flex gap-1">
            {post.mediaType === "carousel" && (
              <span className="rounded-full bg-black/45 p-1.5 text-white backdrop-blur" title="Carousel">
                <Images size={12} />
              </span>
            )}
            {post.hasSpeech === false && (
              <span className="rounded-full bg-black/45 p-1.5 text-white backdrop-blur" title="Music only, no speech">
                <Music2 size={12} />
              </span>
            )}
          </div>
        )}

        {/* the numeral */}
        {ready && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2.5 pt-14">
            <OutlierMark
              score={post.outlierScore}
              threshold={threshold}
              className={clsx("block text-[46px]", h === "cold" || h === "none" ? "!text-white/70" : "")}
            />
          </div>
        )}

        {/* processing overlay */}
        {post.status !== "ready" && post.status !== "error" && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-10 text-white">
            <div className="text-[13px] font-medium">{STEP_LABEL[post.step] ?? "Waiting"}…</div>
            <div className="mt-2 flex gap-1">
              {STEPS.map((s, i) => (
                <span
                  key={s}
                  className={clsx(
                    "h-1 flex-1 rounded-full transition-colors duration-500",
                    STEPS.indexOf(post.step) >= i ? "bg-white" : "bg-white/25",
                  )}
                />
              ))}
            </div>
          </div>
        )}

        {post.status === "error" && (
          <div className="absolute inset-0 flex flex-col items-start justify-end gap-2 bg-black/70 p-3 text-white">
            {unavailable ? <Ban size={18} className="text-white/70" /> : <AlertTriangle size={18} className="text-warm" />}
            <p className="line-clamp-5 text-[12.5px] leading-snug text-white/90">
              {unavailable ? post.errorMsg?.replace(/^Unavailable: /, "") : post.errorMsg}
            </p>
            <div className="flex gap-2">
              {!unavailable && (
                <button
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[12.5px] font-medium text-black"
                >
                  <RotateCw size={12} /> Retry
                </button>
              )}
              <button
                onClick={onRemove}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-medium",
                  unavailable ? "bg-white text-black" : "bg-white/15 text-white",
                )}
              >
                <Trash2 size={12} /> Remove
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col px-1.5 pb-1 pt-2.5">
        {ready ? (
          <>
            <p className="line-clamp-2 text-[14px] font-medium leading-snug">
              {post.coreIdea ?? post.visualHook ?? post.spokenHook ?? post.caption}
            </p>
            <div className="mt-auto pt-2 text-[12.5px] text-muted">
              <div className="truncate">@{post.authorHandle}</div>
              <div className="tabular">
                {compact(metricValue)} {post.metric ?? "views"}
                {post.medianMetric ? <> · usually {compact(post.medianMetric)}</> : null}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="shimmer h-3.5 w-11/12 rounded" />
            <div className="shimmer mt-1.5 h-3.5 w-2/3 rounded" />
            <div className="mt-auto pt-2 text-[12.5px] text-muted">
              {post.authorHandle ? `@${post.authorHandle}` : post.shortcode}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
