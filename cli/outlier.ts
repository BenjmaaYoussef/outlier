/**
 * Outlier CLI: read the same database as the app from the terminal.
 *
 *   pnpm outlier list [--min-score 3] [--saved]
 *   pnpm outlier show <id>
 *   pnpm outlier send <id,...> [--preset hooks10|testset|fullad] [--prompt "custom instruction"]
 *   pnpm outlier export [--format md|json] [--saved]
 */
import { getPost, getSettings, insertGeneration, listPosts } from "../lib/db";
import { streamMario } from "../lib/clients/genesis";
import { env } from "../lib/env";
import { CUSTOM_PRESET_ID, PRESETS, buildPrompt } from "../lib/prompt";
import { compact, formatScore } from "../lib/format";
import type { Post } from "../lib/types";

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? undefined : rest[i + 1];
};
const has = (name: string) => rest.includes(`--${name}`);

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const pink = (s: string) => `\x1b[38;5;205m${s}\x1b[0m`;

function pad(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n);
}

function list() {
  const min = flag("min-score");
  const posts = listPosts({ saved: has("saved"), minScore: min ? Number(min) : undefined }).sort(
    (a, b) => (b.outlierScore ?? -1) - (a.outlierScore ?? -1),
  );
  if (!posts.length) return console.log(dim("No posts yet. Capture some with the extension, or run `pnpm demo`."));
  console.log(dim(`${pad("ID", 5)}${pad("SCORE", 8)}${pad("VIEWS", 8)}${pad("CREATOR", 22)}HOOK`));
  for (const p of posts) {
    const v = p.metric === "likes" ? p.likes : p.views;
    console.log(
      `${pad(String(p.id), 5)}${pink(pad(formatScore(p.outlierScore), 8))}${pad(compact(v), 8)}${pad("@" + (p.authorHandle ?? "?"), 22)}${p.saved ? "★ " : ""}${p.visualHook ?? p.spokenHook ?? p.coreIdea ?? dim(p.status)}`,
    );
  }
}

function show(p: Post) {
  const v = p.metric === "likes" ? p.likes : p.views;
  console.log(`${pink(bold(formatScore(p.outlierScore)))}  ${compact(v)} ${p.metric ?? "views"} vs usually ${compact(p.medianMetric)}  ${dim(p.url)}`);
  console.log(`@${p.authorHandle}${p.authorFollowers !== null ? " " + dim(`${compact(p.authorFollowers)} followers`) : ""}\n`);
  const field = (label: string, value: string | null) => console.log(`${bold(label)}\n${value ?? dim("(none)")}\n`);
  field("Visual hook", p.visualHook);
  field("Spoken hook", p.spokenHook ?? (p.hasSpeech === false ? "(music only, no speech)" : null));
  field("Core idea", p.coreIdea);
  field("Body", p.body);
  field("Caption", p.caption);
  field("Transcript", p.transcript);
}

async function send(ids: number[]) {
  const posts = ids.map(getPost).filter(Boolean) as Post[];
  if (!posts.length) throw new Error("No matching posts. Use `pnpm outlier list` to see ids.");
  const custom = flag("prompt");
  const presetId = custom ? CUSTOM_PRESET_ID : (flag("preset") ?? "hooks10");
  if (!custom && !PRESETS.some((p) => p.id === presetId)) throw new Error(`Unknown preset. Use: ${PRESETS.map((p) => p.id).join(", ")}`);
  const s = getSettings();
  const prompt = buildPrompt({ posts, picks: [], presetId, customInstruction: custom, productName: s.productName, productDescription: s.productDescription });
  console.log(dim(`→ MarioBot (${env.marioSlug}) · ${posts.length} post(s) · ${presetId}\n`));
  let output = "";
  for await (const chunk of streamMario([{ role: "user", content: prompt }])) {
    output += chunk;
    process.stdout.write(chunk);
  }
  const gen = insertGeneration({ postIds: posts.map((p) => p.id), preset: presetId, prompt, output, model: env.marioSlug });
  console.log(dim(`\n\nSaved as generation #${gen.id}. It also shows in the app under History.`));
}

function exportPosts() {
  const posts = listPosts({ saved: has("saved") }).filter((p) => p.status === "ready");
  if ((flag("format") ?? "md") === "json") return console.log(JSON.stringify(posts, null, 2));
  for (const p of posts) {
    console.log(`## ${p.visualHook ?? p.spokenHook ?? p.coreIdea}\n`);
    console.log(`- Source: ${p.url} (@${p.authorHandle})`);
    console.log(`- Outlier: ${formatScore(p.outlierScore)} (${compact(p.metric === "likes" ? p.likes : p.views)} vs usually ${compact(p.medianMetric)})`);
    if (p.visualHook) console.log(`- Visual hook: ${p.visualHook}`);
    if (p.spokenHook) console.log(`- Spoken hook: ${p.spokenHook}`);
    if (p.coreIdea) console.log(`- Core idea: ${p.coreIdea}`);
    if (p.body) console.log(`\n${p.body}`);
    console.log(`\n**Caption:** ${p.caption ?? ""}\n\n---\n`);
  }
}

async function main() {
  switch (cmd) {
    case "list":
      return list();
    case "show": {
      const p = getPost(Number(rest[0]));
      if (!p) throw new Error("No post with that id.");
      return show(p);
    }
    case "send":
      return send((rest[0] ?? "").split(",").map(Number).filter(Boolean));
    case "export":
      return exportPosts();
    default:
      console.log(`Usage:
  pnpm outlier list [--min-score 3] [--saved]
  pnpm outlier show <id>
  pnpm outlier send <id[,id...]> [--preset hooks10|testset|fullad] [--prompt "custom instruction"]
  pnpm outlier export [--format md|json] [--saved]`);
  }
}

main().catch((e) => {
  console.error(`\x1b[31m${(e as Error).message}\x1b[0m`);
  process.exit(1);
});
