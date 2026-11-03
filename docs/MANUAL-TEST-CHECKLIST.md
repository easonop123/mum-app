# Manual test checklist (before real-world use)

Automated tests ran in Chromium only, at iPhone size. They **do not** establish clinical safety, and they do not replace these checks. Tick each item, and note the date, the device, and the iOS or browser version.

## A. Real iPhone (Safari / WebKit)

- [ ] The site opens in a Safari tab over HTTPS, and the first run works without installing.
- [ ] Add to Home Screen works. The icon shows (an off-white dot and line on jade green). It opens as a web app without Safari controls.
- [ ] Storage: data entered in the Safari tab vs. the Home Screen app. Record whether they are shared. Then test **Save a backup → Restore** across the two.
- [ ] Offline: visit once online, turn on Airplane Mode, relaunch from the Home Screen. The plan, instructions, help numbers and history load. Videos say they need the internet.
- [ ] *My data* shows whether the browser agreed to keep the data. Record the result.
- [ ] During a practice the screen stays on (wake lock). Locking and unlocking the phone keeps the same step, with no extra reps recorded.
- [ ] Switching to another app mid-set and coming back keeps the same set. Nothing is added.
- [ ] An app update (deploy a new build) does **not** reload during a practice. The update banner appears only on Today or Settings when no practice is open.
- [ ] Text size: iOS Settings → Display & Text Size → Larger Text, near the largest size, plus the app's own "Largest" setting. The Stop button and Help stay visible and usable. Nothing is cut off.
- [ ] VoiceOver in **English**: the Today, question, practice and Stop screens are announced sensibly, and radio groups read their question.
- [ ] VoiceOver in **Chinese** (switch the app to 中文): the labels are read in Chinese, and bilingual buttons (停止 / Stop, 帮助 / Help) are understandable.
- [ ] Voice cues: with "Mandarin 普通话" selected, *Read the steps aloud* speaks Chinese. If no Mandarin voice is installed, the app says so politely.
- [ ] `tel:` links: tapping **Call 111** and **Healthline** opens the phone's call confirmation. Nothing dials automatically.
- [ ] Reminders: follow the iPhone Reminders steps exactly as written and correct any labels that differ. Download the **calendar file**, import it (a deliberate user action), and confirm it repeats on the chosen days at the chosen Auckland time, including across a daylight-saving change.
- [ ] The share sheet: *Share an update* opens with editable text and sends nothing on its own. *Share backup file* works or falls back to *Save*.

## B. Video playback in New Zealand

For each entry in [VIDEO-SOURCES.md](VIDEO-SOURCES.md), on her phone and network:

- [ ] It plays inside the app (embed), or **Open on YouTube** works. Record `embedTested`, `playbackTested` and `regionTested`.
- [ ] The movement and support level match the card. A harder version does not replace the beginner one.
- [ ] Dose differences are noted. The Chinese dose warning appears beside them.
- [ ] Spoken language and captions are recorded (Mandarin, Cantonese, other). Note whether the video is understandable without sound or English.

## C. Chinese that she can read easily

- [ ] Ask a fluent reader, ideally her, to read every Chinese screen: welcome, each health question, the emergency and urgent screens, the waiting status, check-in, each exercise, Stop, next-day, the offer, the GP summary (Chinese version), setup, and data.
- [ ] The words are plain and kind. There is no jargon without explanation, nothing childish, nothing about age or frailty, no guilt.
- [ ] **A qualified bilingual reviewer has approved the Chinese safety wording.** This covers:
  - the emergency text 先停止练习。这些新出现的症状需要立即寻求医疗帮助，不要继续测试动作。
  - the urgent symptom lists
  - the Stop options
  - the next-day options

## D. Professional review (GP / physiotherapist)

- [ ] Her back history, and anything the screening flagged, has been assessed. The advice is recorded in the app by her (or with her), not inferred.
- [ ] The symptom questions and red-flag lists suit her situation (they are based on NHS back-pain guidance; NZ numbers are used).
- [ ] Each of the four movements, **as demonstrated in the chosen video**, suits her. Any restriction is recorded.
- [ ] Whether gradual progression through the eight stages is appropriate, and any maximum stage, is recorded.
- [ ] If anything changes the routine, the owner revises the content deliberately with the professional's advice. The app does not substitute anything.
- [ ] A review milestone is agreed for adding suitable pulling and posterior-chain work later. The starter routine is not a complete program.

## E. Release decision

- [ ] A–D are complete and recorded.
- [ ] `npm run verify` passes on the release commit.
- [ ] The family (and she) agree it is ready. "Software works" is not the same as "appropriate for her to exercise unsupervised".
