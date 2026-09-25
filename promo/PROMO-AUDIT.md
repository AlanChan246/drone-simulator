# Promo audit — 2026-09-25

## Verified product

Desktop only: 1920×1080 CSS viewport, light theme, disposable browser profile. Production index.html, main.js, simulator.js, v2_ui.js and Mission 2 v2 environment.js are byte-identical to this checkout. Evidence: captures/audit/production-parity.json. No production changes.

Executed the actual Blockly fixtures through the Run button, with normal execution speed, collision and mission rules. Mission 1: all three inspections, landing, 57 s, 1,000 points. Mission 2: runtime sceneVariant `mission2-v2`, four fires, landing, 91 s, 1,225 points. Both retry buttons restored spawn and incomplete state; Mission 2 fire count reset to zero. No page errors or HTTP errors in either full run. Evidence: captures/audit/audit.json and desktop PNGs.

## Strongest moments

- UI: warm paper/teal/orange Home invitation and mission selection; real result includes purpose, score and retry/next mission.
- Blockly: real blue flight blocks beside the world; orange Run; highlighted command plus moving drone is the central proof.
- Mission 1: orange medical drone leaving ALPHA, street movement between contrasting buildings, green BRAVO landing, result. Use the shorter real direct-route fixture for readable code and an unambiguous landing payoff; its result must come from that same run.
- Mission 2 v2: overhead forest/service-road composition; ranger building, water tank and rescue shelter provide identity; moving drone above paths; water collection and fire A suppression beside final rescue pad provide action.

## Weak states and risks

- Home embeds an explicitly labelled concept film. Exclude this rectangle from the edit: use a crop of the genuine desktop Home copy and controls, never the concept video.
- Full overview makes the drone too small. Reserve for establishing shots, then use closer existing orbit/follow controls.
- Default follow radius 220 is tight; trees/buildings can obscure context. Compare wider radii and elevated angles before selection.
- Full inspection program is too long to explain in seven seconds. The nine-command direct route is real and easier to read.
- Loading-hidden alone does not guarantee all GLBs are loaded. Wait for scene promise, network settlement, textures and a stable rendered frame.
- Headless shell uses software WebGL here. Audit succeeds, but realtime screen capture cannot be assumed to deliver 60 unique frames/s. Compare deterministic frame capture at 30/60; log cadence and use explicit frame stepping if needed.
- No authored motor/mission audio found in simulator execution code. Blockly has built-in edit sounds. Use documented original editorial music/SFX without claiming these are game features.

## Capture approach

Playwright, fresh context per group, existing startMission/XML/Run/reset APIs. All missions execute normally to requested moments; never set completion, score, fire state or drone position. Capture can temporarily isolate the actual WebGL canvas and position existing camera parameters within user-accessible ranges. These browser-only presentation changes live in promo scripts and disappear on reload. No production hook currently needed.

Audit images are observations, not final footage. Final requires candidate angle comparison, action capture, preview frames, full viewing and audio QA.
