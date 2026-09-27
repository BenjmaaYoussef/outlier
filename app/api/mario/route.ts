import { streamMario } from "@/lib/clients/genesis";
import { getPost, getSettings, insertGeneration } from "@/lib/db";
import { env } from "@/lib/env";
import { error } from "@/lib/http";
import { buildPrompt } from "@/lib/prompt";
import type { HookPick, Post } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Sends the selected posts/hooks to MarioBot and streams the reply back as plain text.
 * The finished reply is saved to the generations table.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    postIds?: number[];
    picks?: HookPick[];
    presetId?: string;
    customInstruction?: string;
  } | null;
  const posts = (body?.postIds ?? []).map((id) => getPost(id)).filter(Boolean) as Post[];
  if (!posts.length) return error("Pick at least one post.");
  const presetId = body?.presetId ?? "hooks10";
  if (presetId === "custom" && !body?.customInstruction?.trim()) return error("Write an instruction for MarioBot.");

  const settings = getSettings();
  const prompt = buildPrompt({
    posts,
    picks: body?.picks ?? [],
    presetId,
    customInstruction: body?.customInstruction,
    productName: settings.productName,
    productDescription: settings.productDescription,
  });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let output = "";
      try {
        for await (const chunk of streamMario([{ role: "user", content: prompt }], req.signal)) {
          output += chunk;
          controller.enqueue(enc.encode(chunk));
        }
      } catch (e) {
        if (!req.signal.aborted) controller.enqueue(enc.encode(`\n\n[[error]] ${(e as Error).message}`));
      } finally {
        if (output.trim()) {
          const gen = insertGeneration({ postIds: posts.map((p) => p.id), preset: presetId, prompt, output, model: env.marioSlug });
          try { controller.enqueue(enc.encode(`\n[[saved:${gen.id}]]`)); } catch {}
        }
        try { controller.close(); } catch {}
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}
