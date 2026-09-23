# Drone Simulator v2 — UX architecture

## Direction

Rescue field school: daylight-readable warm neutral work surfaces, deep teal navigation, rescue orange primary action, real scene imagery. The world carries the experience; controls behave like a small field kit. The incumbent black marketing screen / dense dark console split is replaced. No framework migration.

## Navigation and learning loop

Home answers what this is (program a rescue drone), what to do (choose a mission), and where to start. Free practice and an interactive first flight are secondary paths. Mission selection shows the two real missions, their goals and learning concepts; do not invent completion history or duration estimates.

Mission briefing summarises situation, required finish, and optional score goals. Detailed rules and time tiers remain available through disclosure. Entering the deck opens the programming workspace automatically. Program → run → observe → revise is the persistent task sequence. During execution, show the active command and progress next to the world, matching the block highlight.

Home → mission selection → briefing → Flight Deck → results → retry / next mission. Free practice leads directly to the deck and has a named purpose, starter flight and rapid reset.

## State and controls

Idle: Run is primary; Reset preserves blocks. Running: Stop/Pause are available and Run is disabled. Paused: Continue and Step name their boundary semantics. Completed program does not imply completed mission; show an educational next step. Successful mission keeps the original score calculation and presents what earned points.

The original simulation `state`, mission evaluators and `FlightCommandExecution` remain authoritative. UI presentation reads state and receives command lifecycle events; it does not calculate a second set of mission rules.

## Progressive disclosure

Always visible: mission/required goal, flight state, altitude, active command. Mission 2 also needs water and battery. Detailed speed, coordinates, logs, breakpoints, imports/exports and camera controls stay reachable without competing with Run. Existing tools are moved, not deleted.

Blockly begins with contextual empty guidance. Starter insertion only fills empty work; replacing existing programs requires the existing confirmation flow. Preserve each context's XML key and schema. New contexts must not inherit another context's program accidentally.

## Tablet

Desktop: world takes at least ~60% in split view, editor has enough width to manipulate blocks. Tablet landscape: explicit Code / World / Split views; primary controls remain in a fixed, non-overlapping bottom row. Touch targets at least 44 px. Portrait phones get a polished rotate prompt with an escape hatch.

## Accessibility and feedback

Semantic buttons and labelled icon controls; visible focus; focus containment/restoration for dialogs; Escape closes secondary surfaces; colour plus text for state; no decorative motion under reduced-motion preference. Keep error messages local and actionable, without raw exceptions. Do not call a tutorial flight complete merely because Run was pressed.

## Module boundaries

Keep classic scripts and pinned libraries. New screen/presentation module owns v2 UI and event bindings; component CSS is split by tokens, base, hub, deck and overlays under assets/styles. Existing physics/scoring files remain separate. Static relative paths continue to work under GitHub Pages subdirectories.
