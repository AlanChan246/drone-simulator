# Final verification — 2026-09-25

## Product accuracy

- Completed both missions through real Blockly execution before capture; verified results and retry/reset.
- Mission 1 audit: three inspections, 1,000 points. Final direct-route footage: zero optional inspections, 700 points. The result displayed matches the recorded program.
- Mission 2 v2: four fires extinguished, landed, 1,225 points, no collision or page errors. Final fixture adds the actual UP 110 cm block so the drone remains visible above target labels.
- Five core product files match the production site's bytes; evidence in captures/audit/production-parity.json.
- No production files changed. Root test suite: 39/39 passed. No fake scenery, UI, result, water animation or product audio added.
- Read-only independent review found no confirmed product-accuracy, text-overflow or key-subject obstruction issue in the selected evidence. Its scope was source/proof/selected-frame review, not full playback.

## Picture and timing

- All source browser viewports: desktop 1920×1080. UI supersampling is downscaled, never low-resolution upscaling. Home crop excludes the existing concept video.
- Reviewed required previews at 2, 6, 11, 16, 20, 27, 32, 36, 40 and 44 seconds, plus interaction/landing/fire checks.
- 30 fps selected after repeatable 30/60 fps comparison. Offline clock stepping is a capture technique, not evidence of real-time hardware performance.
- Run click occurs at about 14.53 s; the takeoff cut continues from the corresponding airborne state.
- Mission 2 has nine seconds across a wide reveal, tracking and genuine fire action. Result and end card remain readable; end card holds four seconds.
- Poster checked: real Mission 2 environment and visible drone, title and tagline.

## Export checks

All three versions: H.264, 1920×1080, 30 fps, 1,350 video frames, exactly 45 seconds of picture, stereo AAC at 48 kHz. Container duration is 45.056 seconds because of AAC padding. Full FFmpeg decode of each export passed with no errors.

| Version | Bytes | Approximate MB |
|---|---:|---:|
| 1080p | 22,747,098 | 22.7 |
| Master | 40,566,439 | 40.6 |
| Web | 8,922,732 | 8.9 |

Final 1080p AAC measurement: −17.02 LUFS integrated, −1.52 dBTP true peak, 2.10 LU loudness range. No measured clipping. Original synthesis and licence records are documented in ASSETS.md. Subjective listening quality is not established by these numerical checks.

## Re-run evidence

`npm run qa` writes captures/final-technical-qa.json and checks all exports and both mission proofs. Capture groups and render are independent. Generated media, dependencies, caches and previews are ignored; no MP4 is committed. No push, remote change, PR, deployment or Git LFS.

## Playback review scope

The final MP4 was played from start to its `ended` state in the in-app browser with sound disabled, then with sound enabled, and through the native fullscreen video presentation. Screenshots sampled during playback confirm readable desktop UI, visible drone, real result and end card without browser chrome inside the exported image. Full playback was exercised; visual assessment used sampled screenshots and the detailed preview set rather than continuous human observation. Audio-enabled playback was exercised, but this environment does not supply a subjective listening feed; musical balance still merits a human listen before external publication.
