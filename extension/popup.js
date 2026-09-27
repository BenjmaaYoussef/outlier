const DEFAULTS = { capturing: false, autoScroll: false, limit: 10, captured: [], appUrl: "http://localhost:3000", source: "home" };
const SOURCES = {
  home: { url: "https://www.instagram.com/", onPage: (u) => /^https:\/\/www\.instagram\.com\/?(\?|$)/.test(u), name: "home feed" },
  reels: { url: "https://www.instagram.com/reels/", onPage: (u) => u.startsWith("https://www.instagram.com/reels"), name: "Reels" },
};
const $ = (id) => document.getElementById(id);

async function render() {
  const s = await chrome.storage.local.get(DEFAULTS);
  const n = s.captured.length;
  $("n").textContent = n;
  $("of").textContent = `of ${s.limit} posts captured`;
  $("bar").style.width = `${(n / s.limit) * 100}%`;
  $("toggle").textContent = s.capturing ? "Stop capture" : n >= s.limit ? "Done: open Outlier" : "Start capture";
  $("toggle").classList.toggle("stop", s.capturing);
  $("auto").checked = s.autoScroll;
  $("autoNote").textContent = s.source === "reels"
    ? "Riskier: can get the account flagged. On Reels, Chrome shows a \"started debugging\" bar while it swipes."
    : "Riskier: automated scrolling can get the account flagged. Use a spare account.";
  document.querySelectorAll("[data-source]").forEach((b) => {
    b.setAttribute("aria-checked", String(b.dataset.source === s.source));
    b.disabled = s.capturing;
  });
  $("hint").textContent = s.capturing
    ? s.autoScroll ? "Scrolling slowly and saving each post it stops on." : s.source === "reels" ? "Swipe through Reels. Each reel you watch for a moment is saved (the first one counts after your first swipe)." : "Scroll your feed. Each post you stop on is saved."
    : n >= s.limit ? "All posts captured. They're being analyzed in the app." : `Press Start: it opens your ${SOURCES[s.source].name}. Then scroll, and each post you stop on is saved.`;
}

async function ping() {
  const res = await chrome.runtime.sendMessage({ type: "ping" });
  const el = $("status");
  el.classList.toggle("on", Boolean(res && res.ok));
  el.querySelector("span").textContent = res && res.ok ? "App connected" : "App not running";
  if (!res || !res.ok) {
    $("err").style.display = "block";
    $("err").textContent = "Start the app with `pnpm dev` in the outlier folder, then reopen this popup.";
  }
}

$("toggle").onclick = async () => {
  const s = await chrome.storage.local.get(DEFAULTS);
  if (!s.capturing && s.captured.length >= s.limit) return openApp();
  await chrome.storage.local.set({ capturing: !s.capturing, ...(s.capturing ? { autoScroll: false } : {}) });
  if (!s.capturing) {
    // Go to the chosen source: reuse the current Instagram tab, or open one.
    const src = SOURCES[s.source];
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.startsWith("https://www.instagram.com")) {
      if (!src.onPage(tab.url)) chrome.tabs.update(tab.id, { url: src.url });
    } else chrome.tabs.create({ url: src.url });
  }
};
document.querySelectorAll("[data-source]").forEach((b) => {
  b.onclick = () => chrome.storage.local.set({ source: b.dataset.source });
});
$("auto").onchange = async (e) => {
  const on = e.target.checked;
  chrome.storage.local.set({ autoScroll: on });
};
$("reset").onclick = () => chrome.storage.local.set({ captured: [], capturing: false, autoScroll: false });
async function openApp() {
  const { appUrl } = await chrome.storage.local.get(DEFAULTS);
  chrome.tabs.create({ url: appUrl });
}
$("open").onclick = openApp;

chrome.storage.onChanged.addListener(render);
render();
ping();
