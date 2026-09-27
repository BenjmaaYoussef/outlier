import { clearPosts, listPosts } from "@/lib/db";
import { emit } from "@/lib/events";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const u = new URL(req.url);
  const minScore = u.searchParams.get("minScore");
  return json(
    listPosts({
      saved: u.searchParams.get("saved") === "1",
      minScore: minScore ? Number(minScore) : undefined,
    }),
  );
}

export function DELETE() {
  clearPosts();
  emit({ type: "reset" });
  return json({ ok: true });
}
