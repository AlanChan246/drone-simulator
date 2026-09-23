# Drone Simulator v2 design system

## Direction

A rescue field school: warm paper, deep teal and rescue orange. Students connect code to visible flight, rather than operate a wall of instruments. Existing locally stored mission-world images establish the subject; no decorative hero video is loaded by the new home.

## Implemented tokens

`assets/styles/tokens.css` is authoritative. Background `#f4f2eb`, surface `#fffef9`, primary `#bf461e`, secondary `#164d48`, text `#173b37`. Success, warning, danger, information, mission and flight states have semantic aliases. Colour accompanies text, never replaces it.

Typography uses Traditional Chinese first: Noto Sans TC with PingFang TC/Microsoft JhengHei fallbacks; IBM Plex Sans display; IBM Plex Mono telemetry. Display 36–60 px, H1 28–42, H2 23–28, H3 20, body 15–16, UI 13–15, caption 11–12. Body line height 1.5–1.9. Web fonts retain the existing Google Fonts source and fall back offline; no font download is required for operation.

Spacing tokens: 4, 8, 12, 16, 24, 32, 48, 64 px. Radius: 6 px controls, 12 px surfaces. Borders separate permanent regions; shadow is reserved for floating hints/dialogs. Layers: world labels 4; HUD 5; flight log 8; navigation 30; utilities 40; loading 95; dialogs 100; messages 150; orientation/file-origin support 9000.

## Controls

- Primary: rescue orange, one decision per screen (start, run, next mission).
- Secondary: bordered neutral buttons (practice, reset, retry).
- Tertiary: text link or quiet tool.
- Icon: consistent authored 24×24 SVG strokes, 20 px rendered in ≥44 px target.
- Destructive/stop: danger text with an explicit word.
- Focus: 3 px blue outline with offset; reduced motion disables nonessential transitions.

The new CSS entry point is `assets/styles/v2.css`, importing tokens/base/hub/deck/overlays. The original stylesheet is retained as baseline evidence but no longer loaded. New presentation behavior lives in `js/v2_ui.js`; main.js remains the lifecycle and command integration seam.

## Workspace and responsive rules

Desktop starts with a 38% editor and the remaining area as the world. Resize separator remains usable. Code-only and world-only modes preserve the same workspace and simulation. Below 1100 px entry defaults to full-width programming; students switch to flight or explicitly choose split view. This avoids scaling the same narrow desktop editor onto tablets. Execution controls remain at the bottom. Under 700 px the hub stacks; portrait phone simulation gives an orientation prompt.

The beginner HUD shows flight state/height, adding water and battery only for the fire mission. Detailed telemetry and debug controls are opt-in. Logs stay collapsed even on errors; plain-language recovery feedback appears separately.

## 3D presentation boundary

Camera framing, free-practice ground/sky, world labels and rendering visibility are presentation. Movement, collisions, map cells, scoring, mission thresholds and the outer drone transform are retained. No new texture/model dependency was introduced.

## Assets and provenance

Mission preview images and all GLBs are pre-existing local assets; their original notices remain in assets. UI SVG paths and free-practice ground are authored in code. No new third-party bitmap, model or icon package was added. Legacy media provenance remains a baseline limitation, not a claim of new licensing review.
