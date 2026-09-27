"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";
import { Check, Copy } from "lucide-react";
import { PRESETS } from "@/lib/prompt";
import { mediaUrl, timeAgo } from "@/lib/format";
import { useLivePosts } from "@/lib/useLivePosts";
import type { Generation } from "@/lib/types";

const LABEL: Record<string, string> = { ...Object.fromEntries(PRESETS.map((p) => [p.id, p.label])), custom: "Custom" };

export default function HistoryPage() {
  const [gens, setGens] = useState<Generation[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const { posts } = useLivePosts();

  useEffect(() => {
    fetch("/api/generations").then((r) => r.json()).then((g: Generation[]) => {
      setGens(g);
      if (g[0]) setOpen(g[0].id);
    });
  }, []);

  const current = gens?.find((g) => g.id === open);

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-8 sm:px-6">
      <h1 className="font-display text-[34px] font-bold leading-none tracking-tight">History</h1>
      <p className="mt-2 text-[14.5px] text-ink-2">Every MarioBot reply, newest first.</p>

      {gens && gens.length === 0 && (
        <p className="mt-10 text-ink-2">
          Nothing written yet. Open a post from the <Link href="/" className="underline">feed</Link> and send it to MarioBot.
        </p>
      )}

      {gens && gens.length > 0 && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
          <ul className="space-y-1.5">
            {gens.map((g) => {
              const first = posts.find((p) => p.id === g.postIds[0]);
              return (
                <li key={g.id}>
                  <button
                    onClick={() => setOpen(g.id)}
                    className={clsx(
                      "flex w-full gap-3 rounded-xl p-2.5 text-left transition",
                      open === g.id ? "bg-surface ring-1 ring-ink" : "hover:bg-surface",
                    )}
                  >
                    {first?.thumbnailPath && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(first.thumbnailPath)!} alt="" className="h-14 w-10 shrink-0 rounded-md object-cover" />
                    )}
                    <span className="min-w-0">
                      <span className="block text-[13px] text-muted">
                        {LABEL[g.preset] ?? g.preset} · {g.postIds.length} {g.postIds.length === 1 ? "post" : "posts"} · {timeAgo(g.createdAt)}
                      </span>
                      <span className="line-clamp-2 text-sm">{g.output.replace(/[#*_>`]/g, "").trim().slice(0, 140)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {current && (
            <article className="rounded-2xl bg-surface p-5 ring-1 ring-line">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2 text-sm">
                  {current.postIds.map((id) => {
                    const p = posts.find((x) => x.id === id);
                    return (
                      <Link key={id} href={`/post/${id}`} className="rounded-full bg-surface-2 px-3 py-1 hover:underline">
                        @{p?.authorHandle ?? `post ${id}`}
                      </Link>
                    );
                  })}
                </div>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(current.output);
                    setCopied(current.id);
                    setTimeout(() => setCopied(null), 1500);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 ring-line hover:bg-surface-2"
                >
                  {copied === current.id ? <Check size={14} /> : <Copy size={14} />} {copied === current.id ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="prose-out mt-4 max-w-[72ch]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{current.output}</ReactMarkdown>
              </div>
            </article>
          )}
        </div>
      )}
    </main>
  );
}
