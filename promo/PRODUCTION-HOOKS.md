# Production hooks

No production source changes or shipped promo mode.

| File | Change / purpose | Activation | Default behaviour / isolation |
|---|---|---|---|
| promo/scripts/audit.cjs | Operate actual mission selection, Blockly XML, Run and retry | Explicit local command | Disposable browser context; normal product untouched |
| promo/scripts/capture.cjs and capture-lib.cjs | Repeatable existing camera/framing, HUD isolation and deterministic screenshot timing | Explicit local command | Browser-only presentation setup; no persisted user profile; no score/state overrides |

Allowed presentation operations: existing V2UI view/camera APIs, existing orbit parameter values, capture-only CSS to frame actual canvas without HUD, browser clock stepping. Camera parameters describe angles obtainable with existing controls, not a new advertised feature. No drone teleport, scene replacement, fake UI, score injection or mission completion override.

The visible cursor is a pointer-events-none SVG placed at the actual Playwright mouse position. Mission 2's additional UP 110 cm block is a real user-authored program in promo/fixtures, not a production hook. It completed all four fires and landing for 1,225 points with no collision or page errors.
