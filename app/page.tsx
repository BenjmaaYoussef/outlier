"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { toast } from "sonner";
import { Link2, MoreHorizontal, Sparkles, X } from "lucide-react";
import { PostCard } from "@/components/PostCard";
import { AddLink } from "@/components/AddLink";
import { EmptyFeed } from "@/components/EmptyFeed";
import { useLivePosts, useSettings } from "@/lib/useLivePosts";
import { STEP_LABEL, mediaUrl } from "@/lib/format";
import type { Post } from "@/lib/types";

type Filter = "all" | "outliers" | "saved";
type Sort = "score" | "newest";

export default function FeedPage() {
  const router = useRouter();
  const { posts, setPosts, loaded } = useLivePosts();
  const [settings] = useSettings();
  const threshold = settings?.outlierThreshold ?? 3;
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("score");
  const [selected, setSelected] = useState<number[]>([]);
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);

  const visible = useMemo(() => {
    let list = posts.slice();
    if (filter === "saved") list = list.filter((p) => p.saved);
    if (filter === "outliers") list = list.filter((p) => (p.outlierScore ?? 0) >= threshold);
    list.sort((a, b) =>
      sort === "newest" ? b.id - a.id : (b.outlierScore ?? -1) - (a.outlierScore ?? -1) || b.id - a.id,
    );
    return list;
  }, [posts, filter, sort, threshold]);

  const working = posts.filter((p) => p.status === "captured" || p.status === "enriching");
  const readyCount = posts.filter((p) => p.status === "ready").length;
  const outlierCount = posts.filter((p) => (p.outlierScore ?? 0) >= threshold).length;

  function patchLocal(id: number, patch: Partial<Post>) {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function toggleSave(p: Post) {
    patchLocal(p.id, { saved: !p.saved });
    await fetch(`/api/posts/${p.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ saved: !p.saved }) });
    toast(p.saved ? "Removed from saved" : "Saved");
  }

  function toggleSelect(id: number) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function loadSample() {
    setMenu(false);
    setSelected([]);
    await fetch("/api/demo", { method: "POST" });
    toast("Loading the sample feed");
  }

  async function clearAll() {
    setMenu(false);
    if (!confirm("Remove all captured posts and writing history?")) return;
    setSelected([]);
    await fetch("/api/posts", { method: "DELETE" });
    toast("Feed cleared");
  }

  const selectedPosts = selected.map((id) => posts.find((p) => p.id === id)).filter(Boolean) as Post[];

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-40 pt-8 sm:px-6">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          <h1 className="font-display text-[34px] font-bold leading-none tracking-tight">Feed</h1>
          <p className="mt-2 text-[14.5px] text-ink-2">
            {loaded && posts.length
              ? `${readyCount} of ${posts.length} posts analyzed · ${outlierCount} above ${threshold}× their creator's usual`
              : "Posts captured from your Instagram feed"}
          </p>
        </div>

        {posts.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "outliers", label: "Outliers" },
                { value: "saved", label: "Saved" },
              ]}
            />
            <Segmented
              value={sort}
              onChange={setSort}
              options={[
                { value: "score", label: "Top outliers" },
                { value: "newest", label: "Newest" },
              ]}
            />
            <button
              onClick={() => setAdding(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3.5 text-sm ring-1 ring-line hover:ring-ink-2/50"
            >
              <Link2 size={15} /> Add link
            </button>
            <div className="relative">
              <button
                onClick={() => setMenu((m) => !m)}
                aria-label="More actions"
                className="grid h-9 w-9 place-items-center rounded-full bg-surface ring-1 ring-line hover:ring-ink-2/50"
              >
                <MoreHorizontal size={16} />
              </button>
              {menu && (
                <div className="absolute right-0 top-11 z-20 w-52 rounded-xl bg-surface p-1 text-sm shadow-lg ring-1 ring-line">
                  <button onClick={loadSample} className="w-full rounded-lg px-3 py-2 text-left hover:bg-surface-2">
                    Load sample feed
                  </button>
                  <button onClick={clearAll} className="w-full rounded-lg px-3 py-2 text-left text-danger hover:bg-surface-2">
                    Clear all posts
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {working.length > 0 && (
        <div className="mt-6 flex items-center gap-4 rounded-xl bg-surface px-4 py-3 ring-1 ring-line">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-hot opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-hot" />
          </span>
          <div className="text-sm">
            <span className="font-medium">Analyzing {working.length} {working.length === 1 ? "post" : "posts"}</span>
            <span className="text-muted"> · {STEP_LABEL[working[0].step] ?? "Waiting"}</span>
          </div>
          <div className="ml-auto h-1.5 w-40 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-ink transition-all duration-500"
              style={{ width: `${(readyCount / Math.max(1, posts.length)) * 100}%` }}
            />
          </div>
          <span className="tabular text-sm text-muted">
            {readyCount}/{posts.length}
          </span>
        </div>
      )}

      {loaded && posts.length === 0 ? (
        <EmptyFeed onSample={loadSample} onAdd={() => setAdding(true)} />
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              threshold={threshold}
              selected={selected.includes(p.id)}
              onToggleSelect={() => toggleSelect(p.id)}
              onToggleSave={() => toggleSave(p)}
              onRetry={() => fetch(`/api/posts/${p.id}/retry`, { method: "POST" })}
              onRemove={async () => {
                setPosts((prev) => prev.filter((x) => x.id !== p.id));
                setSelected((s) => s.filter((x) => x !== p.id));
                await fetch(`/api/posts/${p.id}`, { method: "DELETE" });
                toast("Removed from feed");
              }}
            />
          ))}
          {loaded && visible.length === 0 && (
            <p className="col-span-full py-16 text-center text-ink-2">
              {filter === "saved" ? "Nothing saved yet. Use the bookmark on a post to save it." : `No posts above ${threshold}× yet.`}
            </p>
          )}
        </div>
      )}

      {/* selection tray */}
      <div
        className={clsx(
          "fixed inset-x-0 bottom-5 z-30 flex justify-center px-4 transition-all duration-300",
          selectedPosts.length ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0",
        )}
      >
        <div className="flex items-center gap-3 rounded-full bg-ink py-2 pl-2 pr-2 text-bg shadow-2xl">
          <div className="flex -space-x-2">
            {selectedPosts.slice(0, 4).map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={mediaUrl(p.thumbnailPath) ?? ""} alt="" className="h-9 w-7 rounded-md object-cover ring-2 ring-ink" />
            ))}
          </div>
          <span className="text-sm">
            {selectedPosts.length} {selectedPosts.length === 1 ? "post" : "posts"} selected
          </span>
          <button onClick={() => setSelected([])} aria-label="Clear selection" className="rounded-full p-1.5 opacity-70 hover:opacity-100">
            <X size={15} />
          </button>
          <button
            onClick={() => router.push(`/write?ids=${selected.join(",")}`)}
            className="inline-flex items-center gap-1.5 rounded-full bg-hot px-4 py-2 text-sm font-semibold text-white"
          >
            <Sparkles size={15} /> Send to MarioBot
          </button>
        </div>
      </div>

      <AddLink open={adding} onClose={() => setAdding(false)} hasScrapeKey={settings?.keys.scrapecreators ?? false} />
    </main>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex h-9 items-center rounded-full bg-surface p-1 ring-1 ring-line" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "h-7 rounded-full px-3 text-sm transition-colors",
            value === o.value ? "bg-ink text-bg" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
