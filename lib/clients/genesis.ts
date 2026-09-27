import { env } from "../env";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Streams a MarioBot reply from the Genesis server, yielding text chunks.
 * Genesis is OpenAI-compatible, and also needs the OpenRouter key as the
 * model provider key (X-Provider-Key).
 */
export async function* streamMario(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string> {
  if (!env.genesisKey) throw new Error("GENESIS_API_KEY is missing. Add it to .env.local.");
  if (!env.openrouterKey) throw new Error("OPENROUTER_API_KEY is missing. Genesis needs it as the provider key.");

  const res = await fetch(`${env.genesisBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.genesisKey}`,
      "X-Provider-Key": env.openrouterKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: env.marioSlug, stream: true, messages }),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    let msg = text;
    try {
      msg = JSON.parse(text)?.error?.message ?? text;
    } catch {}
    throw new Error(`MarioBot request failed (${res.status}): ${msg.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (delta) yield delta as string;
      } catch {
        // ignore keep-alives and partial lines
      }
    }
  }
}

export async function pingGenesis(): Promise<{ ok: boolean; marioFound: boolean; error?: string }> {
  try {
    const res = await fetch(`${env.genesisBaseUrl}/models`, {
      headers: { Authorization: `Bearer ${env.genesisKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, marioFound: false, error: `HTTP ${res.status}` };
    const json = (await res.json()) as { data?: { id: string }[] };
    return { ok: true, marioFound: Boolean(json.data?.some((m) => m.id === env.marioSlug)) };
  } catch (e) {
    return { ok: false, marioFound: false, error: (e as Error).message };
  }
}
