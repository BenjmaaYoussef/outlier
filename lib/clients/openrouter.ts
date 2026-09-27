import { env } from "../env";

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

async function complete(content: Part[], opts: { json?: boolean } = {}): Promise<string> {
  if (!env.openrouterKey) throw new Error("OPENROUTER_API_KEY is missing. Add it to .env.local.");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openrouterKey}`,
      "Content-Type": "application/json",
      "X-Title": "Outlier",
    },
    body: JSON.stringify({
      model: env.visionModel,
      temperature: 0,
      messages: [{ role: "user", content }],
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const json = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  } | null;
  if (!res.ok) throw new Error(`OpenRouter failed (${res.status}): ${json?.error?.message ?? "unknown error"}`);
  return json?.choices?.[0]?.message?.content?.trim() ?? "";
}

/**
 * Reads the on-screen text from the first seconds of a video (the visual hook).
 * Frames are JPEG buffers taken from the opening of the video.
 */
export async function readVisualHook(frames: Buffer[]): Promise<string | null> {
  if (!frames.length) return null;
  const out = await complete([
    {
      type: "text",
      text:
        "These are frames from the first ~2 seconds of an Instagram reel, in order. " +
        "Transcribe the large on-screen hook text overlaid on the video (the headline meant to stop the scroll). " +
        "Ignore Instagram UI, usernames, watermarks and small captions burned in from speech. " +
        "Keep the original wording and emojis; join lines into one sentence. " +
        "If there is no overlaid hook text, reply exactly: NONE",
    },
    ...frames.map((f) => ({
      type: "image_url" as const,
      image_url: { url: `data:image/jpeg;base64,${f.toString("base64")}` },
    })),
  ]);
  const clean = out.replace(/^["'\s]+|["'\s]+$/g, "");
  return !clean || clean.toUpperCase() === "NONE" ? null : clean;
}

export interface Structured {
  spokenHook: string | null;
  body: string | null;
  coreIdea: string | null;
}

/** Splits a post into spoken hook, body and a one-line core idea. */
export async function structurePost(input: {
  caption: string;
  transcript: string | null;
  visualHook: string | null;
}): Promise<Structured> {
  const out = await complete(
    [
      {
        type: "text",
        text: `You are helping an ad creative strategist break down a viral Instagram post into reusable parts.

VISUAL HOOK (on-screen text at the start): ${input.visualHook ?? "(none)"}
TRANSCRIPT (spoken audio): ${input.transcript ?? "(no speech, music only)"}
CAPTION: ${input.caption || "(empty)"}

Return JSON with exactly these keys:
- "spoken_hook": the opening line actually spoken in the transcript, verbatim: the first sentence only (if it runs past ~30 words, cut at the first natural break). null if there is no transcript.
- "body": the main content after the hook, as a short verbatim-leaning outline (bullets with "- " are fine). Use the transcript if there is one, otherwise the caption and visual hook.
- "core_idea": one plain sentence describing the underlying idea or angle, under 20 words.`,
      },
    ],
    { json: true },
  );
  const s = out.replace(/^```(?:json)?|```$/g, "").trim();
  const j = JSON.parse(s) as Record<string, string | null>;
  const pick = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return { spokenHook: pick(j.spoken_hook), body: pick(j.body), coreIdea: pick(j.core_idea) };
}

export async function pingOpenRouter(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${env.openrouterKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
