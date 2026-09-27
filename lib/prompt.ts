import type { HookPick, Post } from "./types";

export interface Preset {
  id: string;
  label: string;
  hint: string;
  instruction: string;
}

export const PRESETS: Preset[] = [
  {
    id: "hooks10",
    label: "10 hooks from this idea",
    hint: "Fresh hooks on the same angle",
    instruction:
      "Write me 10 hooks based on this idea. Hooks only (the opening line or two of an ad), no body copy. Keep the energy and angle of the original, make each one distinct, and number them.",
  },
  {
    id: "testset",
    label: "Hook test set",
    hint: "The original plus 4 variations to test",
    instruction:
      "Build a hook test set for one ad. Hooks only, no body copy. Hook #1 is the original hook exactly as written, then write 4 variations that test different entry points (curiosity, pain, contrarian claim, specific result). Label each with the angle it tests.",
  },
  {
    id: "fullad",
    label: "Full ad from the original hook",
    hint: "Keep the exact hook, write the rest fresh",
    instruction:
      "Write a complete ad. Keep the original hook exactly as written as the opening line, then write the body fresh from there for our product. End with a clear call to action.",
  },
];

export const CUSTOM_PRESET_ID = "custom";

const KIND_LABEL: Record<HookPick["kind"], string> = {
  visual: "On-screen (visual) hook",
  spoken: "Spoken (audio) hook",
  caption: "Caption hook",
};

function fmt(n: number | null) {
  if (n === null) return "?";
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n);
}

function describePost(p: Post, picks: HookPick[], i: number): string {
  const lines = [`### Source post ${i + 1}: ${p.url}`];
  lines.push(
    `Creator: @${p.authorHandle ?? "unknown"} · ${fmt(p.metric === "views" ? p.views : p.likes)} ${p.metric ?? "views"}` +
      (p.outlierScore ? ` · ${p.outlierScore}× their usual (outlier)` : ""),
  );
  const chosen = picks.filter((h) => h.postId === p.id);
  if (chosen.length) {
    lines.push("", "Hooks I picked from this post:");
    for (const h of chosen) lines.push(`- ${KIND_LABEL[h.kind]}: "${h.text}"`);
  } else {
    if (p.visualHook) lines.push(`On-screen (visual) hook: "${p.visualHook}"`);
    if (p.spokenHook) lines.push(`Spoken (audio) hook: "${p.spokenHook}"`);
  }
  if (p.coreIdea) lines.push("", `Core idea: ${p.coreIdea}`);
  if (p.body) lines.push("", "Body of the post:", p.body);
  if (p.caption) lines.push("", "Caption:", p.caption.slice(0, 1200));
  return lines.join("\n");
}

export function buildPrompt(args: {
  posts: Post[];
  picks: HookPick[];
  presetId: string;
  customInstruction?: string;
  productName?: string;
  productDescription?: string;
}): string {
  const preset = PRESETS.find((p) => p.id === args.presetId);
  const instruction =
    args.presetId === CUSTOM_PRESET_ID ? (args.customInstruction ?? "").trim() : (preset?.instruction ?? "");

  const parts: string[] = [instruction];

  if (args.productName || args.productDescription) {
    parts.push(
      "",
      "## Our product",
      [args.productName, args.productDescription].filter(Boolean).join(": "),
    );
  }

  parts.push(
    "",
    "## Source material (organic Instagram posts that outperformed)",
    "These went viral organically. The hook is what earned the attention, so keep the exact hook where you use it and write the rest fresh for our product.",
    "",
    args.posts.map((p, i) => describePost(p, args.picks, i)).join("\n\n"),
  );

  return parts.join("\n");
}
