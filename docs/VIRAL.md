# Growth design: why NEXORA can spread

**The viral moment:** a neural network explodes, you drag one slider, it learns. Thirty seconds, real computation, a story worth sharing.

## The loop

```
See a friend's 🟥🟨🟩 grid  →  tap the link  →  today's broken network, in the browser, no install
   ↑                                                     ↓
share card / text / 10-second clip  ←  fixed in 3/6  ←  train, explode, fix (≤ 6 tries)
                                                         ↓
                                     "This is one lab of NEXORA University" → full app
```

| Piece | Where | Notes |
|-------|-------|-------|
| No-install play page | `apps/web/play.html`, `src/play/` | Runs entirely in the browser. ~225 KB JS. No backend, no account, no tracking |
| In-browser training | `src/play/sim.ts` | TypeScript port of the NumPy MLP; deterministic; tested |
| Break of the Day | `src/play/puzzles.ts` | 7 puzzles rotating by local date (#1 = 1 Jan 2026); every puzzle is proven broken-at-start and fixable in `puzzles.test.ts` |
| Honest share grid | `shareText` | 🟥 diverged · 🟨 not learning enough · 🟩 fixed - real outcomes only |
| Friend challenge | `?d=<n>&g=<grid>` | Shows "a friend shared…", labelled *not verified*; links only meaningful once published |
| Share card + 10 s clip | Canvas PNG, MediaRecorder WebM (720×1280, vertical for Reels/Shorts/TikTok) | Clip replays the real loss curves |
| Full app hook | onboarding opens immediately for new profiles; welcome copy targets CS students | Campus is the reward after the first win |

## Publishing (needs the owner)

`.github/workflows/play-pages.yml` builds the static page and deploys it to GitHub Pages, **manual trigger only**. Enable Pages (Settings → Pages → Source: GitHub Actions), then run "Publish NEXORA Play".

## Measuring it - honestly

NEXORA has no telemetry, by design. To know the share rate or how many players each player brings in, you need an opt-in, privacy-preserving counter (for example a self-hosted Plausible, or counting tagged `?g=` links in Pages traffic). That is a product decision for the owner; nothing is collected today.

## Not done yet

Desktop installers (Rust missing), a real Open Graph preview image, translations, more daily puzzles beyond the 7-day rotation, accessibility review of the play page with a screen reader.
