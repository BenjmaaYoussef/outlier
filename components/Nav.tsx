"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import clsx from "clsx";

const LINKS = [
  { href: "/", label: "Feed" },
  { href: "/write", label: "Writing room" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const path = usePathname();
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="multiplier text-[26px] text-hot">×</span>
          <span className="font-display text-[19px] font-bold tracking-tight">Outlier</span>
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto text-sm [scrollbar-width:none]">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" || path.startsWith("/post") : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "whitespace-nowrap rounded-full px-3 py-1.5 transition-colors",
                  active ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={toggle}
          aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
          className="ml-auto rounded-full p-2 text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
    </header>
  );
}
