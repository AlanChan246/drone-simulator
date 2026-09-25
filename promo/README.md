# Drone Simulator promo

An isolated, reproducible 45-second edit of the real product. All footage is captured from the existing Simulator: desktop Home controls, mission select, Blockly, Mission 1, Mission 2 v2 and genuine results. Remotion handles editing and typography only.

## Requirements and install

- Node.js 22 or newer, npm, Python 3, FFmpeg/ffprobe on PATH.
- Google Chrome installed. Capture uses an isolated profile, not your everyday browser.
- Root Simulator dependencies and separate promo dependencies:

```sh
# Project root
npm ci
cd promo
npm ci
```

The root package is unchanged. Existing Pages packaging explicitly copies only product files, so promo is excluded without modifying deployment configuration.

## Capture

Start the real product in one terminal:

```sh
# Project root
python3 -m http.server 8080 --bind 127.0.0.1
```

In another terminal:

```sh
cd promo
npm run capture
```

The default source is `http://127.0.0.1:8080/`. Override with `PROMO_URL`. `npm run verify:production` compares five core product files with the public site and saves hashes. `npm run audit` completes both original QA fixtures through normal real-time execution, records results and verifies reset. `npm run candidates` exports angle candidates.

All browser viewports are 1920×1080 desktop. UI is sampled at DPR 2 and downscaled for crisp text; Home is cropped from that genuine desktop source to exclude its concept film. 3D source is native 1920×1080. No mobile footage or upscaled low-resolution source.

Capture groups are independent:

```sh
npm run capture:ui
npm run capture:blockly
npm run capture:mission1
npm run capture:mission2
```

Mission 1 uses the existing nine-command direct route plus the real event block. Its displayed result is 700 points with zero optional inspections, not the audit's 1,000-point result. Mission 2 uses `fixtures/mission2-promo.xml`: the existing four-fire solution plus a real 110 cm ascent after takeoff. The 204 cm height keeps the drone clear of fire labels and remains inside the charging height limit. Capture executes every preceding command and completes the entire mission; it never sets drone position, mission success, fire state or score.

The browser clock advances every timer/animation frame in order using Playwright `runFor`; screenshot speed cannot drop simulation frames. This is offline capture, not a gameplay performance claim. Each clip has a JSON sidecar under captures with actual mission state and capture timing. Each context is disposable; browser-only camera/CSS changes disappear on close. Never reset a still-running queue to start another capture: create a fresh context or finish the run.

`npm run benchmark` compares 30 and 60 fps from fresh contexts. Selected final: 30 fps. The two-second test required about 6.5 s at 30 fps and 12.4 s at 60 fps, with files about 1.82 MB and 2.01 MB. Both use individually captured frames; 30 fps gives a lighter repeatable workflow and sufficient clarity for these restrained camera moves.

Optional Chromium: install with `npx playwright install chromium`, then set `PROMO_BROWSER=chromium`. Set `PROMO_CHROME` to a compatible browser executable for Remotion if Chrome is not in the default macOS path.

## Audio and rendering

```sh
npm run audio
npm run previews
npm run render
npm run qa
```

Audio is an original synthesized 120 BPM electronic bed plus subtle editorial effects, generated without third-party samples. Music and SFX stems are separate under public/audio. To replace music, retain/record its licence in ASSETS.md, align the Run beat at 14.55 s and success at 25 s, keep the final 41–45 s resolve, remix and re-render. Product execution contains no motor/mission soundtrack to preserve.

Capture and render are separate: changing captions, timing, music or transitions does not rerun missions. Edit `src/Promo45.tsx`; `npm run studio` opens the composition editor. `src/Root.tsx` fixes 1920×1080, 30 fps, 1,350 frames. Rendering creates a high-quality H.264 master once, then 1080p and smaller web derivatives plus a poster.

## Outputs

- `output/drone-simulator-promo-45s-1080p.mp4` — main delivery.
- `output/drone-simulator-promo-45s-master.mp4` — high-quality edit master.
- `output/drone-simulator-promo-45s-web.mp4` — smaller fast-start web delivery.
- `output/drone-simulator-promo-poster.jpg` — real Mission 2 frame plus title.
- `previews/frame-*.png` — requested time points and extra transition/action checks.
- `captures/` — audit screenshots, state records, angle/FPS/audio evidence.

## Updating footage and safety

After product changes, repeat audit and production parity, review candidate angles, then rerun only affected groups. Recheck shot IDs and real command indices if XML changes. Review fire A and landing states before rendering. The existing simulator still owns all rules and feedback.

Track source, lockfile, authored XML, docs and the small font licence. Ignore node_modules, captures, previews, generated audio, footage and exports. Final MP4s remain local; back up wanted renders separately. No Git LFS, remote changes, push, PR or deploy is part of this workflow.

See PROMO-AUDIT.md, STORYBOARD.md, SHOT-LIST.md, PRODUCTION-HOOKS.md, ASSETS.md and QA.md for decisions and verification.
