"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { toast } from "sonner";
import { useSettings } from "@/lib/useLivePosts";

export default function SettingsPage() {
  const [settings] = useSettings();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [threshold, setThreshold] = useState(3);
  const [health, setHealth] = useState<{ genesis: { ok: boolean; marioFound: boolean }; openrouter: { ok: boolean } } | null>(null);

  useEffect(() => {
    if (!settings) return;
    setName(settings.productName);
    setDesc(settings.productDescription);
    setThreshold(settings.outlierThreshold);
  }, [settings]);

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth);
  }, []);

  async function save() {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productName: name, productDescription: desc, outlierThreshold: threshold }),
    });
    toast("Settings saved");
  }

  const keys = settings?.keys;
  const rows = [
    { label: "MarioBot (Genesis)", ok: keys?.genesis && health?.genesis.ok && health.genesis.marioFound, env: "GENESIS_API_KEY", pending: !health },
    { label: "OpenRouter", ok: keys?.openrouter && health?.openrouter.ok, env: "OPENROUTER_API_KEY", pending: !health },
    { label: "ScrapeCreators", ok: keys?.scrapecreators, env: "SCRAPECREATORS_API_KEY", pending: !keys },
  ];

  return (
    <main className="mx-auto max-w-[760px] px-4 pb-16 pt-8 sm:px-6">
      <h1 className="font-display text-[34px] font-bold leading-none tracking-tight">Settings</h1>

      <section className="mt-8 rounded-2xl bg-surface p-5 ring-1 ring-line">
        <h2 className="font-display text-lg font-bold">Your product</h2>
        <p className="mt-1 text-sm text-ink-2">Added to every MarioBot request so the hooks and ads are written for it.</p>
        <label className="mt-4 block text-sm font-medium" htmlFor="pname">Product name</label>
        <input
          id="pname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Prime Daily testosterone support"
          className="mt-1.5 w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none ring-1 ring-line focus:ring-ink-2"
        />
        <label className="mt-4 block text-sm font-medium" htmlFor="pdesc">What it is and who it&apos;s for</label>
        <textarea
          id="pdesc"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={4}
          placeholder="Ingredients, the main promise, the audience, the offer…"
          className="mt-1.5 w-full resize-none rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none ring-1 ring-line focus:ring-ink-2"
        />
      </section>

      <section className="mt-5 rounded-2xl bg-surface p-5 ring-1 ring-line">
        <h2 className="font-display text-lg font-bold">Outlier threshold</h2>
        <p className="mt-1 text-sm text-ink-2">
          A post counts as an outlier when it gets this many times the creator&apos;s usual views. Twice this number shows as hot.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <input
            type="range"
            min={1.5}
            max={10}
            step={0.5}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="flex-1 accent-[var(--heat-hot)]"
            aria-label="Outlier threshold"
          />
          <span className="multiplier tabular w-20 text-right text-[40px] text-warm">{threshold}×</span>
        </div>
      </section>

      <div className="mt-5 flex justify-end">
        <button onClick={save} className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg">
          Save settings
        </button>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-lg font-bold">Connections</h2>
        <p className="mt-1 text-sm text-ink-2">Keys live in <code className="rounded bg-surface-2 px-1">.env.local</code> and never leave this machine.</p>
        <ul className="mt-3 divide-y divide-line rounded-2xl bg-surface ring-1 ring-line">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between px-5 py-3 text-sm">
              <span>{r.label}</span>
              <span className={clsx("flex items-center gap-2", r.ok ? "text-ok" : "text-muted")}>
                <span className={clsx("h-2 w-2 rounded-full", r.ok ? "bg-ok" : "bg-muted/50")} />
                {r.ok ? "Connected" : r.pending ? "Checking…" : `Add ${r.env} to .env.local`}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
