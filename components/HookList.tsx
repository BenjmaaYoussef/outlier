"use client";
import clsx from "clsx";
import { Check, Eye, MessageSquareText, Mic } from "lucide-react";
import type { HookPick, Post } from "@/lib/types";

export function hooksOf(post: Post): HookPick[] {
  const out: HookPick[] = [];
  if (post.visualHook) out.push({ postId: post.id, kind: "visual", text: post.visualHook });
  if (post.spokenHook) out.push({ postId: post.id, kind: "spoken", text: post.spokenHook });
  const firstLine = post.caption?.split("\n").find((l) => l.trim())?.trim();
  if (firstLine) out.push({ postId: post.id, kind: "caption", text: firstLine });
  return out;
}

const META = {
  visual: { label: "On screen", icon: Eye },
  spoken: { label: "Spoken", icon: Mic },
  caption: { label: "Caption opening", icon: MessageSquareText },
} as const;

export const samePick = (a: HookPick, b: HookPick) => a.postId === b.postId && a.kind === b.kind;

/** The hooks of one post, each one selectable for MarioBot. */
export function HookList({
  post,
  picks,
  onToggle,
  size = "lg",
}: {
  post: Post;
  picks: HookPick[];
  onToggle: (h: HookPick) => void;
  size?: "lg" | "sm";
}) {
  const hooks = hooksOf(post);
  const noSpeech = post.hasSpeech === false;
  return (
    <ul className="space-y-2">
      {hooks.map((h) => {
        const on = picks.some((p) => samePick(p, h));
        const { label, icon: Icon } = META[h.kind];
        return (
          <li key={h.kind}>
            <button
              onClick={() => onToggle(h)}
              aria-pressed={on}
              className={clsx(
                "flex w-full items-start gap-3 rounded-xl p-3 text-left transition",
                on ? "bg-ink text-bg" : "bg-surface-2 hover:bg-line/60",
              )}
            >
              <span
                className={clsx(
                  "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2",
                  on ? "border-bg bg-bg text-ink" : "border-muted/60",
                )}
              >
                {on && <Check size={12} strokeWidth={3.5} />}
              </span>
              <span className="min-w-0">
                <span className={clsx("flex items-center gap-1.5 text-[12.5px]", on ? "text-bg/70" : "text-muted")}>
                  <Icon size={13} /> {label}
                </span>
                <span className={clsx("mt-0.5 block font-medium leading-snug", size === "lg" ? "text-[17px]" : "text-[14.5px]")}>
                  {h.text}
                </span>
              </span>
            </button>
          </li>
        );
      })}
      {noSpeech && (
        <li className="flex items-center gap-2 px-3 text-[13px] text-muted">
          <Mic size={13} /> No spoken hook: this post is music only.
        </li>
      )}
    </ul>
  );
}
