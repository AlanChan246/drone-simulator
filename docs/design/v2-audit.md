# v2 audit — working evidence

Status: Phase 0 in progress. This is an evidence register, not a completed QA claim.

## Baseline

- User approved Model Selection Gate on 2026-09-23. Main agent owns edits, design and final QA; three one-shot read-only agents inspected execution, scene and persistence boundaries.
- The supplied directory had no `.git`. Created local-only repository and original snapshot `b810c85`; no remote configured.
- Static HTML/CSS/global-script application: index.html 514 lines, style.css 3198, main.js 3842, simulator.js 4508. No build compilation; npm start serves static files. Three 0.128 / Blockly 9.3 dependency ranges, lockfile present.
- Existing node tests: 10/10 passed. Most verify module contracts and source structure; no browser journeys, scoring, XML persistence or responsive regression coverage.
- Existing `scripts/verify-mission1-answer.cjs`: FAIL, misses checkpoints (5,10) and (9,1) in all five runs. Its data is duplicated from older routes; not authoritative proof of current completion.

## Architecture map

`index.html` owns screens, controls, toolbox XML and modal shells. Inline handlers call `main.js` functions. `style.css` contains both brand and simulator systems with legacy aliases and layered overrides.

`blockly_def.js` generates commands containing `_blockId` → `main.js:runBlocklyCode` prescans generated JavaScript into `cmdQueue`, creates command/block mappings → `FlightCommandExecution.runQueue` invokes execution gates/highlighting → `dispatchCommand` changes shared `state` → `simulator.js:animateLoop` renders and checks collision/mission progress.

`SceneLifecycle` and its registry order renderer setup and scene entry. `simulator.js` owns environment construction, assets, camera, grid collision, sensors, mission calculations and shared drone state. The procedural medical model is a visual child of `droneGroup`; the outer transform is the physics boundary.

`MissionRules` supplies scene metadata and pending text. Actual completion and score calculation remain in `simulator.js`. `FlightDeckView` centralises basic screen visibility but most DOM knowledge remains in main.js.

`main.js` also owns XML persistence, debug controls, tutorial, briefing, results and an older cinematic preview implementation. `executeQueueSuperseded` retains a second execution implementation that is not the current run path.

## Directly observed Production journeys

Test origin: https://alanchan246.github.io/drone-simulator/ via in-app browser. Browser viewport emulation is not physical iPad hardware testing.

- A: Home → competition → Tunnel Rescue → briefing → open Blockly → drag event and takeoff → Run. Drone reached 80 cm, block highlighting/progress appeared. Then imported `test/fixtures/tunnel-direct.xml` using the actual UI and ran the entire road route to Bravo. Result: 20 s, 0/3 optional checkpoints, 200 exit + 500 time = 700, third class. This proves checkpoints are optional for completion.
- B: Returned home and entered free practice/tutorial. Existing workspace retained its takeoff block when new context had no saved XML; observed tutorial starting at step 3 after opening editor. Source restore returns before clearing on missing save, explaining the context leakage.
- C: Empty Run shows an actionable missing-command message. A takeoff-only mission program ends with incorrect text requiring all three optional checkpoints. Reset preserves blocks. Full program import uses confirmation and reports success.
- D: Selected mission, ran, reset, returned and selected again. Repeated briefing and hidden editor add friction. Additional pause/step/stop/repeat checks pending.
- E: At 1024×768, editor remains ~310 px wide, blocks clip horizontally, large tutorial overlaps flight controls, and mission name/progress disappears from the top bar. Full physical touch testing pending.
- Tutorial helper inserted takeoff → move 50 cm → land. Executed to landed at Z=50. Tutorial announced completion immediately during command 1/3 rather than after successful landing.

## Prioritised findings

