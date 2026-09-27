import { getSettings, saveSettings, type Settings } from "@/lib/db";
import { keyStatus } from "@/lib/env";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET() {
  return json({ ...getSettings(), keys: keyStatus() });
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<Settings>;
  const patch: Partial<Settings> = {};
  if (typeof body.productName === "string") patch.productName = body.productName.slice(0, 200);
  if (typeof body.productDescription === "string") patch.productDescription = body.productDescription.slice(0, 4000);
  if (typeof body.outlierThreshold === "number" && body.outlierThreshold > 0) patch.outlierThreshold = body.outlierThreshold;
  saveSettings(patch);
  return json(getSettings());
}
