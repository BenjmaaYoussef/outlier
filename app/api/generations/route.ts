import { listGenerations } from "@/lib/db";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const postId = new URL(req.url).searchParams.get("postId");
  return json(listGenerations(postId ? Number(postId) : undefined));
}
