# Mission 3 — 暴風島能源重啟

Storm Island: Restore the Grid 將學生從直接駕駛帶到「感測 → 判斷 → 行動 → 重複」。Mission 1 的路線搜救和 Mission 2 的取水滅火保留原有行為。

## Story and completion

風暴切斷離島供電；醫療中心只剩備用電源。學生必須起飛、掃描港口 A／城鎮 B／山區 C 三個能源站，恢復離線站，確認全部供電，再回到 Drone Base 降落。正常能源站也要掃描確認。提早返航或漏掉離線站不會完成。

## Relay and randomization

Relay has ACTIVE / OFFLINE states, plus visual UNKNOWN, ACTIVATING and RESTORED feedback. Station numbers 1–3 address individual locations. Scan requires horizontal distance ≤85 cm and altitude within 65 cm of the marked waypoint. Activation requires a prior scan and an offline station. Activating an already active station is harmless but counted as waste.

Each new mission selects a seed and one of four configurations: two offline with A/B/C active, or all offline. New entry changes the configuration; reset/retry preserves it for debugging. The seed also offsets the storm cycle. Production chooses seeds using `crypto.getRandomValues`; local development accepts `?mission3State=test-a|test-b|test-c|all-offline` or `?mission3Seed=...`. These overrides are ignored on non-local hosts.

## Storm and backup power

A reproducible 24-second simulated storm cycle is DANGER 85 for 9 seconds, WARNING 45 for 4 seconds, then SAFE 15 for 11 seconds. The sensor reads the mountain forecast from anywhere. Students can wait outside the zone and repeatedly check it before departing. A waypoint flight takes 5 seconds, scan 1 second, activation 2 seconds. No random forces move the drone.

The mountain hazard is a 290 cm radius around C above 80 cm. DANGER blocks activation and adds exposure. At 30 cumulative seconds the mission fails with advice to wait outside. Collision proxies stop flight with specific recovery feedback; high-poly visual meshes are not used for collision. Movement is checked in small simulation steps.

Medical backup lasts 600 simulated seconds before grid restoration. It drains during flight-program actions, including hover/wait; time spent editing or paused between blocks does not drain it. Restoring all three stations restores normal medical power. Power failure requires reset, preserving the program and seed.

## Programming architecture

`js/mission3/core.js` owns deterministic domain rules; `blockly.js` defines capabilities and isolated compilation; `runtime.js` runs commands against the live simulation; `scene.js` loads and composes the environment.

Mission 1/2 keep the original precomputed command queue. Mission 3 temporarily wraps supported Blockly statement generators during synchronous compilation and restores them in `finally`. The generated async program awaits each movement or action before evaluating subsequent sensors and branches. Standard Blockly IF/ELSE, repeat, while/until, for, arithmetic and variables retain their meaning. Loops yield and have a 600-iteration guard. Commands have a separate 600-action limit. A run-generation token prevents stopped or reset animations from mutating a newer run.

Mission-specific blocks: Scan Relay, Relay Status, Activate Relay, Storm Level, Checked Relay Count, travel to one indexed station, and return to base. A travel block performs no scan, repair, choice of station or loop. It ascends, traverses and descends to one explicit target. No block completes the mission or visits all relays automatically. Standard hover supplies wait. A scoped toolbox excludes unsupported procedures and advanced legacy power-control commands; importing them produces a recoverable message, not a silent fallback.

The Mission 3 autosave key is `drone-simulator:v1:blockly-workspace:mission-3`; legacy keys and XML formats are unchanged. Existing workspace replacement remains transactional.

## Scoring and feedback

Completion is 500 points; safety up to 150; coding efficiency up to 250; time up to 100. An incomplete mission earns no completion score. Efficiency considers effective IF use with status readings, loops, storm readings, variables, duplicated capability blocks, redundant scans/activations, unnecessary waypoint moves and flight distance. It does not reward block count alone. Block count is reported for reflection.

Progress uses labels as well as colour. Relay markers show unknown, offline, normal, activating or restored. Infrastructure light pools respond to restored relays; the medical area lights when the whole grid is online. Results show repair count, distance, block count, waste, exposure, time and coding efficiency.

Four progressive hints move from observing differing states, to IF, to a station counter and repeat, to repeatedly checking the storm. The full reference solution is not exposed through student UI.

## Scene and design

The existing rescue field school UI is extended in Operate mode: compact warm-paper HUD, readable Chinese status, existing controls, no new visual identity. A maritime palette and island geography distinguish this mission.

- Base: landing platform, emergency tent, command equipment, rescue vehicle, solar charging and mast.
- Port: warehouses, stacked containers, quay, cargo ship, tug, crane, flooded roadside and traffic barriers.
- Town: residential and commercial models, road network, obstructed junction, civic shelter and street lamps.
- Medical Centre: recognisable building, rooftop helipad, ambulance, tent and generator.
- Mountain: authored rock meshes, forest, raised relay platform, communication tower and wind turbine.
- Storm Zone: local cloud/rain, continuous sensor readout and measurable safety consequences. Reduced-motion preference hides rain; there are no flashing lightning effects.

