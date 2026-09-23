# v2 QA evidence — in progress

Date: 2026-09-23. Local preview: localhost:8081. Local changes only; no remote or deployment.

## Verified so far

- Original production main journey completed: Tunnel direct road route → land → 20 s / 700 points / 0 optional checkpoints.
- New local route through UI XML import and confirmation → nine commands with highlighting → same 20 s / 700 points / 0 checkpoints.
- Retry returns to start and retains the imported XML workspace.
- Free-practice starter executes takeoff → forward 50 cm → land.
- Empty workspace starter, Chinese block labels, code/flight/split navigation, home/mission/briefing/result screens exercised.
- Initial node tests: 10/10 pass after main shell and translation changes.
- 1440×900 home, mission selector, briefing, simulator and result inspected. Screenshots in `screenshots/after`.
- Original production 1024×768 clipping and tutorial overlap recorded; new tablet QA pending.

## Defects addressed

Missing-save contexts previously retained another mission's blocks. Restore now clears on a genuinely absent save, retaining the original keys/XML format. Tutorial formerly marked success on Run; it now checks a complete takeoff/movement/landing run and asks before replacing existing blocks. Optional objectives no longer appear as mandatory failure conditions. Runtime rejection is caught and offers reset/retry. Delayed result display checks that the same completed run still exists.

Main shell now opens Blockly, has code/world modes and clear command feedback. Repeated camera tools/novice debug controls are collapsed. Free practice uses a lighter ground. Discarded per-frame HUD strings and invisible renderer draws are removed. Scene preparation has a loading state.

Offline manifest now includes actual app scripts/styles/models and Traditional Chinese Blockly messages. Script/style/document requests use network-first with cached fallback; failed asset requests no longer return HTML. Pages package now includes RoundedBoxGeometry. These changes still require final static-package/offline verification.

## Known limits / remaining work

This document is not final acceptance. Still required: city mission end-to-end, physical-touch caveat and emulated tablet sizes, error/retry, undo/redo, keyboard/focus, persistence reload, asset/cache packaging checks, performance review and final screenshots. No physical iPad is connected. Browser emulation does not prove Safari or touch hardware support. Existing GLTFLoader emits KHR_texture_transform UV warnings; no browser errors observed during the completed tunnel run.

Baseline reference-answer verifier fails because its old hardcoded route misses two optional checkpoints; do not treat it as a current mission failure or silently claim it passed.
