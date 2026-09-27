# Outlier

A working prototype of the **"O" (Organic)** step of the STORMING ideation process:

1. A Chrome extension captures posts from an Instagram **home feed** or **Reels** tab while you scroll.
2. The app finds the **outliers**, meaning posts that did far better than the creator's usual.
3. It breaks each post into its **visual hook**, **spoken hook**, **caption**, **body** and **full transcript**.
4. One button sends a post's hooks to **MarioBot**, and the reply streams in live.

```
Chrome extension ──post links──▶ Outlier app (Next.js, localhost:3000)
 (you scroll Instagram)            ├─▶ ScrapeCreators API   post data, views, video, transcript, creator baseline
                                   ├─▶ OpenRouter (vision)  reads the on-screen hook, splits hook / body / idea
                                   ├─▶ SQLite  data/outlier.db  ◀── CLI (pnpm outlier …)
                                   └─▶ MarioBot (Genesis)   writes hooks and ads, streamed back
```

- Why it's built this way: [docs/PROPOSAL.md](docs/PROPOSAL.md)
- What's tested: [docs/TESTING.md](docs/TESTING.md)
- Demo walkthrough: [docs/DEMO-SCRIPT.md](docs/DEMO-SCRIPT.md)

---

## Requirements

| Tool | Version | Check | Install (macOS) |
|---|---|---|---|
| Node.js | **22.13 or newer** (uses the built-in `node:sqlite`) | `node -v` | `brew install node@22` or `nvm install` (reads `.nvmrc`) |
| pnpm | 10 | `pnpm -v` | `corepack enable` (ships with Node) |
| ffmpeg | any recent | `ffmpeg -version` | `brew install ffmpeg` |
| Google Chrome | any recent | | only needed for the extension |

On Windows or Linux, install the same tools with your package manager. `ffmpeg` must be on your `PATH`.

You also need three API keys:

| Key | What it's for | Where to get it |
|---|---|---|
| `GENESIS_API_KEY` | Calling MarioBot | Provided by the Genesis / CopyCoders team |
| `OPENROUTER_API_KEY` | Required by Genesis as the provider key, and used for the vision model | https://openrouter.ai/keys |
| `SCRAPECREATORS_API_KEY` | Reading Instagram posts | https://scrapecreators.com (the free tier has 100 credits; about 3 per post) |

