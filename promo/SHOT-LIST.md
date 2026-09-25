# Shot list

All sources: authentic desktop product at 1920×1080, optional deviceScaleFactor 2 for UI crops. Durations below are edit lengths; source handles may be longer. Capture method for all motion: Playwright browser-clock stepping + PNG stream → FFmpeg H.264. Actual Blockly execution remains authoritative.

| Shot ID | Scene | Duration | Camera | Action | UI state | Expected output | Notes |
|---|---|---:|---|---|---|---|---|
| S01 | Mission 1 | 4 s | Close elevated existing orbit, slow restrained angular drift | Drone on ALPHA or real takeoff | Canvas isolated | m1-hero.mp4 | Reject low angle 130°/58°: inside building. Use clear 45°/30° family. |
| S02 | Home | 2 s | Fixed desktop crop | Pointer approaches Start | Actual Home | home.mp4 | Exclude right-hand concept-video rectangle; preserve actual heading/buttons. |
| S03 | Mission Select | 2 s | Full desktop | Pointer moves to Mission 1 | Both real mission cards | mission-select.mp4 | UI not rebuilt. |
| S04 | Mission 1 Blockly | 5.8 s | Split view, larger real workspace zoom | Actual distance field edited to correct 300 cm | Code and starting drone | blockly.mp4 | Ten visible blocks including event; nine actual flight commands. |
| S05 | Mission 1 Run | 1.2 s | Same split view | Actual Run click; block highlight and takeoff | Normal Run control | run.mp4 | Same XML as all Mission 1 action/result footage. |
| S06 | Mission 1 | 3 s | Elevated follow, radius around 360–500 | Real takeoff and first movement | Canvas only | m1-takeoff.mp4 | No state teleport; begin reset then Run. |
| S07 | Mission 1 | 3 s | Elevated follow, radius around 500 | Middle street segment | Canvas only | m1-flight.mp4 | Avoid skyline/building occlusion. |
| S08 | Mission 1 | 4 s | Fixed BRAVO approach, radius around 650 | Final approach and actual landing | Canvas only | m1-landing.mp4 | Use real command index/position triggers, not estimated wall time. |
| S09 | Mission 1 Result | 5 s | Actual result UI, desktop | Genuine completion feedback | Result dialog | m1-result.mp4 | Direct-route score and time; never reuse all-inspections result. |
| S10 | Mission 2 v2 | 3 s | 3400 radius, theta about 38°, phi 48°, slow reveal | Live scene atmosphere | Canvas only | m2-wide.mp4 | Forest, ranger hut, service road and rescue station visible. |
| S11 | Mission 2 v2 | 3 s | Elevated follow, radius about 500 | Real movement after first water pickup | Canvas only | m2-track.mp4 | Keep drone and recognizable paths visible. |
| S12 | Mission 2 v2 | 3 s | Fire A, radius about 650, theta 110°, phi 38° | Arrival + actual release-water effect + fire extinguishes | Canvas only | m2-fire.mp4 | Target action, not a third landscape. |
| S13 | Existing sources | 2 s | Match source | 3–4 brief recalls | Mixed | Reuse captured clips | No extra capture needed. |
| S14 | End card | 4 s | Static composition | Small text reveal then hold | Editorial typography | Remotion | URL visible throughout final hold. |

Additional Mission 1 aerial candidate: m1-wide. Additional Mission 2 result and landing: evidence and potential montage use. Every chosen source has a captures/<id>.json sidecar with frame count, actual action/mission state and source timing.
