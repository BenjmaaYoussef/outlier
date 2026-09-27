import { keyStatus } from "@/lib/env";
import { pingGenesis } from "@/lib/clients/genesis";
import { pingOpenRouter } from "@/lib/clients/openrouter";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const [genesis, openrouter] = await Promise.all([pingGenesis(), pingOpenRouter()]);
  return json({ app: "outlier", keys: keyStatus(), genesis, openrouter });
}
