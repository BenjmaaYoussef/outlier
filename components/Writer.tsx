"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";
import { toast } from "sonner";
import { Check, ChevronDown, Copy, RotateCw, Sparkles, Square } from "lucide-react";
import { CUSTOM_PRESET_ID, PRESETS, buildPrompt } from "@/lib/prompt";
import { useSettings } from "@/lib/useLivePosts";
import { timeAgo } from "@/lib/format";
import type { Generation, HookPick, Post } from "@/lib/types";

const PRESET_LABEL: Record<string, string> = Object.fromEntries([
  ...PRESETS.map((p) => [p.id, p.label]),
  [CUSTOM_PRESET_ID, "Custom"],
]);

/** The MarioBot panel: pick a preset, send, watch the reply stream in. */
export function Writer({ posts, picks }: { posts: Post[]; picks: HookPick[] }) {
  const [settings] = useSettings();
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [custom, setCustom] = useState("");
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [history, setHistory] = useState<Generation[]>([]);
  const [viewing, setViewing] = useState<Generation | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const outRef = useRef<HTMLDivElement>(null);

  const postIds = useMemo(() => posts.map((p) => p.id), [posts]);
  const key = postIds.join(",");

  const loadHistory = useCallback(async () => {
    if (!postIds.length) return setHistory([]);
    const all: Generation[] = await fetch(`/api/generations?postId=${postIds[0]}`).then((r) => r.json());
    setHistory(all.filter((g) => g.postIds.length === postIds.length && postIds.every((id) => g.postIds.includes(id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const prompt = useMemo(
    () =>
      buildPrompt({
        posts,
        picks,
        presetId,
        customInstruction: custom,
        productName: settings?.productName,
        productDescription: settings?.productDescription,
      }),
    [posts, picks, presetId, custom, settings],
  );

  const send = useCallback(async () => {
    if (streaming || !posts.length) return;
    if (presetId === CUSTOM_PRESET_ID && !custom.trim()) {
      toast.error("Write an instruction for MarioBot first.");
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setViewing(null);
    setOutput("");
    setErrorMsg(null);
    setStreaming(true);
    try {
      const res = await fetch("/api/mario", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postIds, picks, presetId, customInstruction: custom }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        const err = text.match(/\[\[error\]\] ([\s\S]*)$/);
        setOutput(text.replace(/\n?\[\[saved:\d+\]\]\s*$/, "").replace(/\n*\[\[error\]\][\s\S]*$/, ""));
        if (err) setErrorMsg(err[1].replace(/\n?\[\[saved:\d+\]\]\s*$/, ""));
      }
      loadHistory();
    } catch (e) {
      if ((e as Error).name !== "AbortError") setErrorMsg((e as Error).message);
      else loadHistory();
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [streaming, posts.length, presetId, custom, postIds, picks, loadHistory]);

  // Cmd/Ctrl+Enter sends
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [send]);

  // keep the newest text in view while streaming
  useEffect(() => {
    if (streaming && outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight;
  }, [output, streaming]);

  const shown = viewing ? viewing.output : output;

  async function copy() {
    await navigator.clipboard.writeText(shown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="flex flex-col rounded-2xl bg-surface ring-1 ring-line">
      <div className="border-b border-line p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">MarioBot</h2>
          <span className="text-[12.5px] text-muted">
            {picks.length ? `${picks.length} ${picks.length === 1 ? "hook" : "hooks"} picked` : "Using all hooks"} ·{" "}
            {posts.length} {posts.length === 1 ? "post" : "posts"}
          </span>
        </div>

        <div className="mt-3 grid gap-1.5" role="radiogroup" aria-label="What to write">
          {[...PRESETS, { id: CUSTOM_PRESET_ID, label: "Custom", hint: "Your own instruction" }].map((p) => (
            <button
              key={p.id}
              role="radio"
              aria-checked={presetId === p.id}
              onClick={() => setPresetId(p.id)}
              className={clsx(
                "flex items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition",
                presetId === p.id ? "bg-surface-2 ring-1 ring-ink" : "hover:bg-surface-2",
              )}
            >
              <span className="font-medium">{p.label}</span>
              <span className="text-[12.5px] text-muted">{p.hint}</span>
            </button>
          ))}
        </div>

        {presetId === CUSTOM_PRESET_ID && (
          <textarea
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            rows={3}
            placeholder="e.g. Write 5 hooks aimed at men over 40 who've tried TRT"
            className="mt-2 w-full resize-none rounded-lg bg-surface-2 p-3 text-sm outline-none ring-1 ring-line focus:ring-ink-2"
          />
        )}

        {!settings?.productName && settings && (
          <p className="mt-2 text-[13px] text-warm">
            No product set. MarioBot will write without product details. <a href="/settings" className="underline">Add your product</a>
          </p>
        )}

        <div className="mt-3 flex items-center gap-2">
          {streaming ? (
            <button
              onClick={() => abortRef.current?.abort()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-ink py-2.5 text-sm font-semibold text-bg"
            >
              <Square size={13} fill="currentColor" /> Stop
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!posts.length}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-hot py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              <Sparkles size={15} /> Send to MarioBot
              <kbd className="ml-1 rounded bg-white/20 px-1.5 text-[11px] font-normal">⌘↵</kbd>
            </button>
          )}
        </div>

        <button
          onClick={() => setShowPrompt((s) => !s)}
          className="mt-3 inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink"
          aria-expanded={showPrompt}
        >
          <ChevronDown size={13} className={clsx("transition", showPrompt && "rotate-180")} /> Prompt sent to MarioBot
        </button>
        {showPrompt && (
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-[12.5px] leading-relaxed text-ink-2">
            {prompt}
          </pre>
        )}
      </div>

      <div ref={outRef} className="min-h-[220px] flex-1 overflow-auto p-4 lg:max-h-[calc(100vh-420px)]">
        {viewing && (
          <div className="mb-3 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">
            <span>
              {PRESET_LABEL[viewing.preset] ?? viewing.preset} · {timeAgo(viewing.createdAt)}
            </span>
            <button onClick={() => setViewing(null)} className="underline">
              Back to latest
            </button>
          </div>
        )}
        {shown ? (
          <div className={clsx("prose-out", streaming && !viewing && "caret")}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{shown}</ReactMarkdown>
          </div>
        ) : streaming ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="caret" /> MarioBot is reading the post…
          </div>
        ) : (
          <p className="text-sm text-muted">
            Pick what to write and press Send. The reply appears here as MarioBot writes it, and every reply is saved.
          </p>
        )}
        {errorMsg && <p className="mt-3 rounded-lg bg-danger/10 p-3 text-sm text-danger">{errorMsg}</p>}
      </div>

      {(shown && !streaming) || history.length > 0 ? (
        <div className="border-t border-line p-3">
          {shown && !streaming && (
            <div className="flex gap-2">
              <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 ring-line hover:bg-surface-2">
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
              </button>
              {!viewing && (
                <button onClick={send} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 ring-line hover:bg-surface-2">
                  <RotateCw size={14} /> Write another version
                </button>
              )}
            </div>
          )}
          {history.length > 0 && (
            <div className="mt-3">
              <div className="px-1 text-[12.5px] text-muted">Earlier replies</div>
              <ul className="mt-1">
                {history.slice(0, 6).map((g) => (
                  <li key={g.id}>
                    <button
                      onClick={() => setViewing(g)}
                      className={clsx(
                        "flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2",
                        viewing?.id === g.id && "bg-surface-2",
                      )}
                    >
                      <span className="truncate">{g.output.replace(/[#*_>`-]/g, "").trim().slice(0, 70)}</span>
                      <span className="shrink-0 text-[12px] text-muted">
                        {PRESET_LABEL[g.preset] ?? g.preset} · {timeAgo(g.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
