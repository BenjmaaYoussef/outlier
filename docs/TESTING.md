# Testing status and edge cases

## Tested and working

| Area | How it was tested |
|---|---|
| Capture, home feed (swiping by hand) | Real Chrome, personal account: 12 posts reached the app |
| Capture, Reels (swiping by hand) | Real Chrome: reel code read from the address bar (`/reels/<code>/`), creator found |
| Ad check | Only matches Instagram's exact "Sponsored"/"Ad" label, not captions (checked on real pages) |
| Full pipeline on real reels | Views, outlier score, video download, transcript, visual hook, spoken hook, core idea, body |
| Age-restricted post | Skipped at capture time (`skipped: age-restricted`) and doesn't count toward the limit; older failures show **Remove** in place of Retry |
| ScrapeCreators transcript 500 error | The post still finishes; the error is noted on the post |
| MarioBot | Streaming in the app and CLI; replies saved to History |
| Reels: Instagram ignores scripted input | Script clicks, key presses, wheel and scroll all ignored; real (trusted) clicks work. This is why Reels auto-scroll uses the debugger API |
| Demo mode, UI themes, phone width | Built-in browser |

## Not tested yet: needs the user's Chrome

- [ ] **Reels auto-scroll through the debugger (extension 0.3.2).** It should move to a new reel every 6–11 seconds, the counter should go up, and Chrome should show a "started debugging" bar. Keep the tab visible: Instagram pauses hidden tabs, and the address bar only updates while the tab is visible.
- [ ] **"Skipped: age-restricted" tag in the extension** (the app side is tested).
- [ ] **Home feed auto-scroll**, for 2–3 posts.
- [ ] **A run on the primed (testosterone) account.**
- [ ] **The first reel on `/reels/`:** it has no code in the address bar, so it's only captured after the first swipe. Check that this is acceptable.

## Edge cases not tested yet (each costs about 3 ScrapeCreators credits)

| Case | Expected behavior | Risk |
|---|---|---|
| **Carousel post** (several slides) | Compared on **likes** (no views); first video slide used if there is one; on-screen text read from the cover image | Baseline uses the creator's reels, which may not fit carousel likes |
| **Single photo post** | Likes metric, no transcript ("Not a video"), visual hook read from the image | Same baseline mismatch |
| **Music-only reel (real)** | Transcript null, so "No speech, only music" and no spoken hook | ScrapeCreators may return a lyric transcript for songs, which would show as a spoken hook |
| **Video longer than 2 minutes** | ScrapeCreators transcript refuses it; the post finishes with "Transcript unavailable" | Error wording from the API is unknown |
| **Private account's post** | Skipped at capture ("private") | The error wording may not match what we look for, so it would show Retry instead of Remove |
| **Deleted post / bad link** | Skipped ("deleted or not found"); non-Instagram links rejected by the Add link box | Same wording risk |
| **Creator with no reels** (photos only) | No baseline, so no outlier score ("–") | Card shows "–", which is fine but less useful |
| **Brand-new creator** (1–2 reels) | Median of very few reels, so a noisy score | Score can look inflated |
| **Very large outlier** (e.g. 247× seen in testing) | Shown as-is | May need a cap or a "tiny baseline" warning |
| **Duplicate capture** (same post twice, or already in the app) | "Already captured" and not re-fetched | None known |
| **Writing room with 2+ real posts** | One MarioBot request with hooks from each post | Prompt length with long transcripts |
| **Genesis/MarioBot down or key revoked** | Error shown under the MarioBot panel, nothing saved | Tested only in code, not live |
| **App not running while capturing** | Extension shows "Outlier app not running" and doesn't count the post | Not tried live |
| **Instagram layout change** | Home: looks for `main article` and post links. Reels: the address bar plus the "Navigate to next Reel" label | The most likely thing to break over time |

## Credits

The free ScrapeCreators account started at 100 credits; about 40 are left. A 10-post run costs about 30.
