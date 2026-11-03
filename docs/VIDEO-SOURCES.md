# Demonstration videos: confirming sources and replacing them with authorised clips

The manifest is `src/content/video-manifest.json` (version `2026-11-03.1`). Every field is filled in honestly, with `null`, `false` or `pending` where something is unknown. **Nothing in it is "clinically approved" for anyone.**

## Current candidates (as supplied)

| Movement | Publisher | Video ID | Length | Notes |
|---|---|---|---|---|
| Chair sit-to-stand | Barts Health NHS Trust | `gJys6ExNtXA` | 0:40 | English; shows hand assistance |
| Wall press-up | The Rotherham NHS Foundation Trust | `eQJ-8nD5UvE` | 0:23 | English; the app adds Chinese written cues |
| Supported heel raise | NHS Lanarkshire | `zpIkRgojpiY` | 0:18 | English narration gives a **different dose**; use for technique only |
| Supported side leg lift (hip abduction) | NHS Lanarkshire | `vgjRPoMkpeY` | 0:32 | English narration gives a **different dose**; use for technique only |
| Sit-to-stand (Chinese candidate) | SingHealth / Changi General Hospital | `6PQvoFaMIe4` | 1:02 | Chinese title verified; spoken variety and captions unchecked; cancer-prehabilitation context |
| Wall press (Chinese candidate) | 臺中榮民總醫院埔里分院 | `UUX-dPAb69Y` | 1:18 | Chinese title verified; speech and captions unchecked; osteoporosis-education context |
| Elbow curl (**reference only**) | The Rotherham NHS Foundation Trust | `2X9EIw9EEWU` | 0:36 | Not in any stage; never shown in a practice |

Longer education (shown only on the Learn page, never as per-exercise clips):

- Hong Kong Department of Health supported-standing series (`OwOqJWVpiQM`, 6:52), with an official Traditional Chinese transcript. It is not Mandarin.
- Taiwan Health Promotion Administration Mandarin movement breakdown (`8SRXcb-YtDw`, 10:39). It has no per-exercise timestamps.

Institutional provenance: [Barts exercise-video page](https://www.bartshealth.nhs.uk/wellbeing-physiotherapy-and-pain-management-/).

## What is and isn't verified

- `sourceCheckedAt: 2026-11-03`, `sourceCheckedBy: supplied-research`. The research supplied with the program checked identity, title and duration, plus narration for the English videos. **This build could not reach YouTube**, so nothing was re-checked here.
- `visualReviewStatus: pending` for every entry.
- `playbackTested`, `embedTested` and `regionTested` are `false` for every entry.
- `offlineRights: none` for every entry. The videos are never cached; the app always says "videos need the internet".

## How to confirm a source (on her iPhone, in New Zealand)

1. Open the app and go to **Learn the movements**. Tap **看示范 / Watch demonstration**.
2. Check that the video **plays inside the app**. If it doesn't, check that **Open on YouTube** works instead.
3. Watch the whole video. Check that the **movement and support level match the card**:
   - an armless chair, with hands on the thighs allowed
   - hands on the wall at chest height
   - both hands on a fixed counter
   - a small sideways lift
   A harder progression must not replace the beginner version.
4. Note any spoken dose or count that differs from the app. The app already shows the dose warning for unchecked videos.
5. Check the spoken language and captions (Mandarin? Cantonese?), and whether the visuals make sense without sound.
6. Update the entry in `video-manifest.json`:
   - `playbackTested`, `embedTested`, `regionTested`
   - `captionLanguage`, `spokenLanguage`
   - `doseMismatchNote` / `videoDoseCheck`
   - `visualReviewStatus: "approved"` **only** after an appropriate professional has reviewed the technique
7. Bump `manifestVersion`, then run `npm test`.

## Replacing a candidate with an authorised local clip

"Publicly accessible" does **not** mean reusable. Government publishers can mix copyrighted and copyright-free material (see the [NIA media policy](https://www.nia.nih.gov/policies) as an example). Only use clips you own, or have written permission to use.

1. Put the short clip in `public/media/`, for example `public/media/sit-to-stand-zh.mp4`. You can add a WebVTT captions file next to it.
2. Add a manifest entry for the same `exerciseId`:
   ```json
   {
     "exerciseId": "chair-sit-to-stand",
     "variantId": "sit-to-stand-zh-owned",
     "role": "primary",
     "platform": "local",
     "localSrc": "media/sit-to-stand-zh.mp4",
     "captionsSrc": "media/sit-to-stand-zh.vtt",
     "offlineRights": "owned",
     "publisher": "Recorded for this app (physio-reviewed)",
     "watchUrl": "",
     "videoId": "local-sit-to-stand-zh",
     "durationSeconds": 35,
     "spokenLanguage": "cmn",
     "captionLanguage": "zh-Hans",
     "sourceCheckedAt": "YYYY-MM-DD",
     "sourceCheckedBy": "manual",
     "visualReviewStatus": "approved",
     "playbackTested": true,
     "embedTested": true,
     "regionTested": true,
     "doseMismatchNote": null,
     "videoDoseCheck": "none-reported",
     "label": { "en": "Sit-to-stand (Chinese)", "zh": "坐站示范（中文）" },
     "qualification": { "en": "Recorded for this app.", "zh": "为这个应用录制。" }
   }
   ```
3. The app shows a local clip **only** when `offlineRights` is `owned` or `licensed` and `localSrc` is a plain `media/…mp4|webm` path. A usable local clip is listed first for its movement.
4. `npm run build` precaches `public/media/**` (files up to 25 MB each). These are the **only** videos ever available offline.
5. Ideally the clip is demonstrated or reviewed by an appropriate professional. Generated human animation must not be used as a verified demonstration.
