"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Plus, X } from "lucide-react";
import { HookList, samePick } from "@/components/HookList";
import { OutlierMark } from "@/components/OutlierMark";
import { Writer } from "@/components/Writer";
import { mediaUrl } from "@/lib/format";
import { useLivePosts, useSettings } from "@/lib/useLivePosts";
import type { HookPick } from "@/lib/types";

export default function WritePage() {
  return (
    <Suspense>
      <WritingRoom />
    </Suspense>
  );
}

function WritingRoom() {
  const router = useRouter();
  const search = useSearchParams();
  const { posts, loaded } = useLivePosts();
  const [settings] = useSettings();
  const threshold = settings?.outlierThreshold ?? 3;
  const ids = useMemo(() => (search.get("ids") ?? "").split(",").map(Number).filter(Boolean), [search]);
  const [picks, setPicks] = useState<HookPick[]>([]);
  const [picking, setPicking] = useState(false);

  const chosen = ids.map((id) => posts.find((p) => p.id === id)).filter((p) => p && p.status === "ready") as typeof posts;
  const candidates = posts
    .filter((p) => p.status === "ready" && !ids.includes(p.id))
    .sort((a, b) => Number(b.saved) - Number(a.saved) || (b.outlierScore ?? 0) - (a.outlierScore ?? 0));

  useEffect(() => setPicks((ps) => ps.filter((p) => ids.includes(p.postId))), [ids]);

  const setIds = (next: number[]) => router.replace(next.length ? `/write?ids=${next.join(",")}` : "/write");
  const togglePick = (h: HookPick) =>
    setPicks((ps) => (ps.some((p) => samePick(p, h)) ? ps.filter((p) => !samePick(p, h)) : [...ps, h]));

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-8 sm:px-6">
      <h1 className="font-display text-[34px] font-bold leading-none tracking-tight">Writing room</h1>
      <p className="mt-2 max-w-[60ch] text-[14.5px] text-ink-2">
        Combine hooks from several posts and send them to MarioBot together.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_440px]">
        <div className="min-w-0 space-y-3">
          {chosen.map((p) => (
            <article key={p.id} className="arrive flex gap-4 rounded-2xl bg-surface p-3 ring-1 ring-line">
              <Link href={`/post/${p.id}`} className="relative w-24 shrink-0 self-start overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(p.thumbnailPath) ?? ""} alt="" className="aspect-[9/14] w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-6">
                  <OutlierMark score={p.outlierScore} threshold={threshold} className="text-[24px]" />
                </div>
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">@{p.authorHandle}</span>
                  <button
                    onClick={() => setIds(ids.filter((x) => x !== p.id))}
                    aria-label="Remove from writing room"
                    className="rounded-full p-1 text-muted hover:bg-surface-2 hover:text-ink"
                  >
                    <X size={15} />
                  </button>
                </div>
                {p.coreIdea && <p className="mb-2 mt-0.5 text-[13.5px] text-ink-2">{p.coreIdea}</p>}
                <HookList post={p} picks={picks} onToggle={togglePick} size="sm" />
              </div>
            </article>
          ))}

          {loaded && (
            <div className="rounded-2xl border border-dashed border-line p-3">
              {!picking ? (
                <button onClick={() => setPicking(true)} className="flex w-full items-center justify-center gap-2 py-3 text-sm text-ink-2 hover:text-ink">
                  <Plus size={16} /> {chosen.length ? "Add another post" : "Choose posts to write from"}
                </button>
              ) : candidates.length === 0 ? (
                <p className="py-3 text-center text-sm text-muted">
                  No other analyzed posts. <Link href="/" className="underline">Go to the feed</Link>
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
                  {candidates.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setIds([...ids, p.id])}
                      className="group relative overflow-hidden rounded-lg ring-1 ring-line"
                      title={p.visualHook ?? p.coreIdea ?? ""}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mediaUrl(p.thumbnailPath) ?? ""} alt={p.visualHook ?? ""} className="aspect-[9/14] w-full object-cover transition group-hover:opacity-80" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-5 text-left">
                        <OutlierMark score={p.outlierScore} threshold={threshold} className={clsx("text-[20px]")} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Writer posts={chosen} picks={picks} />
        </div>
      </div>
    </main>
  );
}
