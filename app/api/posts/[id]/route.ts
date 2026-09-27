import { deletePost, getPost, updatePost } from "@/lib/db";
import { emit } from "@/lib/events";
import { error, json } from "@/lib/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const post = getPost(Number((await params).id));
  return post ? json(post) : error("Post not found", 404);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const body = (await req.json().catch(() => ({}))) as { saved?: boolean };
  if (!getPost(id)) return error("Post not found", 404);
  if (typeof body.saved === "boolean") updatePost(id, { saved: body.saved });
  emit({ type: "post", id });
  return json(getPost(id));
}

export async function DELETE(_: Request, { params }: Ctx) {
  const id = Number((await params).id);
  deletePost(id);
  emit({ type: "removed", id });
  return json({ ok: true });
}
