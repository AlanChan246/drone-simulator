# Mission 3 verification evidence

Captured locally on 2026-09-26. Screenshots show the actual application and scene, not illustrations. Completion was reached by running the teacher Blockly XML; no test sets `missionCompleted` to true.

- `browser-qa.json`: four relay configurations, late-safe-window seed, negative programs, reset, persistence and four viewport bounds.
- `mission1-regression.json`, `mission2-regression.json`: actual legacy mission completion and scene cleanup.
- `performance.json`: final texture-sharing build, 16 forced RNG cases, three mission switch cycles and desktop rendering measurements.
- `load-recovery.json`: intentionally unavailable asset manifest yields a useful retry message.
- `mission-select.png`: all three mission cards with actual scene preview.
- `desktop*`, `laptop*`, `tablet*`, `ipad-landscape*`: split view, code, briefing and result at required sizes.
- `drone-base.png`, `port-relay.png`, `town-relay.png`, `medical-centre.png`, `mountain-relay.png`, `storm-warning.png`: geographic landmarks and storm status.
- `mission-complete.png`: successful restoration, return and landing.
- `performance-viewport.png`: final resource-sharing build.

Independent read-only screenshot review: **ship** within the requested desktop/iPad-landscape UI scope, no material fixes. Main-agent verification remains authoritative. No physical iPad/Safari claim is made. See `docs/mission-3.md` for exact commands, measured results and limits.
