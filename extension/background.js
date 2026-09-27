// Relays captured links to the local Outlier app. Runs in the extension's
// service worker so requests to localhost aren't blocked by Instagram's page.

const DEFAULTS = { appUrl: "http://localhost:3000" };

async function appUrl() {
  const { appUrl } = await chrome.storage.local.get(DEFAULTS);
  return appUrl.replace(/\/$/, "");
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type !== "capture" && msg.type !== "ping") return;
  (async () => {
    try {
      const base = await appUrl();
      if (msg.type === "capture") {
        const res = await fetch(`${base}/api/capture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ links: [msg.link], source: "extension" }),
        });
        reply({ ok: res.ok, data: await res.json() });
      } else if (msg.type === "ping") {
        const res = await fetch(`${base}/api/posts`);
        const posts = await res.json();
        reply({ ok: res.ok, total: Array.isArray(posts) ? posts.length : 0 });
      }
    } catch (e) {
      reply({ ok: false, error: String(e && e.message ? e.message : e) });
    }
  })();
  return true; // keep the channel open for the async reply
});

// ---------- real swipes for Reels auto-scroll ----------
// Instagram's Reels tab ignores input made by page scripts. Chrome's debugger
// API sends real (trusted) mouse input instead, the same as a physical mouse.
// Chrome only attaches (and shows its "started debugging" bar) while Reels
// auto-scroll is running; manual capture never uses it.

const attached = new Set();

async function attach(tabId) {
  if (attached.has(tabId)) return;
  await chrome.debugger.attach({ tabId }, "1.3");
  attached.add(tabId);
}

async function detach(tabId) {
  if (!attached.has(tabId)) return;
  attached.delete(tabId);
  await chrome.debugger.detach({ tabId }).catch(() => {});
}

if (chrome.debugger) chrome.debugger.onDetach.addListener((source) => attached.delete(source.tabId));
chrome.tabs.onRemoved.addListener((tabId) => attached.delete(tabId));

async function realSwipe(tabId, { x, y, clickX, clickY }) {
  await attach(tabId);
  const send = (method, params) => chrome.debugger.sendCommand({ tabId }, method, params);
  if (typeof clickX === "number") {
    // Press Instagram's own "next reel" arrow.
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: clickX, y: clickY });
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: clickX, y: clickY, button: "left", clickCount: 1 });
    await new Promise((r) => setTimeout(r, 60 + Math.random() * 80));
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: clickX, y: clickY, button: "left", clickCount: 1 });
  } else {
    // No arrow on screen: scroll the wheel over the video instead.
    await send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: 500 + Math.random() * 200 });
  }
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type !== "swipe" && msg.type !== "stopSwipe") return;
  const tabId = sender.tab && sender.tab.id;
  (async () => {
    try {
      if (!tabId) throw new Error("No tab");
      if (!chrome.debugger) throw new Error("Debugger permission missing: reload the extension");
      if (msg.type === "stopSwipe") await detach(tabId);
      else await realSwipe(tabId, msg);
      reply({ ok: true });
    } catch (e) {
      reply({ ok: false, error: String(e && e.message ? e.message : e) });
    }
  })();
  return true;
});

// Let go of the tab as soon as capture stops.
chrome.storage.onChanged.addListener(async (changes) => {
  const stopped = (changes.capturing && !changes.capturing.newValue) || (changes.autoScroll && !changes.autoScroll.newValue);
  if (stopped) for (const tabId of [...attached]) await detach(tabId);
});
