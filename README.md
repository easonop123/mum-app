# 一点力 · A Little Stronger

A simple, bilingual (plain English / Simplified Chinese) home strength-practice app. It follows **one fixed starter program**: four gentle movements, twice a week, over eight stages. It runs on her phone, works offline, and keeps everything on the device.

Open it, tap **Start**, follow one movement at a time, done. There is no questionnaire, no approval step and no check-in. Those were removed at the owner's request. The app is not medical advice.

## Get it on her iPhone

**App address:** https://easonop123.github.io/mum-app/

<img src="docs/open-on-iphone-qr.png" alt="QR code for https://easonop123.github.io/mum-app/" width="200">

1. On her iPhone, scan the QR code with the Camera, or type the address into **Safari**.
2. In Safari: **Share → Add to Home Screen →** turn on **Open as Web App** if it is shown **→ Add**.
3. Open it once while online. After that, everything except the videos works offline.

GitHub Pages serves the **`gh-pages`** branch, which holds the built app. If the address ever shows a 404, check **Settings → Pages → Deploy from a branch → `gh-pages` / `(root)`**.

**Updates.**
- Every push to `main` runs `.github/workflows/deploy-pages.yml`: typecheck, tests, build and privacy scan, then publish to `gh-pages`.
- To publish by hand: `npm run deploy`.
- Her phone installs a new version by itself the next time she opens the app, but never in the middle of a practice.

The family steps are in the [setup guide](docs/SETUP-GUIDE.en.md) ([中文](docs/SETUP-GUIDE.zh-Hans.md)).

## What she sees

- **Welcome** (first time only): pick English or 简体中文, tap **Let's start**.
- **Today:**
  - today's four movements and amounts
  - **Start today's practice**
  - a **Smaller practice** (3 sit-to-stands, a rest of at least a minute, 3 wall press-ups)
  - **Rest today**
  - the next practice day and this week's count
- **Practice:** an optional 2-minute walking warm-up with setup tips. Then one movement at a time:
  - demonstration video (loads only when tapped)
  - three steps and why the movement helps
  - **Done**, **I did fewer** or **Skip**
  - rest as long as she likes (side changes for the leg lift are counted left and right)

  It saves automatically at the end. **停止 / Stop** is always on screen: it asks "Stop now?", saves what was done, shows the 111 / Healthline numbers, and locks nothing.
- **Stages:** after two full practices at a stage, Today asks *"Ready for a little more?"*. The default is **Keep this amount / 保持这个量**. On the **Plan** page she can also choose any of the eight stages herself. After a break of 14 days or more, Today suggests starting again at Stage 1, but only if she taps it.
- **My progress:** practices this week, a week and month view, totals, an optional private note, and an optional share message she edits herself.
- **Settings:**
  - language, text size and optional spoken cues (Mandarin or English)
  - practice days (two a week, with a rest day between)
  - reminders (iPhone Reminders steps, or a calendar file)
  - the Home Screen guide
  - backup, restore and delete
  - sources
- A **Help / 帮助** button with 111 and Healthline (0800 611 116) is in the header on every screen.

## Commands

Node ≥ 22.

```bash
npm install
npm run dev          # local development server
npm test             # unit + interaction tests (Vitest, jsdom, fake IndexedDB)
npm run typecheck    # TypeScript, no emit
npm run build        # production build to dist/ + bundle privacy scan
npm run preview      # serve dist/ on http://localhost:4173
npm run test:e2e     # Playwright mobile end-to-end tests (needs a build first)
npm run verify       # all of the above, in order
npm run deploy       # build + privacy scan, then publish dist/ to the gh-pages branch
npm run program:doc  # regenerate docs/PROGRAM.md from the program JSON
npm run icons        # regenerate PNG icons from the SVG mark (uses local Chromium)
```

## Architecture (brief)

- **React + TypeScript + Vite 8.** Uses `vite-plugin-pwa` (Workbox), system fonts, plain CSS tokens and a tiny hash router. There is no backend, account or analytics.
- **Content:** `src/content/program.json` is the exact supplied program and the single source of truth for every dose. Exercise wording and the demonstration-video list live alongside it.
- **Program engine:** `src/program/`, pure and unit-tested.
  - Stage prescriptions read only from the JSON, and fail closed on an unknown stage.
  - Session recording only counts what she taps; no timer or video creates reps.
  - Stage offers and stage choice are always hers.
  - The 14-day restart is a suggestion only.
  - Schedule rules: two days a week, at most one practice a day, no catch-up sessions.
