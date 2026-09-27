"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";

/** Paste one or more Instagram links by hand (same pipeline as the extension). */
export function AddLink({ open, onClose, hasScrapeKey }: { open: boolean; onClose: () => void; hasScrapeKey: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => ref.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submit() {
    const links = text.split(/\s+/).filter(Boolean).map((url) => ({ url }));
    if (!links.length) return;
    setBusy(true);
    const res = await fetch("/api/capture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ links, source: "manual" }),
    }).then((r) => r.json());
    setBusy(false);
    type R = { ok: boolean; created?: boolean; skipped?: boolean; reason?: string };
    const skipped = (res.results ?? []).filter((r: R) => r.skipped);
    const bad = (res.results ?? []).filter((r: R) => !r.ok && !r.skipped).length;
    for (const r of skipped) toast.error(`Skipped a post: it's ${r.reason ?? "restricted"}, so it can't be analyzed`);
    const added = (res.results ?? []).filter((r: R) => r.created).length;
    if (added) toast(`Added ${added} ${added === 1 ? "post" : "posts"}`);
    if (bad) toast.error(`${bad} ${bad === 1 ? "link isn't" : "links aren't"} an Instagram post or reel`);
    setText("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-surface p-5 shadow-2xl ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">Add posts by link</h2>
            <p className="mt-1 text-sm text-ink-2">Paste Instagram post or reel links, one per line.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-surface-2">
            <X size={16} />
          </button>
        </div>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && submit()}
          rows={4}
          placeholder="https://www.instagram.com/reel/…"
          className="mt-4 w-full resize-none rounded-xl bg-surface-2 p-3 text-sm outline-none ring-1 ring-line focus:ring-ink-2"
        />
        {!hasScrapeKey && (
          <p className="mt-2 text-[13px] text-warm">
            Add SCRAPECREATORS_API_KEY to .env.local first. Without it, new links will stop at the fetch step.
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm text-ink-2 hover:bg-surface-2">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !text.trim()}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-bg disabled:opacity-40"
          >
            Add posts
          </button>
        </div>
      </div>
    </div>
  );
}
