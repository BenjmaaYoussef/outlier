import fs from "node:fs";
import path from "node:path";
import { MEDIA_DIR } from "@/lib/db";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".mp4": "video/mp4" };

/** Serves downloaded thumbnails and videos, with Range support for video seeking. */
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const name = path.basename((await params).name);
  const file = path.join(MEDIA_DIR, name);
  if (!fs.existsSync(file)) return new Response("Not found", { status: 404 });
  const size = fs.statSync(file).size;
  const type = TYPES[path.extname(name)] ?? "application/octet-stream";
  const range = req.headers.get("range");
  if (range) {
    const [s, e] = range.replace("bytes=", "").split("-");
    const start = Number(s);
    const end = e ? Number(e) : size - 1;
    const stream = fs.createReadStream(file, { start, end });
    return new Response(stream as unknown as ReadableStream, {
      status: 206,
      headers: { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes", "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(fs.createReadStream(file) as unknown as ReadableStream, {
    headers: { "Content-Type": type, "Content-Length": String(size), "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=3600" },
  });
}
