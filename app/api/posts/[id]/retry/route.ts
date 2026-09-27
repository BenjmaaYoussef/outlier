import { getPost } from "@/lib/db";
import { error, json } from "@/lib/http";
import { enqueue } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!getPost(id)) return error("Post not found", 404);
  enqueue(id);
  return json({ ok: true });
}
