# v2 QA evidence

2026-09-24 · Local build only. No remote, push, PR or deployment. Tests use the in-app Chromium browser and emulated viewport sizes, not physical iPad/Safari hardware.

## Functional evidence

| Check | Observed result |
|---|---|
| Production baseline, tunnel | Actual UI import/run/landing: 9 commands, 20 s, 0/3 optional checkpoints, 700 points, third class |
| v2 tunnel | Same route, command highlighting, destination landing and result: 20 s / 700 / 0 checkpoints; repeated after layout fixes |
| v2 city | Existing 68-command reference completes and lands: 3/4 fires, 475 objective + 450 time = 925 points, second class; three recharge and successful water cycles visible in log |
| City reference limitation | Fourth water collection fails on the supplied route; subsequent spray has an empty tank. `city-reference.xml` is a regression fixture, not a perfect-score answer |
| Free practice/tutorial | 50 cm and edited 100 cm flights take off, move and land at 0 cm; tutorial completes after the final landing, not on Run |
| Error/retry | Removing takeoff produces actionable grounded-flight error; undo restores the block, retry completes |
| Editing | Drag from toolbox, edit number, undo/redo, zoom, starter replacement confirmation and actual valid XML import exercised |
| Debug/teacher | Pause, next-command step, continue, stop and reset exercised; reset keeps blocks |
| Persistence | Reload retains saved programs; returning to missions restores their own XML; an unsaved context starts empty |
| Import resilience | Actual Blockly engine tests malformed XML and unknown blocks; existing program survives rejection |
| Export | UI invokes export and reports filename without exception; in-app browser did not deliver a download event, so final filesystem download is not proven. Blob link lifetime was made safer |
| Camera | Follow, map, top, keyboard orbit and panel resize exercised; canvas no longer steals HUD gestures |
| Completion | Result retry and next mission exercised; result focus wraps, Escape closes; optional objectives explained as improvement goals |

## Automated and packaging checks

- `npm test`: **17/17 pass** (10 existing tests plus real Blockly fixture/import tests and service-worker behavior tests).
- Syntax checks pass for `js/main.js`, `js/v2_ui.js`, `js/simulator.js`.
- `node scripts/verify-static-site.cjs`: **161 offline entries** present in the real Pages preparation recipe, including RoundedBoxGeometry, Chinese Blockly messages and local media; no deployment.
- Service-worker tests cover Pages subpaths, query versions, navigation fallback, fresh online code and missing assets never receiving HTML.
- Actual offline check: opened `offline.localhost:8081`, allowed precache installation, stopped the local server, reloaded home, entered practice, created and executed takeoff → forward 50 cm → land. Scene and blocks rendered, flight ended at 0 cm. Screenshot: `screenshots/after/offline-flight.png`. Server restored afterward. This proves app-server-unavailable operation; it is not a hardware airplane-mode test of external fonts.
- `git diff --check` passes. The dormant baseline `verify-mission1-answer.cjs` still fails two optional checkpoints in its stale hardcoded reference; not silently marked passed or changed to weaken the mission.

## Viewports, accessibility and performance

Desktop 1440×900, laptop 1280×800, tablet 1024×768 and 1180×820, portrait 390×844 inspected. Tablet uses explicit code/world/split modes and bottom controls; phone simulation asks for landscape and allows continuation. Home footer overlap was fixed.

Keyboard focus containment checked in briefing/result; background screens use inert while dialogs/loading are active. Labels, visible focus, reduced-motion CSS, keyboard camera and keyboard resize are implemented. Measured main foreground/background contrast is 4.94–9.50:1; darkened custom Blockly blocks are 4.96–5.67:1 with white labels. This is a targeted accessibility pass, not a full WCAG or screen-reader certification. Blockly 9's complete keyboard-only construction remains limited.

Performance review removed discarded per-frame HUD markup and repeated unchanged DOM text writes. Renderer skips menu/code-only views; model loading and core simulation stay intact. Active v2 CSS is about 27 KB versus the retained 83 KB baseline stylesheet. Offline payload is approximately 16.34 MB/161 entries; old hero videos are not precached. No measured FPS, battery or physical Chromebook/iPad benchmark is claimed. Existing GLTFLoader texture-transform UV warnings remain; a stale mixed-version loader failure encountered during development was resolved by consistent asset revisions.

## Defects repaired and retained boundaries

Repaired cross-mission workspace leakage, premature tutorial success, destructive invalid imports, unreadable-save overwrite risk, misleading optional-goal text, unhandled run errors, delayed result after leaving/reset, canvas height after layout changes, missing offline dependencies and asset-to-HTML fallback. Physics, collision boundaries, mission score formulas, movement units and existing XML/localStorage formats were retained.

## Acceptance limits

The implemented v2 and desktop/emulated-device checks are complete. Physical iPad Safari touch/drag, real Chromebook performance, assistive-technology testing and confirmed downloaded-file delivery remain unverified. The original Production city route was inspected but not run end-to-end; the city completion evidence above is v2 only. These limits must not be presented as passed hardware tests.

## Independent finish verdict

First capture check requested recapture of an incorrectly sized home image; full 1440×900 evidence replaced it. Full review matched home topology, typography, material, ground and icon treatment, then requested two checks. A fresh verdict pass confirmed tablet controls were already visible (prior finding was a false positive) and accepted the stronger practice grid, live drone/action label and takeoff status. Final scoped disposition: **ship**. No other regressions observed in those two captures; not a claim of independent full functional QA. Main agent retained final acceptance.

## Local checkpoints

`b810c85` original snapshot → `1863bf6` audit/architecture → `0874f57` redesigned shell/learning workflow → `2d32818` persistence, responsive feedback and offline hardening. Final documentation/screenshots are committed separately. No remote is configured.