- **Data:** `src/data/`
  - Strict, versioned zod schemas and IndexedDB storage.
  - Unreadable data is quarantined rather than dropped, and save failures are shown on screen.
  - Export/import with a preview.
  - Schema v2 migrates the first release's data. It deletes the stored health answers, advice notes and holds, keeps practice history, and writes the result back straight away.

## The program

[`docs/PROGRAM.md`](docs/PROGRAM.md) is generated from `src/content/program.json`, and a test fails if it drifts.

| Stage | Sit-to-stand | Wall press-up | Heel raise | Side leg lift |
|---|---|---|---|---|
| 1 | 1 × 5 | 1 × 5 | 1 × 5 | 1 × 5 each side |
| 2 | 1 × 8 | 1 × 8 | 1 × 8 | 1 × 8 each side |
| 3 | 2 × 8 | 1 × 8 | 1 × 8 | 1 × 8 each side |
| 4 | 2 × 8 | 2 × 8 | 1 × 8 | 1 × 8 each side |
| 5 | 2 × 8 | 2 × 8 | 2 × 8 | 1 × 8 each side |
| 6 | 2 × 8 | 2 × 8 | 2 × 8 | 2 × 8 each side |
| 7 | 2 × 10 | 2 × 10 | 2 × 10 | 2 × 10 each side |
| 8 | Hold 2 × 10 | Hold 2 × 10 | Hold 2 × 10 | Hold 2 × 10 each side |

- No weights at any stage.
- Stage 8 is maintenance; there is no stage 9.
- The four movements don't cover every major muscle group (little pulling or back-of-body work). A physio can suggest what to add later.

## Demonstration videos

Each movement has an NHS demonstration video (YouTube IDs as supplied), plus Chinese-language videos for two of them.

- Videos load only when tapped.
- An "Open on YouTube" link and the written steps are always there.
- Videos are never cached or claimed to work offline.
- The note 视频用来看动作；次数和组数请按本页安排，不跟随视频加量。 appears beside videos whose spoken count differs from the app's.

To check the videos, or to replace them with clips you own, see [docs/VIDEO-SOURCES.md](docs/VIDEO-SOURCES.md).

## Privacy

- The public repository and the hosted app contain no personal details. `npm run build` fails if the bundle contains seeded data, test fixtures or source maps.
- Private patterns can be added in a git-ignored `.privacy-denylist.local` file, or as a `PRIVACY_DENYLIST` secret.
- Her practice history lives only in her phone's IndexedDB. Nothing is uploaded.

## Test results (this environment, 2026-11-03)

See `reports/verification.txt`:

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | 0 errors |
| Vitest unit + interaction tests | 11 files, 96 tests passed |
| Production build + bundle privacy scan | passed |
| Playwright e2e, Chromium at iPhone 13 size and 320 px | 26 passed (13 tests × 2 viewports) |
| axe-core (WCAG 2.2 A/AA), English and Chinese screens | no serious or critical violations |

The upgrade path was also checked by hand. A phone with the first version installed, stuck in its "waiting for medical advice" state, shows "Update now"; after updating, practice is available and the old answers are deleted from storage.

**Not verified here:**
- Only Chromium is installed, so there was no Safari/WebKit or real-iPhone testing.
- `github.io` and YouTube are blocked from this build environment, so the live site and video playback were not opened from here.

See [docs/MANUAL-TEST-CHECKLIST.md](docs/MANUAL-TEST-CHECKLIST.md).

## Repository layout

```
src/content/   program.json (source of truth), exercise catalogue, video manifest, sources
src/program/   prescriptions, stage offers, schedule, session recording (pure)
src/data/      schema, IndexedDB, migrations, export/import, actions, selectors, store
src/ui/        screens and components;  src/i18n/  all English + Chinese copy
e2e/           Playwright specs;  tests/  interaction tests + fixtures
scripts/       icon generation, program doc generation, privacy scan, gh-pages publish
docs/          PROGRAM.md (generated), setup guides, video sources, manual test checklist
```
