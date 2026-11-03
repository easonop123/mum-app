# 一点力 · A Little Stronger

A local-first, bilingual (plain English / Simplified Chinese) Progressive Web App that implements **one fixed, supplied starter strength program** (`mum-home-foundation-v2`, version 2026-11-03). The app does not design, change or substitute exercises, weights or progressions. It is not a clinician and it does not diagnose.

> **Software works ≠ appropriate for her to exercise unsupervised.**
> The software builds, and its automated tests pass (results below). The program still starts as **`assessment_pending`**. Practice stays locked until a GP or physiotherapist has assessed her back history (and anything the screening flags) and their advice has been recorded in the app.
>
> Before anyone relies on the app, the [manual checklist](docs/MANUAL-TEST-CHECKLIST.md) still needs to be done:
> - real-iPhone testing
> - checking that the videos play in New Zealand and match the written steps
> - a qualified bilingual review of the Chinese safety wording
> - professional review of the symptom questions and of the movements as shown
>
> Automated tests do not establish clinical safety.

## Get it on her iPhone

**App address:** https://easonop123.github.io/mum-app/

<img src="docs/open-on-iphone-qr.png" alt="QR code for https://easonop123.github.io/mum-app/" width="200">

1. GitHub Pages is already on for this repository: it serves the **`gh-pages`** branch, which holds the built app. If the address ever shows a 404, check **Settings → Pages → Deploy from a branch → `gh-pages` / `(root)`**.
2. On her iPhone, scan the QR code with the Camera, or type the address into **Safari**.
3. In Safari: **Share → Add to Home Screen →** turn on **Open as Web App** if it is shown **→ Add**.
4. Open it once while online. After that, everything except the videos works offline.

The family steps are in the [setup guide](docs/SETUP-GUIDE.en.md) ([中文](docs/SETUP-GUIDE.zh-Hans.md)).

