"use client";
import Link from "next/link";

/** First-run screen: how to get posts in. */
export function EmptyFeed({ onSample, onAdd }: { onSample: () => void; onAdd: () => void }) {
  const steps = [
    {
      title: "Install the Outlier extension",
      text: (
        <>
          In Chrome, open <code className="rounded bg-surface-2 px-1 text-[13px]">chrome://extensions</code>, turn on Developer
          mode, click Load unpacked and pick the <code className="rounded bg-surface-2 px-1 text-[13px]">extension</code> folder.
        </>
      ),
    },
    { title: "Open Instagram on your primed account", text: "Log in as usual in the same Chrome. The extension never sees your password." },
    {
      title: "Press Start capture and scroll",
      text: "Each post you scroll past is saved here, up to 10, and analyzed live: views vs. the creator's usual, hooks, transcript.",
    },
  ];
  return (
    <section className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
      <div>
        <p className="max-w-[46ch] font-display text-[28px] font-semibold leading-[1.15] tracking-tight">
          Scroll your feed. We keep the posts that did far better than usual, and break them into hooks you can write from.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={onSample} className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg">
            Load sample feed
          </button>
          <button onClick={onAdd} className="rounded-full bg-surface px-5 py-2.5 text-sm ring-1 ring-line hover:ring-ink-2/50">
            Paste a link instead
          </button>
          <Link href="/settings" className="rounded-full px-5 py-2.5 text-sm text-ink-2 hover:text-ink">
            Set up your product
          </Link>
        </div>
      </div>
      <ol className="space-y-5">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span className="multiplier mt-0.5 w-6 shrink-0 text-[28px] text-muted">{i + 1}</span>
            <div>
              <h3 className="font-medium">{s.title}</h3>
              <p className="mt-1 max-w-[52ch] text-[14.5px] leading-relaxed text-ink-2">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
