# Mission 2 v2 — 林地山火・前線救援走廊

Approved 2026-09-24. Scope: independent environment rebuild. Operate mode, educational aerial readability, stylized realism. Code-led 3D scene; no raster concept or AI-generated asset is required. Subagents: none, as approved.

The launch clearing anchors the northwest, a managed woodland trail network connects four water collection points and three field chargers, and the northeast rescue platform lies next to priority fire A. Scorched ground and sparse damaged trees explain the fire response. Context beyond the 21 m playfield adds a forestry service road, ranger outbuilding, water tank and rescue staging shelter at believable scales. No large building is squeezed into a 1.5 m mission cell.

Daylight palette: sage/olive vegetation, warm sand trails, pale concrete, dark evergreen roofs, muted blue water, rescue orange. The scene should read as a place, with a foreground approach road and background woods; the unchanged route network stays legible. No giant arrows, military imagery, dark smoke blanket, new objective, new obstacle or altered height map.

Implementation: independent configuration and builder under `js/scenes/mission2-v2/`. A narrow simulator bridge initializes existing mission globals. Sensor-only geometry uses unchanged legacy wall/charge builders with local invisible material clones; new rendering is built independently. Stateful fire/charge visuals attach to the existing reset/interaction protocol. Atmosphere is restored on scene exit.

Entry: open the app with `?scene=mission2-v2`, then choose Mission 2 normally. No parameter (or `?scene=mission2-legacy`) selects Legacy. Other missions ignore the parameter. This is a development URL, not a new student menu.

QA evidence and measured budgets are recorded in `audit/mission-2-v2/README.md`. All files and checkpoints are local only.

Visual QA found that the added outside context needs overview radius 3800, selected by one v2-only line in `v2_ui.js`. A one-line v2-only branch in `main.js` also selects a scene-specific legend so the briefing no longer promises Legacy arrows or campfires. Both are presentation adapters; all gameplay statements remain byte-identical.