**Updating the app.**
- Every push to `main` runs `.github/workflows/deploy-pages.yml`: typecheck, tests, build and privacy scan, then publish to `gh-pages`.
- To publish by hand: `npm run deploy`.
- The app never reloads mid-practice for an update. It offers the update on Today when she is not practising.

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
npm run program:doc  # regenerate docs/PROGRAM.md from the program JSON
npm run icons        # regenerate PNG icons from the SVG mark (uses local Chromium)
npm run deploy       # build + privacy scan, then publish dist/ to the gh-pages branch
```

## Architecture (brief)

- **React + TypeScript + Vite 8.** Uses `vite-plugin-pwa` (Workbox, "prompt" mode), system fonts, plain CSS tokens and a tiny hash router. There is no backend, account, analytics, advertising, remote font or runtime AI.
- **Content (versioned, data only):**
  - `src/content/program.json` is the exact supplied program and the single source of truth for every dose.
  - `exercise-catalogue.json` holds the verbatim supplied wording plus the bilingual UI copy.
  - `video-manifest.json` lists the demonstration candidates with honest verification fields.
  - `sources.ts` lists the guidance sources.
- **Safety engine (pure, deterministic, unit-tested, separate from rendering):** `src/safety/`
  - `evaluateReadiness`, `evaluateSessionCheckIn`, holds and `getProgramAccess` (the single gate).
  - These produce the six `SafetyState`s.
  - Every decision returns its reasons in both languages.
- **Program engine:** `src/program/`
  - `getFixedStagePrescription` fails closed on an unknown stage or ID.
  - `validateSuppliedRoutineAgainstRestrictions`, `getNextStageOffer`, `applyUserAcceptedStage`, `buildReturnAfterGapSuggestion`, plus schedule and session-recording helpers.
- **Data:** `src/data/`
  - Strict zod schemas (versioned) and a migration runner.
  - IndexedDB persistence, which validates before every save.
  - Unreadable data is quarantined, not dropped, and save failures are shown on screen.
  - Export/import with a privacy preview and size limits. Imported health answers always have to be answered again.
- **UI:** `src/ui/` has three destinations (Today / 今天, My progress / 我的进展, Settings / 设置). A bilingual Help link is in the header on every screen, and 停止 / Stop stays visible during a practice.

## Hosting over HTTPS

The build is static: the `dist/` folder. The service worker and Home Screen install need HTTPS (or `localhost`). Hash routing and a relative base mean it works from any static host, including a sub-path such as `/mum-app/`.

This repository publishes to **GitHub Pages** from the `gh-pages` branch (see "Get it on her iPhone" above).

To host elsewhere, upload `dist/` to any static HTTPS host (Netlify, Cloudflare Pages, or a web server with TLS). Serve `sw.js` and `index.html` with `Cache-Control: no-cache` so updates reach the phone.

## iPhone Home Screen

In Safari: **Share → Add to Home Screen →** turn on **Open as Web App** if it is shown **→ Add**. Labels vary between iOS versions; test on the actual phone. The website also works without being added.

Safari and the Home Screen app may keep **separate** data. Use *Settings → My data* to save a backup in one and restore it in the other.

## Demonstration videos

Every active movement has a real demonstration candidate from an NHS trust (YouTube IDs as supplied). Chinese-language candidates are included where the research found them. The elbow-curl video is **reference-only** and is never part of any stage.

- **Checked:** only the details in the supplied research (publisher, title, duration and, for the English videos, narration). This build environment could not reach YouTube.
- **Not yet checked:**
  - whether the movement shown matches the written steps
  - playback and iframe embedding
  - access from New Zealand
  - captions

How the app treats the videos:

- Videos load only when tapped.
- An "Open on YouTube" link and the written steps are always available.
- Videos are never cached or claimed to work offline.
- The dose warning 视频用来看动作；次数和组数请按本页安排，不跟随视频加量。 appears beside videos whose dose differs from the program or hasn't been checked.

To confirm the sources, or to replace them with authorised local clips, see [docs/VIDEO-SOURCES.md](docs/VIDEO-SOURCES.md).

## The program

[`docs/PROGRAM.md`](docs/PROGRAM.md) is a human-readable copy of the exact eight-stage program. It is **generated from `src/content/program.json`**, and a test fails if it drifts.

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

**Limits of the starter counts.**
- The doses, checkpoints and UX choices are conservative product proposals, not a medically validated prescription for her. The app says so in calm Chinese and English (*Settings → About this plan*).
- The four movements appear in NHS beginner guidance. The exact dose is the supplied design.
- **Incomplete coverage:** the routine has little pulling or posterior-chain work, so it is not a complete all-major-muscle-groups program. Stage 8 is maintenance plus an invitation to review the program with a professional. The app never adds rows, carries, curls or weights by itself.

Sources are listed in-app (*Settings → Sources and limitations*) and in `src/content/sources.ts`: WHO 2020 physical activity guidelines, the WHO chronic low back pain guideline, ACSM 2026, NHS back pain and strength exercises, Healthify NZ, Health New Zealand (111 / Healthline 0800 611 116), the Hong Kong Department of Health, and the 2024 habit-formation review.

## Product rules where the brief left a choice

The safety rules themselves are the brief's. These are the implementation choices made where the brief was open. All are tested and easy to change.

1. **"Not sure" is never low risk.**
   - "Not sure" on emergency or urgent signs leads to *urgent assessment* ("call Healthline if unsure").
   - "Not sure" on any other question leads to *review before program*.
2. **Mis-tap guard.** A "Yes" to the emergency or urgent symptom lists asks for one confirmation before the stop screen is shown. Once stored, the only way back is the return flow, which asks about medical advice and current symptoms.
3. **Holds** are stored records, not flags.
   - Symptom holds need a professional's "OK to carry on" **plus** fresh answers before they clear.
   - "Not sure" holds need fresh, specific answers before they clear.
   - Answering "nothing new" never clears either kind.
4. **Plan status comes only from the recorded advice.**
   - It becomes *reviewed for use* only when the back history was assessed, all four movements are marked "OK for me", and every movement was discussed.
   - Any "Not for me" pauses the plan for a content revision. The app never invents a substitute.
   - Progression also needs "OK to build up", and a recorded maximum stage is respected.
5. **Next-day feedback.** "Muscles a bit tired or mildly sore, but everyday things normal and back the same" counts as usual. "Not sure", "can't remember" or a missing answer holds progression. "Worse" pauses practice until she has had advice.
6. **Gaps.**
   - Fewer than 7 days: a normal session.
   - 7–13 days (at least one scheduled practice missed): the last comfortable stage, with a smaller-practice option.
   - 14 days or more: a Stage 1 return session with progression frozen. After a usual next day, she is offered the last comfortable stage, never higher.
   - Tiny sessions don't reset the gap.
7. **Schedule.** Exactly two chosen days a week, with at least one rest day between them. One practice per day at most. A missed day can move to another day in the same week, but never makes a third practice or catch-up work.
8. **Rest.**
   - Full sessions: the rest timer is optional and never advances.
   - The tiny session enforces its supplied minimum of 60 seconds.
   - Rest uses timestamps, so locking the phone can't skew it.
9. **Learning** (watching or reading) is allowed while the plan waits for advice, and is clearly labelled "watch and read only". It is blocked during emergency or urgent states.
10. **Storage.** The app asks the browser to keep its data only when setup is finished, never at first launch. The Data screen reports whether the browser agreed.

## Privacy

- No personal facts from the brief ship in the app. The default data has empty answers and no history.
- `npm run build` runs `scripts/check-bundle-privacy.mjs`. It fails the build if the bundle contains the brief's personal details, seeded answers, test fixtures or source maps.
- Health answers, advice notes and history live only in the phone's IndexedDB.
- Nothing is uploaded or sent. Export, reminder files, sharing and deletion each need an explicit tap, with a preview or a review step first.

## Actual test results (this environment, 2026-11-03)

From `reports/verification.txt`:

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | 0 errors |
| Vitest unit + interaction tests | **13 files, 179 tests passed** |
| Production build + bundle privacy scan | passed (16 precached first-party files, about 610 KiB) |
| Playwright e2e, Chromium at iPhone 13 size and 320 px | **30 passed** (15 tests × 2 viewports) |
| axe-core (WCAG 2.2 A/AA), English and Chinese screens | no serious or critical violations |

The tests cover all 30 acceptance cases from the brief. The case numbers are in the test names; search for `case N`.

**Not verified here (still outstanding):**
- **Safari/WebKit:** only Chromium is installed in this environment, and the "iPhone-size" runs are Chromium emulation.
- A real iPhone, including Home Screen install, storage in a Safari tab versus the installed app, and wake lock.
- `.ics` import on iOS.
- VoiceOver in English and Chinese.
- Mandarin voice availability on her phone.
- Video playback, embedding and access from New Zealand.
- Visual technique review of each video.
- Bilingual review of the Chinese safety wording.
- Professional review of the symptom questions and the movements.

See [docs/MANUAL-TEST-CHECKLIST.md](docs/MANUAL-TEST-CHECKLIST.md).

## Repository layout

```
src/content/   program.json (source of truth), exercise catalogue, video manifest, sources
src/safety/    readiness, check-in, holds, gate, bilingual reasons (pure)
src/program/   prescriptions, progression, gap return, schedule, session recording (pure)
src/data/      schema, IndexedDB, migrations, export/import, actions, selectors, store
src/ui/        screens and components;  src/i18n/  all English + Chinese copy
e2e/           Playwright specs;  tests/  interaction tests + fixtures
scripts/       icon generation, program doc generation, bundle privacy scan
docs/          PROGRAM.md (generated), setup guides, video sources, manual test checklist
```
