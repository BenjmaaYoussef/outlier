// Outlier content script. Two sources, picked in the popup:
//  - "home":  the home feed (instagram.com/). Captures the link of each post
//             the user looks at (60% visible for ~0.8s).
//  - "reels": the Reels tab (instagram.com/reels/). Instagram puts the current
//             reel's code in the address bar (/reels/<code>/), so we capture
//             whichever reel stays on screen for ~0.8s.
// It only reads post links and the author handle, never page content or
// account data, which keeps it robust to Instagram layout changes.

(() => {
  const DEFAULTS = { capturing: false, autoScroll: false, limit: 10, captured: [], source: "home" };
  const DWELL_MS = 800;
  const POST_LINK = /\/(p|reel|reels)\/([A-Za-z0-9_-]{5,})/;

  let state = { ...DEFAULTS };
  const timers = new WeakMap();
  const seenArticles = new WeakSet();
  let hud = null;
  let toastTimer = null;
  let scrollTimer = null;

  // ---------- state ----------

  async function load() {
    state = await chrome.storage.local.get(DEFAULTS);
    render();
    syncAutoScroll();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const [k, { newValue }] of Object.entries(changes)) state[k] = newValue;
    render();
    syncAutoScroll();
    if (changes.capturing && state.capturing) {
      scanVisible();
      checkReel();
    }
  });

  const onHome = () => location.pathname === "/" || location.pathname === "";
  const onReels = () => location.pathname.startsWith("/reels");
  /** True when the current page is the source the user picked. */
  const active = () => state.capturing && (state.source === "reels" ? onReels() : onHome());
  const full = () => state.captured.length >= state.limit;

  // ---------- sending ----------

  /**
   * Saves one post. Returns "ok", "dupe", "full", "fail", or { skipped: reason }
   * when the app can't analyze it (age-restricted, private, deleted). Skipped
   * posts don't count toward the limit.
   */
  async function send(link, authorHandle) {
    if (full()) return "full";
    if (state.captured.includes(link.shortcode)) return "dupe";
    const captured = [...state.captured, link.shortcode];
    await chrome.storage.local.set({ captured });
    const res = await chrome.runtime.sendMessage({ type: "capture", link: { url: link.url, authorHandle } });
    const result = res && res.ok && res.data && res.data.results && res.data.results[0];
    if (!res || !res.ok || !result) {
      await chrome.storage.local.set({ captured: state.captured.filter((s) => s !== link.shortcode) });
      return "fail";
    }
    if (result.skipped) {
      await chrome.storage.local.set({ captured: state.captured.filter((s) => s !== link.shortcode) });
      return { skipped: result.reason || "restricted" };
    }
    if (captured.length >= state.limit) await chrome.storage.local.set({ capturing: false, autoScroll: false });
    return "ok";
  }

  const toLink = (kind, code) => ({ shortcode: code, url: `https://www.instagram.com/${kind === "p" ? "p" : "reel"}/${code}/` });

  // ---------- home feed ----------

  function postLink(article) {
    for (const a of article.querySelectorAll("a[href]")) {
      const m = a.getAttribute("href").match(POST_LINK);
      if (m) return toLink(m[1], m[2]);
    }
    return null;
  }

  function authorHandle(root) {
    // The first profile link in the post header is the author.
    const header = root.querySelector("header") || root;
    for (const a of header.querySelectorAll("a[href]")) {
      // Profile links look like /name/ (home feed) or /name/reels/ (Reels tab).
      const m = a.getAttribute("href").match(/^\/([A-Za-z0-9._]{1,30})\/(?:reels\/)?$/);
      if (m && !["explore", "reels", "direct", "accounts"].includes(m[1])) return m[1];
    }
    return null;
  }

  /** Ads carry a small label that reads exactly "Sponsored" (or "Ad"); captions don't count. */
  const isSponsored = (root) =>
    [...root.querySelectorAll("span, a, div")].some(
      (n) => n.childElementCount === 0 && /^(Sponsored|Ad)$/i.test((n.textContent || "").trim()),
    );

  async function captureArticle(article) {
    if (!active() || state.source !== "home" || full() || seenArticles.has(article)) return;
    const link = postLink(article);
    if (!link) return;
    seenArticles.add(article);
    if (isSponsored(article)) return pill(article, "Skipped ad", "skip");

    pill(article, "Checking…", "skip");
    const result = await send(link, authorHandle(article));
    if (result && result.skipped) pill(article, `Skipped: ${result.skipped}`, "skip");
    else if (result === "ok") pill(article, `<b>✓</b> Captured ${state.captured.length}/${state.limit}`);
    else if (result === "dupe") pill(article, "Already captured", "skip");
    else if (result === "fail") {
      pill(article, "Outlier app not running", "fail");
      seenArticles.delete(article);
    }
  }

  function pill(article, html, kind = "") {
    article.querySelectorAll(".outlier-pill").forEach((n) => n.remove());
    if (getComputedStyle(article).position === "static") article.style.position = "relative";
    const el = document.createElement("div");
    el.className = `outlier-pill ${kind}`;
    el.innerHTML = html;
    article.appendChild(el);
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const article = e.target;
        if (e.isIntersecting && e.intersectionRatio >= 0.6) {
          if (!timers.has(article)) timers.set(article, setTimeout(() => captureArticle(article), DWELL_MS));
        } else if (timers.has(article)) {
          clearTimeout(timers.get(article));
          timers.delete(article);
        }
      }
    },
    { threshold: [0, 0.6, 1] },
  );

  function observeArticles() {
    if (!onHome()) return;
    document.querySelectorAll("main article").forEach((a) => {
      if (!a.dataset.outlierObserved) {
        a.dataset.outlierObserved = "1";
        io.observe(a);
      }
    });
  }

  function scanVisible() {
    if (!onHome()) return;
    document.querySelectorAll("main article").forEach((a) => {
      const r = a.getBoundingClientRect();
      const visible = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
      if (visible / Math.max(1, Math.min(r.height, innerHeight)) >= 0.6) captureArticle(a);
    });
  }

  new MutationObserver(observeArticles).observe(document.body, { childList: true, subtree: true });

  // ---------- reels tab ----------

  /** The video taking up most of the screen right now. */
  function mainVideo() {
    let best = null;
    let bestArea = 0;
    for (const v of document.querySelectorAll("video")) {
      const r = v.getBoundingClientRect();
      const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
      const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      if (w * h > bestArea) {
        bestArea = w * h;
        best = v;
      }
    }
    return best;
  }

  /** Walks up from the playing video to the block that also holds the creator's link. */
  function reelContainer(video) {
    let el = video;
    for (let i = 0; i < 20 && el.parentElement; i++) {
      el = el.parentElement;
      if (authorHandle(el)) return el;
    }
    return video.parentElement || document.body;
  }

  function currentReel() {
    const m = location.pathname.match(/^\/reels?\/([A-Za-z0-9_-]{5,})/);
    if (m) return toLink("reel", m[1]);
    // Fallback: a reel link next to the video on screen.
    const v = mainVideo();
    return v ? postLink(reelContainer(v)) : null;
  }

  let reelTimer = null;
  let reelPending = null;
  const seenReels = new Set();

  function checkReel() {
    if (!active() || state.source !== "reels" || full()) return;
    const link = currentReel();
    if (!link || link.shortcode === reelPending || seenReels.has(link.shortcode)) return;
    clearTimeout(reelTimer);
    reelPending = link.shortcode;
    reelTimer = setTimeout(async () => {
      const now = currentReel();
      reelPending = null;
      if (!now || now.shortcode !== link.shortcode || !active()) return; // scrolled away
      seenReels.add(link.shortcode);
      const v = mainVideo();
      const box = v ? reelContainer(v) : document.body;
      if (isSponsored(box)) return flash("Skipped ad", "skip");
      flash("Checking…", "skip");
      const result = await send(link, authorHandle(box));
      if (result && result.skipped) flash(`Skipped: ${result.skipped}`, "skip");
      else if (result === "ok") flash(`<b>✓</b> Captured ${state.captured.length}/${state.limit}`);
      else if (result === "dupe") flash("Already captured", "skip");
      else if (result === "fail") {
        flash("Outlier app not running", "fail");
        seenReels.delete(link.shortcode);
      }
    }, DWELL_MS);
  }

  // ---------- optional auto-scroll ----------
  // Off by default: automated scrolling is the riskiest part for the account.

  // Home feed: scroll the page. Reels: Instagram ignores scripted input there
  // (tested), so the background worker sends a real click on the "next reel"
  // arrow through Chrome's debugger API.
  function syncAutoScroll() {
    const on = active() && state.autoScroll && !full();
    if (on && !scrollTimer) scheduleScroll();
    if (!on && scrollTimer) {
      clearTimeout(scrollTimer);
      scrollTimer = null;
    }
  }

  function scheduleScroll() {
    // Human-ish pacing: 4 to 9 seconds per post (6 to 11 on Reels, where
    // Instagram updates the address bar a moment after the reel changes).
    const wait = (state.source === "reels" ? 6000 : 4000) + Math.random() * 5000;
    scrollTimer = setTimeout(async () => {
      if (state.source === "reels") {
        const ok = await swipeReel();
        if (!ok) return;
      } else {
        window.scrollBy({ top: innerHeight * (0.7 + Math.random() * 0.35), behavior: "smooth" });
      }
      scheduleScroll();
    }, wait);
  }

  async function swipeReel() {
    const arrow = document.querySelector('[aria-label="Navigate to next Reel"]');
    const v = mainVideo();
    const msg = { type: "swipe" };
    if (arrow) {
      const r = arrow.getBoundingClientRect();
      // Click somewhere inside the arrow, not always the exact center.
      msg.clickX = r.left + r.width * (0.35 + Math.random() * 0.3);
      msg.clickY = r.top + r.height * (0.35 + Math.random() * 0.3);
    } else if (v) {
      const r = v.getBoundingClientRect();
      msg.x = r.left + r.width / 2;
      msg.y = r.top + r.height / 2;
    } else return true;
    const res = await chrome.runtime.sendMessage(msg);
    if (!res || !res.ok) {
      flash("Auto-scroll couldn't swipe. Reload the extension and try again.", "fail");
      await chrome.storage.local.set({ autoScroll: false });
      return false;
    }
    return true;
  }

  // ---------- on-page HUD ----------

  function render() {
    if (!active()) {
      hud?.remove();
      hud = null;
      return;
    }
    if (!hud) {
      hud = document.createElement("div");
      hud.className = "outlier-hud";
      document.body.appendChild(hud);
    }
    const n = state.captured.length;
    const where = state.source === "reels" ? "Reels" : "home feed";
    hud.innerHTML = `<span class="dot"></span><span>Outlier ${state.autoScroll ? "auto-scrolling" : "capturing"} ${where} · ${n}/${state.limit}</span><span class="bar"><i style="width:${(n / state.limit) * 100}%"></i></span><span class="toast"></span><button title="Stop">Stop</button>`;
    hud.querySelector("button").onclick = () => chrome.storage.local.set({ capturing: false, autoScroll: false });
  }

  /** Short message in the HUD (the Reels tab has no post card to tag). */
  function flash(html, kind = "") {
    render();
    const t = hud?.querySelector(".toast");
    if (!t) return;
    t.className = `toast ${kind}`;
    t.innerHTML = html;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t && (t.innerHTML = ""), 2500);
  }

  // Instagram is a single-page app: react when the URL changes.
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      render();
      syncAutoScroll();
      observeArticles();
    }
    checkReel();
  }, 400);

  load().then(observeArticles);
})();