1. Task initiation: mission entry hides the editor, despite Run being immediately available. Blank workspace has no starter affordance.
2. Dense briefing: bilingual explanation, duplicate objective/legend rows, time table, grades and tips compete before first action.
3. Optional objectives labelled as required in pending text. Preserve completion/scoring; correct presentation only.
4. Feedback competes: coordinates repeat in control bar/HUD, low-level logs automatically expand, HUD covers world and novice-unneeded speed/water fields appear in all modes.
5. Language mismatch: Chinese categories but English blocks and tutorial refers to a nonexistent “Basic Flight” category.
6. Tablet: toolbar targets around 28 px; workspace clipping; tutorial occludes controls; mission context hidden.
7. State safety: no-saved-context restore retains previous blocks; tutorial helper clears workspace; delayed mission result callback should be checked when resetting/leaving.
8. Execution tracking whitelist differs from block definitions (`drone_set_heading` versus `drone_turn_heading`, `console_print` versus `drone_print`). All generators already embed `_blockId`, so actual impact needs specific verification.
9. Offline: precache misses medical model script and several scene assets; HTML query-string script versions differ from precache keys. Non-document requests fall back to index.html on failure.
10. Pages packaging omits RoundedBoxGeometry.js while index.html references it. Verify actual model fallback and repair packaging without altering deployment method.
11. Accessibility: existing confirmation focus trap and Escape handling are useful, but briefing/result focus containment, hidden workspace exposure and state announcements need runtime tests.

## Behaviour inventory

| Class | Behaviour | Contract |
|---|---|---|
| MUST PRESERVE | Flight commands, collision, sensors, heading/coordinate units | No physics rewrite; outer droneGroup/state contract |
| MUST PRESERVE | Both mission rules, scoring, time bonuses, optional checkpoint semantics | Actual simulator completion functions are authoritative |
| MUST PRESERVE | Blockly execution, pause, step, stop, reset, breakpoint, current-block highlight | Run queue/gates remain shared |
| MUST PRESERVE | XML import/export and autosave | `drone-simulator:v1:blockly-workspace:` + freeplay/mission-1/mission-2; XML string |
| MUST PRESERVE | Road overrides | `drone-simulator-road-overrides-v2`, JSON cell→piece/rotation |
| MUST PRESERVE | Scene lifecycle, static asset paths, Pages and offline support | Same-origin relative paths, pinned libraries |
| SHOULD PRESERVE | Useful flight log, telemetry, camera and resize/zoom tools | Relocate/contextualise; logs are session-only |
| SHOULD PRESERVE | Existing procedural medical drone and local scene assets | Improve framing and contrast, preserve model identity |
| MAY REDESIGN | Home, mission select/briefing/results, onboarding, HUD, editor shell | Replace structure and visual system |
| MAY REDESIGN | Tutorial and advanced tool presentation | Do not overwrite work silently |
| MAY REMOVE | Dead visual chrome/hidden legacy placeholder actions | Only after verifying no functional dependency |
| REVIEW REQUIRED | Duplicate old execution path, dormant model/hero code, reference answers | Do not delete major functionality speculatively |

Flight history is currently a session log, not a persistent history database. Best-result storage was not observed; do not claim it exists.

## Asset inventory

125 files (~34 MB): 90 GLB, 23 PNG, 3 WebM, 3 MP4, 2 JPG plus licence/readme files.

- KEEP: procedural medical drone; scene GLBs/textures; mission preview images pending visual fit. Kenney source documents distinguish CC0 assets from MIT starter-kit code; retain notices.
- IMPROVE: mission markers, camera framing, scene contrast using existing geometry and local assets.
- REPLACE: Unicode/emoji UI iconography with a consistent local SVG family.
- REVIEW REQUIRED: old hero video variants, non-Kenney model/video provenance. Preserve files until usage/provenance decisions are grounded.
- REMOVE: none authorised by this audit yet.

## Remaining Phase 0 checks

Complete returning persistence/reload, error recovery edit/retry, teacher debug controls, mission 2, remaining viewport baselines, keyboard/modals, runtime/deployment asset errors and source-level event/state audit. Save evidence before replacing UI.
