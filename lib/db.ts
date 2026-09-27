import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { Generation, Post } from "./types";

export const DATA_DIR = path.join(process.cwd(), "data");
export const MEDIA_DIR = path.join(DATA_DIR, "media");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shortcode TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  author_handle TEXT,
  author_name TEXT,
  author_followers INTEGER,
  media_type TEXT,
  metric TEXT,
  views INTEGER,
  likes INTEGER,
  comments INTEGER,
  median_metric REAL,
  baseline_size INTEGER,
  outlier_score REAL,
  caption TEXT,
  visual_hook TEXT,
  spoken_hook TEXT,
  transcript TEXT,
  has_speech INTEGER,
  body TEXT,
  core_idea TEXT,
  thumbnail_path TEXT,
  video_path TEXT,
  duration_sec REAL,
  posted_at TEXT,
  status TEXT NOT NULL DEFAULT 'captured',
  step TEXT NOT NULL DEFAULT 'queued',
  error_msg TEXT,
  saved INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'extension',
  captured_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS generations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_ids TEXT NOT NULL,
  preset TEXT NOT NULL,
  prompt TEXT NOT NULL,
  output TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS creator_baselines (
  handle TEXT PRIMARY KEY,
  median_views REAL,
  median_likes REAL,
  sample_size INTEGER,
  fetched_at TEXT NOT NULL
);
`;

const g = globalThis as unknown as { __outlierDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!g.__outlierDb) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    const d = new DatabaseSync(path.join(DATA_DIR, "outlier.db"));
    d.exec("PRAGMA journal_mode = WAL;");
    d.exec(SCHEMA);
    g.__outlierDb = d;
  }
  return g.__outlierDb;
}

type Row = Record<string, unknown>;

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const snake = (s: string) => s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());

function rowToPost(r: Row): Post {
  const o: Row = {};
  for (const [k, v] of Object.entries(r)) o[camel(k)] = v;
  o.saved = Boolean(r.saved);
  o.hasSpeech = r.has_speech === null ? null : Boolean(r.has_speech);
  return o as unknown as Post;
}

export function listPosts(opts: { saved?: boolean; minScore?: number } = {}): Post[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (opts.saved) where.push("saved = 1");
  if (opts.minScore !== undefined) {
    where.push("outlier_score >= ?");
    args.push(opts.minScore);
  }
  const sql = `SELECT * FROM posts ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC`;
  return (db().prepare(sql).all(...args) as Row[]).map(rowToPost);
}

export function getPost(id: number): Post | null {
  const r = db().prepare("SELECT * FROM posts WHERE id = ?").get(id) as Row | undefined;
  return r ? rowToPost(r) : null;
}

export function getPostByShortcode(shortcode: string): Post | null {
  const r = db().prepare("SELECT * FROM posts WHERE shortcode = ?").get(shortcode) as Row | undefined;
  return r ? rowToPost(r) : null;
}

/** Insert a captured link. Returns the post and whether it was new. */
export function insertCaptured(input: {
  shortcode: string;
  url: string;
  authorHandle?: string | null;
  source?: Post["source"];
}): { post: Post; created: boolean } {
  const existing = getPostByShortcode(input.shortcode);
  if (existing) return { post: existing, created: false };
  const res = db()
    .prepare("INSERT INTO posts (shortcode, url, author_handle, source) VALUES (?, ?, ?, ?)")
    .run(input.shortcode, input.url, input.authorHandle ?? null, input.source ?? "extension");
  return { post: getPost(Number(res.lastInsertRowid))!, created: true };
}

export function updatePost(id: number, patch: Partial<Post>) {
  const keys = Object.keys(patch) as (keyof Post)[];
  if (!keys.length) return;
  const cols = keys.map((k) => `${snake(k)} = ?`).join(", ");
  const vals = keys.map((k) => {
    const v = patch[k];
    if (typeof v === "boolean") return v ? 1 : 0;
    return (v ?? null) as string | number | null;
  });
  db().prepare(`UPDATE posts SET ${cols} WHERE id = ?`).run(...vals, id);
}

export function deletePost(id: number) {
  db().prepare("DELETE FROM posts WHERE id = ?").run(id);
}

export function clearPosts() {
  db().exec("DELETE FROM posts; DELETE FROM generations; DELETE FROM creator_baselines;");
}

// ---------- generations ----------

function rowToGeneration(r: Row): Generation {
  return {
    id: Number(r.id),
    postIds: JSON.parse(String(r.post_ids)),
    preset: String(r.preset),
    prompt: String(r.prompt),
    output: String(r.output),
    model: String(r.model),
    createdAt: String(r.created_at),
  };
}

export function insertGeneration(g: Omit<Generation, "id" | "createdAt">): Generation {
  const res = db()
    .prepare("INSERT INTO generations (post_ids, preset, prompt, output, model) VALUES (?, ?, ?, ?, ?)")
    .run(JSON.stringify(g.postIds), g.preset, g.prompt, g.output, g.model);
  const r = db().prepare("SELECT * FROM generations WHERE id = ?").get(Number(res.lastInsertRowid)) as Row;
  return rowToGeneration(r);
}

export function listGenerations(postId?: number): Generation[] {
  const rows = db().prepare("SELECT * FROM generations ORDER BY id DESC LIMIT 100").all() as Row[];
  const all = rows.map(rowToGeneration);
  return postId === undefined ? all : all.filter((x) => x.postIds.includes(postId));
}

// ---------- settings ----------

export interface Settings {
  productName: string;
  productDescription: string;
  outlierThreshold: number;
}

const DEFAULT_SETTINGS: Settings = {
  productName: "",
  productDescription: "",
  outlierThreshold: 3,
};

export function getSettings(): Settings {
  const rows = db().prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const s: Settings = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) {
    if (key === "outlierThreshold") s.outlierThreshold = Number(value);
    else if (key === "productName" || key === "productDescription") s[key] = value;
  }
  return s;
}

export function saveSettings(patch: Partial<Settings>) {
  const stmt = db().prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  for (const [k, v] of Object.entries(patch)) stmt.run(k, String(v));
}

// ---------- creator baselines (cached so we don't re-fetch per post) ----------

export interface Baseline {
  medianViews: number | null;
  medianLikes: number | null;
  sampleSize: number;
}

export function getBaseline(handle: string, maxAgeHours = 24): Baseline | null {
  const r = db().prepare("SELECT * FROM creator_baselines WHERE handle = ?").get(handle) as Row | undefined;
  if (!r) return null;
  const age = (Date.now() - Date.parse(String(r.fetched_at))) / 36e5;
  if (age > maxAgeHours) return null;
  return {
    medianViews: r.median_views as number | null,
    medianLikes: r.median_likes as number | null,
    sampleSize: Number(r.sample_size),
  };
}

export function saveBaseline(handle: string, b: Baseline) {
  db()
    .prepare(
      `INSERT INTO creator_baselines (handle, median_views, median_likes, sample_size, fetched_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(handle) DO UPDATE SET median_views = excluded.median_views,
         median_likes = excluded.median_likes, sample_size = excluded.sample_size, fetched_at = excluded.fetched_at`,
    )
    .run(handle, b.medianViews, b.medianLikes, b.sampleSize, new Date().toISOString());
}
