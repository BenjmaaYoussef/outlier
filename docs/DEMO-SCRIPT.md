# Demo video script (about 4 minutes)

**Before recording:** run `pnpm dev`, load the extension, log in to the primed account, fill in your product in Settings, and clear the feed (⋯ → Clear all posts). Keep `pnpm demo` ready as a backup in case Instagram misbehaves during the recording.

## 1. The problem (20s)
"Today the strategist scrolls, spots posts that did far better than usual, and copies the hooks into a Google Doc by hand. There's no API for the home feed, so here's how I got around that."

## 2. Capture (50s)
- Click the extension, pick **Home feed** (or **Reels**), then **Start capture**. Scroll at a normal pace.
- Point out the **"✓ Captured 3/10"** tag on each post, and a **"Skipped ad"** tag when one comes up.
- "The extension only takes the post link. A real person is scrolling, so the account looks completely normal. There's an auto-scroll switch for the 'bot' version, off by default because it's the risky part."

## 3. Live analysis (40s)
- Switch to the app. Cards arrive and move through *Fetching → Checking creator's usual views → Transcribing → Ready*.
- "Each card gets an outlier score: this post's views divided by the median of the creator's last 12 reels. That's the same check as in the Loom: 'he usually gets 2k, this got 8.9k'."
- Sort by **Top outliers**. Save two posts with the bookmark.

## 4. Anatomy of a post (40s)
- Open the top outlier and show:
  - the video
  - **20×: 186K views vs. usually 9.5K**
  - the three hooks: on screen, spoken, caption opening
  - core idea, body, full transcript
- Open a music-only post: "No spoken hook, music only. That's the case from the Loom."

## 5. MarioBot (60s)
- Pick the spoken hook. Choose **Hook test set**. Open **Prompt sent to MarioBot** to show exactly what goes to the bot, including the product and the rule "keep the exact hook".
- Press **Send to MarioBot**. The reply streams in.
- Go back to the feed, select two posts, then **Send to MarioBot** to get one request combining hooks from both posts.
- Show **History**: every reply is saved.

## 6. CLI (20s)
```bash
pnpm outlier list --min-score 3
pnpm outlier send 12 --preset hooks10
```
"The same data, from the terminal, for the rest of the pipeline."

## 7. Limits (20s)
Summarize from PROPOSAL.md: the outlier score is an estimate, on-screen text reading can make mistakes, transcripts only cover videos under 2 minutes, it costs a few cents per 10 posts, and the terms-of-service risk is kept low by having a person do the scrolling.
