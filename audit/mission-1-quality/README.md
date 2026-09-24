# Mission 1 Quality Pass — QA evidence

Baseline: `460e863` (including the user's updated rescue-drone paint). Checkpoint tag: `mission1-quality-checkpoint-460e863`. The baseline was also served from a temporary Git archive for matched-resolution measurements; no alternative scene ships in the product.

## Behaviour and actual flights

- `before/contract.json` vs `after/contract.json`: identical 12×12 grid, spawn, goal, **2,880 sensor readings** (60 walkable cell centres × 4 altitudes × 4 headings × 3 directions), and **625 collision probe positions** (both resulting axes recorded).
- `after/full-flight.json` and `after/completion-1440.png`: actual Blockly import + normal Run, 22 commands, 3/3 inspections, Bravo landed, no collision. Result: 50 seconds, 300 inspection + 200 exit + 500 time = **1,000**.
- `after/direct-flight.json` and `after/direct-completion.png`: actual nine-command route, 0/3 inspections, Bravo landed, no collision. Result: 20 seconds, 200 exit + 500 time = **700**. Confirms optional inspections.
- `after/collision.json` and `after/collision-feedback.png`: actual takeoff → forward 300cm → land stops at z≈−615.5 near the first wall rather than crossing to z=−375; mission remains incomplete. The subsequent land command clears the per-command collision flag, as in the original simulator.
- `after/retry.json`: actual result-dialog Retry returns to (-675,0,-675), clears inspection progress, score and completion, retains Blockly program.
- `after/live-flight-ipad.png`, `after/completion-ipad.png`: actual flight using Follow and actual completion at 1180×820.
- `before/mission2.json` vs `after/mission2.json`: identical Mission 2 grid, spawn, goal, global light colours/intensities/positions and exposure after Mission 1 → Mission 2. Corresponding screenshots preserve its scene identity.
- Repeated Build timing invokes the real scene switch five times; construction completes without errors. Existing source-hash protections continue to cover mission logic, sensors, physics and Mission 2 builders.

## Performance

Use **performance-matched.json**, not the initial `performance.json` samples: the first browser session used DPR 2 while later viewport tests used DPR 1. Matched comparison uses the same browser, viewport 1440×900, WebGL drawing buffer **1408×638**, same map camera, 120 display-frame intervals after settling.

| Measurement | Before | After |
|---|---:|---:|
| Median display-frame interval | 16.7 ms | 16.7 ms |
| p95 display-frame interval | 17.7 ms | 17.6 ms |
| Draw calls, including shadows | 429 | 435 (+1.4%) |
| Rendered triangles, including shadows | 125,109 | 113,715 (−9.1%) |
| Renderer textures | 19 | 22 |
| Unique environment material objects | 178 | 61 |
| Environment mesh objects, including hidden sensor shapes | 353 | 379 |
| Environment shadow casters | 84 | 84 |
| Warm scene-build median, 5 switches | 7.0 ms | 7.4 ms |

The warm-build delta is 0.4 ms; there are no new network assets or external downloads. These are local browser measurements, not GPU timer queries or physical iPad benchmarks. Display-frame intervals are refresh-rate limited and do not measure all available GPU headroom. Material and object counts include compatibility-only hidden markers; their lights are not rendered.

## Visual comparison and camera reproducibility

The harness offers overview, top, takeoff, flight and objective controls. Before/after camera JSON records the precise position, target, radius and angles. Identical camera settings are used for comparisons.

| View | Before | After |
|---|---|---|
| Overview 1440×900 | [before](before/overview-1440.png) | [after](after/overview-1440.png) |
| Top 1440×900 | [before](before/top-1440.png) | [after](after/top-1440.png) |
| Launch / follow | [before](before/takeoff-1440.png) | [after](after/takeoff-1440.png) |
| Fixed mid-route camera | [before](before/flight-1440.png) | [after](after/flight-1440.png) |
| Bravo objective | [before](before/objective-1440.png) | [after](after/objective-1440.png) |
| Overview 1280×800 | [before](before/overview-1280.png) | [after](after/overview-1280.png) |
| Overview 1180×820 | [before](before/overview-1180.png) | [after](after/overview-1180.png) |
| Mission 2 restoration | [before](before/mission2.png) | [after](after/mission2.png) |

The fixed `flight-*` comparison sets a deterministic position at height 50; it is a camera setup, not proof of flying. The separate `live-flight-ipad.png` captures genuine in-progress flight. Target and takeoff views were also inspected at 1280×800 and 1180×820. HUD and flight controls remained visible. The existing overview/top label clipping policy was unchanged; the new world-space Bravo pad supplies a visible destination even without its DOM label.

Inspected for visual noise, road continuity, target contrast, sky/ground hierarchy, aircraft silhouette, building proportions, shadows and z-fighting. An initial thin-surface depth conflict was fixed before the confirmation screenshots. Building silhouettes and existing tree clusters remain intact. Decorative vegetation is restricted to civic planters, rather than replacing the city with woods.

## Checks and limitations

- `npm test`: 25/25 pass, including four added behavioural tests using actual Mission 1 functions and real Blockly fixture compilation.
- `node scripts/verify-mission1-answer.cjs`: full route reaches all three current inspection coordinates; direct route lands without inspections. Replaces the stale handwritten verification route, not the learner's mission rules.
- `node scripts/verify-static-site.cjs`: 165 offline entries present; audit harness excluded from package. No deployment.
- Browser error capture: no JavaScript errors during the tested flights and switches. Existing GLTF UV-extension warnings remain; not introduced by this pass.
- Impeccable detector: no findings in regex fallback mode; missing HTML parser means this does not certify computed UI contrast.
- iPad **viewport emulation only** (1180×820). No claim of physical iPad/Safari, touch-device or low-end Chromebook performance certification.
- Local screenshots are inspection evidence, not a broad automated visual-diff guarantee; animated Mission 2 fire effects may differ by frame.

## Reproduce

Run the normal local server and open `/audit/mission-1-quality/harness.html`. The harness uses real app entry points, Blockly imports and the Run button. Its Contract button probes sensors and collision positions; use a view/reset control afterwards. All harness code lives under audit/ and is excluded by the existing Pages package recipe.

No push, PR or deployment was performed. The rollback checkpoint is available locally.
