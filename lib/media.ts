import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { MEDIA_DIR } from "./db";

const run = promisify(execFile);

/** Downloads a remote file into data/media and returns its file name. */
export async function download(url: string, name: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${name}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  await fs.writeFile(path.join(MEDIA_DIR, name), buf);
  return name;
}

/** Grabs JPEG frames from the opening of a local video with ffmpeg. */
export async function openingFrames(videoFile: string, times = [0.3, 1.0, 2.0]): Promise<Buffer[]> {
  const src = path.join(MEDIA_DIR, videoFile);
  const frames: Buffer[] = [];
  for (const t of times) {
    const out = path.join(MEDIA_DIR, `${path.parse(videoFile).name}-f${t}.jpg`);
    try {
      await run("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(t), "-i", src, "-frames:v", "1", "-vf", "scale=720:-2", "-q:v", "3", out]);
      frames.push(await fs.readFile(out));
      await fs.unlink(out).catch(() => {});
    } catch {
      // video shorter than t, or ffmpeg missing: skip this frame
    }
  }
  return frames;
}

export function median(nums: number[]): number | null {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}