Primary art uses real external GLBs. Procedural geometry is limited to water, gameplay indicators and lightweight effects. See [asset register](assets/mission-3-assets.md) for licences and exact files. Static model instances share scene-owned geometry/materials; the global template cache survives scene switching. New assets are loaded only on entry to Mission 3, while the offline app shell includes them for subsequent offline use.

## Teacher / QA reference

`test/fixtures/mission3-reference.xml` is an internal reference: initialise `restoredRelays`, take off, if the initial forecast is already SAFE wait until that partial window ends, then iterate station 1–3, wait until storm <40, fly to the current station, scan, activate only if OFFLINE, increment the counter, return, land. It demonstrates a robust solution across every supplied test state and all 24 initial storm phases. A SAFE reading alone does not imply a full 11 seconds remain; the initial phase alignment avoids departing late in a window. Other correct orderings and repetitive programs can complete; repetition receives weaker efficiency feedback.

## Verification

- `npm test`: existing contracts plus Mission 3 domain and real Blockly generation tests.
- `node scripts/verify-static-site.cjs`: existing packaging recipe, entirely local.
- `node scripts/verify-mission1-answer.cjs`: legacy route fixtures.
- `node scripts/mission3-browser-qa.cjs`: real Chromium playthroughs, negative cases, persistence, reset cancellation and viewport evidence. Requires a local server and Playwright; `PLAYWRIGHT_MODULE` can point to an existing installation, `QA_URL` selects the server, `QA_CHANNEL` selects the installed browser.

Browser evidence and final results are recorded under `audit/mission-3/`. Desktop emulation and iPad-sized viewports do not establish physical iPad GPU or Safari performance. No production deployment is part of this change.

## Final QA record — 2026-09-26

- `npm test`: **47/47 passed**, including 96 real Blockly/domain runs (four relay patterns × 24 initial storm phases), nested IF/ELSE, generator restoration and legacy byte contracts.
- Real Chromium: all four relay patterns completed from Blockly through scan/activate/return/land; reference scores 951/1000, 34 blocks, no redundant activation and zero danger exposure. A separate seed 30 run begins at phase 22 and also completes with zero exposure.
- Negative browser cases: early return and ignored offline relays cannot complete; unsafe storm exposure fails with advice; repetitive unconditional repair can complete but earns lower efficiency; mid-flight reset cancels stale execution. Workspace survives reload.
- Mission 1: actual direct-route fixture completed after Mission 3, landed at Bravo, no collision or Mission 3 toolbox/HUD leakage. Mission 2 v2: actual four-fire fixture completed after visiting Mission 3, four fires extinguished, 1225 points, no collision, old scene disposer restored. See the two regression JSON reports.
- Responsive evidence: 1440×900, 1280×800, 1024×768 and 1180×820 landscape, including editor, HUD, briefing and result. No document overflow or offscreen result actions. Narrow split views use Blockly's existing pan/scroll; dedicated code view remains available.
- `node scripts/mission3-lifecycle-qa.cjs`: 16 forced repeated RNG seeds terminate with changed patterns; reset retains the seed; three 2→3 switch cycles retain 143 geometries / 40 renderer textures / 54 model batches. An intentionally blocked manifest produces a retry message and returns to selection, without an uncaught page error.
- Final local headless Chrome sample at 1180×820: 549 ms Mission 3 entry, 157 draw calls, 76,715 triangles, 80 scene materials, 38 scene textures (40 including shared renderer content), textures at most 512×512, 54 shadow-casting model batches, no additional scene lights. Frame interval median 16.7 ms / p95 16.7 ms over 120 frames. These are one desktop localhost sample, not network-load guarantees or physical iPad measurements.
- Texture copies are shared per source texture inside each scene. Browser playthrough records precede that optimization (55 renderer textures); the final lifecycle measurement above supersedes that resource count.
- Static-site verifier passed with 197 offline entries. GLB checksums, external texture references, JavaScript syntax and `git diff --check` passed. No new file exceeds 5 MB.
- Independent read-only UI review disposition: **ship**, limited to the supplied desktop/tablet captures. The detector was degraded by missing optional parser dependencies; its empty result is not treated as proof of accessibility compliance. Primary-agent visual verification also completed.
- The Mission 2 trace retains an initial preview-image 404 from before the first preview was generated. Final lifecycle requests have zero HTTP failures; the generated preview and offline package now exist.

### Remaining limits

Physical iPad GPU, touch interaction and Safari have not been certified. The scene uses coherent low-poly/stylized models rather than photorealistic art. Mission 3 deliberately supports the documented toolbox subset; imported unsupported procedures/advanced legacy power blocks show a recoverable error. Existing Mission 1/2 support is unchanged. No production deployment, push or PR was performed.
