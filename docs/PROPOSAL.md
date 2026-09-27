# Proposal: reading the Instagram home feed

## The problem

Today the strategist scrolls a primed account, notices posts that did far better than the creator's usual, and copies the visual hook, spoken hook, body and caption into a Google Doc. The ideas then go to MarioBot. Everything except the scrolling and the judgment can be automated.

The hard part: **no official API exposes the home feed.** The Graph API covers your own account's media, and the Basic Display API has been retired. Paid scrapers only see public profiles, posts and hashtags. None of them see the personalized, algorithmic feed of a logged-in account, and that feed is the whole value of a "primed" account.

## Chosen approach: an extension captures links, a paid API supplies the details

1. **A Chrome extension** runs on instagram.com in the strategist's own browser. While they scroll, it records only the **link** of each post they stop on, plus the author handle. It never reads messages, account data or credentials.
2. **ScrapeCreators** turns each link into structured data: caption, views, likes, video file, owner. It also returns the creator's recent reels, which give the baseline, and an AI transcript.
3. **Our pipeline** computes the outlier score and extracts the hooks:
   - **Outlier score** = this post's views ÷ the median views of the creator's last ~12 reels. This is the same judgment the strategist makes by hand in the Loom ("he usually gets ~2k, this is 3–4×").
   - **Spoken hook and transcript**: the transcript's first line.
   - **Visual hook**: ffmpeg grabs frames at 0.3, 1 and 2 seconds, and a vision model reads the on-screen headline.
   - **Body and core idea**: one structured LLM call.
4. **MarioBot** is called through the Genesis API, which is OpenAI-compatible, with streaming. The prompt follows the playbook rule for organic sources: *keep the exact hook, write the rest fresh*.

## Why this over the alternatives

| Option | Stability | Account risk | Sees the real feed | Verdict |
|---|---|---|---|---|
| Headless bot (Playwright) logs in and scrolls | Low: breaks on layout changes and login challenges | **High**: automated sessions get flagged | Yes | Rejected |
| Private mobile API (e.g. instagrapi) | Low: reverse-engineered | **High** | Yes | Rejected |
| Extension reads everything from the page | Medium: page markup changes often | Low | Yes | Fragile |
| **Extension grabs links, paid API fills in the rest** | **High** | **Very low** | **Yes** | **Chosen** |
| Paid API only, watching a list of chosen creators | Very high | None | **No**: loses the algorithm's picks | Good fallback |

Why the chosen option is stable: post links (`/p/…`, `/reel/…`) are the most stable thing in Instagram's page. Everything that changes often (markup, captions, counters) comes from ScrapeCreators, and it's their job to keep up with Instagram's changes. Why it's low risk: a real person is scrolling in a real browser session, so Instagram sees normal behavior.

## The "a bot scrolls" requirement

The extension has an optional **auto-scroll** mode. It scrolls one post at a time at a human pace (4–9 seconds, varied distances) and stops at 10 posts. It's **off by default** and labeled as risky, because automated behavior on a logged-in account is what gets accounts flagged. My recommendation: scroll by hand in normal use, and turn on auto-scroll only on a spare account.

## Risks and limitations

- **Terms of service.** Automated collection of Instagram data is against Instagram's terms. With manual scrolling, the exposure is limited to reading public post data through a third party.
- **Cost.** About 3 ScrapeCreators requests per post (post, transcript, creator reels; reels are cached for 24 hours per creator), plus two small OpenRouter calls. For 10 posts that's roughly 30 credits, a few cents.
- **The outlier score is an estimate.** The baseline is the median of the creator's last ~12 reels. New accounts, or creators who mix formats, give a noisier baseline. Image and carousel posts are compared on likes instead of views.
- **Visual hook reading** can misread stylized fonts, or pick up burned-in captions instead of the headline. The frames and the prompt are tuned to avoid this, but it isn't perfect.
- **Transcripts** only cover videos under 2 minutes (a ScrapeCreators limit). Music-only posts are shown as "No speech", as in the Loom example.
- **Detecting ads** relies on the "Sponsored" label, which Instagram can rename.
- **Single user, local.** SQLite and an in-process job queue are fine for one strategist on one laptop, but not for a team.

## Next steps

1. **Seed bank**: write each saved post to the team's seed bank as a seed (the verbatim hook plus a one-line idea), then hand it to the brief builder.
2. **Source routing** into Copy: swipes to the swipe bot, organic to "keep the hook".
3. Capture from TikTok the same way (ScrapeCreators supports it).
4. Hosted version: Postgres, a job queue, and team accounts.
5. A creator watch list running in the background as a second, zero-risk source.
