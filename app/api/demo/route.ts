import { loadDemo } from "@/lib/demo";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Loads the sample feed. Runs in the background so the UI can watch it fill in. */
export function POST() {
  loadDemo({ animate: true }).catch(() => {});
  return json({ ok: true });
}