No keys yet? Demo mode runs without them. See [Try it without keys](#try-it-without-keys).

---

## Setup

```bash
git clone https://github.com/BenjmaaYoussef/outlier.git
cd outlier
pnpm install
cp .env.example .env.local     # then open .env.local and paste your keys
pnpm dev
```

Open **http://localhost:3000**. The database and downloaded media are created in `data/` the first time the app runs. There's no other setup.

Check the connections under **Settings → Connections**, or from the terminal:

```bash
curl -s localhost:3000/api/health
```

### Try it without keys

```bash
pnpm demo      # loads 10 sample posts into the database
pnpm dev
```

You can also press **⋯ → Load sample feed** in the app, which plays the posts through each processing step live. Sending to MarioBot still needs the Genesis and OpenRouter keys.

---

## Install the Chrome extension

1. Start the app (`pnpm dev`). The extension sends posts to `http://localhost:3000`.
2. In Chrome, open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the **`extension/`** folder in this repo.
4. Log in to your Instagram account in the same Chrome.
5. Click the **Outlier** icon in the toolbar. It should say **App connected**.

### Capturing

- Pick **Home feed** (what the brief asks for) or **Reels**, then press **Start capture**. It opens the right Instagram page.
- Scroll normally. Every post you stay on for about a second is captured, up to 10:
  - **Home feed:** a "✓ Captured n/10" tag appears on the post.
  - **Reels:** the counter at the bottom of the page confirms it. The first reel counts after your first swipe.
- Ads are skipped. **Age-restricted, private or deleted** posts are also skipped, because they can't be analyzed, and don't count toward the 10.
- Captured posts appear in the app immediately and are analyzed live.
- **Reset count** starts a new batch.

### Auto-scroll (optional, off by default)

The **Auto-scroll** switch scrolls for you at a human pace:

- **Home feed:** it scrolls the page.
- **Reels:** Instagram ignores input made by scripts there, so the extension presses the "next reel" arrow with a real click through Chrome's debugger API. Chrome shows a *"started debugging this browser"* bar while it runs. **Keep the Instagram tab visible**, because Instagram pauses hidden tabs.

⚠️ Automated scrolling can get an Instagram account flagged. Use a spare account. See [docs/PROPOSAL.md](docs/PROPOSAL.md).

After you change files in `extension/`, click ↻ on the extension in `chrome://extensions` to reload it.

---

## Using the app

| Page | What it does |
|---|---|
| **Feed** | Posts sorted by outlier score, meaning views ÷ the median views of the creator's last ~12 reels. Filter by *Outliers* or *Saved*, and bookmark posts to save them. Select several posts and use **Send to MarioBot** to write from them together. **Add link** lets you paste post links without the extension. |
| **Post** | Video, score, and the hooks (on screen, spoken, caption opening). Also the core idea, body and full transcript. Pick hooks, choose what to write, and press **Send to MarioBot** (⌘/Ctrl + Enter). The reply streams in and is saved. Press `s` to save the post. |
| **Writing room** | Combine hooks from several posts in one MarioBot request. |
| **History** | Every MarioBot reply. |
| **Settings** | Your product (added to every MarioBot request), the outlier threshold, and connection status. |

## CLI

The CLI reads the same database as the app. It doesn't need the app running.

```bash
pnpm outlier list --min-score 3            # outliers, best first
pnpm outlier show 12                       # every field for one post
pnpm outlier send 12,19 --preset testset   # stream MarioBot in the terminal (hooks10 | testset | fullad)
pnpm outlier send 12 --prompt "5 hooks for men over 40"
pnpm outlier export --format md --saved    # all saved posts as Markdown (or --format json)
```

---

## Environment variables

All of them go in `.env.local`, which git ignores. `.env.example` lists them with empty values.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `GENESIS_BASE_URL` | yes | `https://gas.copycoders.ai/api/v1` | OpenAI-compatible endpoint |
| `GENESIS_API_KEY` | yes, for MarioBot | | Bearer token |
| `MARIO_SLUG` | yes | `mario-bot-` | The trailing hyphen is part of the name |
| `OPENROUTER_API_KEY` | yes | | Sent to Genesis as `X-Provider-Key`, and used for vision |
| `VISION_MODEL` | no | `google/gemini-3.8-flash` | Any OpenRouter model that accepts images |
| `SCRAPECREATORS_API_KEY` | yes, for real posts | | Not needed for demo mode |

Restart `pnpm dev` after changing `.env.local`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Runs the app on http://localhost:3000 |
| `pnpm build` then `pnpm start` | Production build and server |
| `pnpm demo` | Loads the 10 sample posts |
| `pnpm outlier …` | CLI (see above) |
| `pnpm typecheck` / `pnpm lint` | Type check and lint |

## Troubleshooting

| Problem | Fix |
|---|---|
| `No such built-in module: node:sqlite` or an SQLite error | Node is too old. Use Node **22.13+** (`nvm install`). |
| The extension says **App not running** | Start `pnpm dev`. The app must be on port **3000**, because the extension only talks to `localhost:3000`. |
| Port 3000 is already in use | Stop the other process (`lsof -i :3000`). Don't change the port, or the extension can't reach the app. |
| Posts stop at "Fetching post" with a key error | Add `SCRAPECREATORS_API_KEY` to `.env.local` and restart `pnpm dev`. |
| MarioBot error "Provider API key required" | `OPENROUTER_API_KEY` is missing. Genesis needs it too. |
| No visual hook on videos | Install **ffmpeg** and make sure `ffmpeg -version` works. |
| A card says a post is **age-restricted / private** | ScrapeCreators can only read public, unrestricted posts. Press **Remove**. |
| Reels auto-scroll doesn't move | Keep the Instagram tab in front, and reload the extension after updating it. |
| Start over | Use ⋯ → **Clear all posts** in the app, or delete the `data/` folder. |

## Project layout

```
app/                  Next.js pages and API routes
  api/capture         receives links from the extension (skips unavailable posts)
  api/events          live updates to the feed (server-sent events)
  api/mario           streams MarioBot replies
components/           UI (PostCard, HookList, Writer, …)
lib/pipeline.ts       fetch → creator baseline → transcript + visual hook → hook / body / idea
lib/clients/          scrapecreators.ts, genesis.ts (MarioBot), openrouter.ts
lib/prompt.ts         MarioBot presets and prompt builder
lib/db.ts             SQLite schema and queries
extension/            Chrome MV3 extension (content script, popup, background worker)
cli/outlier.ts        CLI
fixtures/             sample feed for demo mode
docs/                 proposal, testing status, demo script
data/                 database and downloaded media (created at runtime, git-ignored)
```
