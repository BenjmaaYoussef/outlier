"use client";
import { useEffect, useState } from "react";
import type { Post } from "./types";

/** Loads posts and keeps them in sync with the server over SSE. */
export function useLivePosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/posts")
        .then((r) => r.json())
        .then((p: Post[]) => {
          if (alive) {
            setPosts(p);
            setLoaded(true);
          }
        });
    load();
    const es = new EventSource("/api/events");
    es.onmessage = (m) => {
      const e = JSON.parse(m.data);
      if (e.type === "post") {
        setPosts((prev) => {
          const i = prev.findIndex((p) => p.id === e.post.id);
          if (i === -1) return [e.post, ...prev];
          const next = prev.slice();
          next[i] = e.post;
          return next;
        });
      } else if (e.type === "removed") {
        setPosts((prev) => prev.filter((p) => p.id !== e.id));
      } else if (e.type === "reset") {
        setPosts([]);
      }
    };
    es.onerror = () => {
      // EventSource reconnects on its own; reload once it does
      es.onopen = () => load();
    };
    return () => {
      alive = false;
      es.close();
    };
  }, []);

  return { posts, setPosts, loaded };
}

export function useSettings() {
  const [settings, setSettings] = useState<{
    productName: string;
    productDescription: string;
    outlierThreshold: number;
    keys: { genesis: boolean; openrouter: boolean; scrapecreators: boolean };
  } | null>(null);
  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
  }, []);
  return [settings, setSettings] as const;
}
