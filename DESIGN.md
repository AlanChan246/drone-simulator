---
name: Drone Simulator v2
description: Rescue field school — code, observe, improve.
colors:
  paper: "#f4f2eb"
  surface: "#fffef9"
  primary: "#bf461e"
  secondary: "#164d48"
  text: "#173b37"
  muted: "#64736b"
  border: "#cdd4c8"
  focus: "#146b88"
  elevated: "#ffffff"
  primary-hover: "#9b3414"
  text-secondary: "#4f625c"
  divider: "#e1e5dc"
  success: "#286c4b"
  warning: "#825713"
  danger: "#b12c36"
  info: "#276780"
  accent: "#f0b95d"
  canvas: "#cbdad4"
  backdrop: "#143b37a8"
typography:
  caption:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "13px"
  label:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "14px"
  reading:
    fontSize: "16px"
  title:
    fontSize: "18px"
  section:
    fontSize: "20px"
  brand:
    fontFamily: "IBM Plex Sans, Noto Sans TC, sans-serif"
    fontSize: "22px"
  dialog:
    fontSize: "24px"
  headline:
    fontSize: "28px"
  display:
    fontFamily: "IBM Plex Sans, Noto Sans TC, sans-serif"
    fontSize: "clamp(36px, 4vw, 60px)"
  mission-heading:
    fontSize: "clamp(28px, 3vw, 42px)"
  tablet-display:
    fontSize: "40px"
  telemetry:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "20px"
  body:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "15px"
    lineHeight: 1.5
rounded:
  detail: "2px"
  control: "6px"
  panel: "12px"
spacing:
  small: "8px"
  medium: "16px"
  large: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "10px 20px"
    height: "48px"
---

# Design System: Drone Simulator v2

## Overview

Rescue field school: daylight-readable surfaces, real mission-world imagery and a small set of clear controls. The home invites a student to begin a rescue; the flight deck helps them connect a highlighted block with visible drone movement and a mission result. Operate is the deck's mode, with the 3D world carrying the experience.

This replaces the previous dark marketing/console visual world. It preserves the simulator, mission data, scores, models and program formats. Product truth is in PRODUCT.md; implementation tokens in assets/styles/tokens.css are authoritative.

## Colors

Warm paper `#f4f2eb` is the page field; `#fffef9` is the working surface. Deep teal `#164d48` marks selected views and the drone label; rescue orange `#bf461e` identifies the primary next action. Text is `#173b37`; muted text `#64736b`. Success, warning and failure always include words.

## Typography

Functional secondary labels use a 13 px floor, controls 14–15 px and reading paragraphs 14–16 px. The documented display steps follow the existing responsive title hierarchy; 2 px radius belongs only to the narrow resize grip, never cards.

Traditional Chinese body text uses Noto Sans TC with local CJK fallbacks. Display uses IBM Plex Sans/Noto Sans TC; measurements use IBM Plex Mono. Existing Google Fonts delivery is retained, with offline fallbacks. No self-hosted font is claimed. Headers, plain-language instructions and numeric telemetry have distinct scale and weight; monospace is for measurements and logs.

## Layout

Home pairs a large existing mission image with a concise invitation, main mission action, practice and first-flight route. Mission cards are the two actual scenarios. Briefing places optional full rules behind disclosure.

Desktop deck starts at 38% code, remaining world; the separator resizes. Code/world/split views share the same program. Below 1100 px start with full-width code and switch to world on execution. Bottom execution controls remain visible. Below 700 px home stacks; portrait simulation offers a rotate prompt. Spacing scale: 4/8/12/16/24/32/48/64 px.

## Elevation & Depth

Permanent regions use thin borders. Floating dialogs/hints use `0 12px 36px #183e3826`; the current-command panel has a smaller diffuse shadow. World labels and HUD sit above canvas; menus and protected-focus dialogs sit above the deck. Do not add decorative glass or glow.

## Shapes

6 px control corners, 12 px panel corners. Authored 24×24 SVG stroke icons render at 20 px. Tool targets are 44 px; desktop view tabs are 36 px, becoming 44 px on tablet. Avoid emoji as formal controls.

## Components

Run is orange; reset/retry are quiet bordered controls. Pause/stop become enabled with execution state. The toolbox initially exposes event, flight, and an expandable advanced group. All existing block types remain available. Save status remains readable at narrow widths. Beginner telemetry shows flight state and height; the fire mission adds water and battery. Detailed data and debugging stay in secondary tools; logs begin collapsed. The existing developer road editor is disabled by ROAD_EDITOR_UI_ENABLED, not a shipped management workflow. Expanded logs reserve space above them for a scrollable telemetry region.

The current-command panel, Blockly highlight and projected drone/action label form one feedback system. Practice uses a visible 25 cm ground grid. Loading, empty, invalid-program, collision and water errors explain the next useful action. Result keeps score breakdown and offers retry/next mission. XML replacement is validated transactionally; old save keys remain unchanged.

## Do's and Don'ts

- Keep the world and the student's next action dominant.
- Keep explicit code/flight/result causality and Chinese action labels.
- Keep physics and score calculations behind their existing boundaries.
- Do not invent best-score history, achievements, cloud accounts or mission facts.
- Do not return logs and advanced telemetry to the beginner's main view.
- Do not mistake emulator screenshots for physical iPad or Safari testing.

Review evidence and limitations: docs/design/v2-qa.md. Independent finish review ended **ship** for the two scored findings: tablet controls were a confirmed false positive; practice feedback was strengthened and visually verified. This is a scoped visual verdict, not hardware certification.

Provenance: images/GLBs are pre-existing local assets, original notices retained; interface SVG paths are authored code. No new external image/model package. The first concept script call emitted nothing because of a symlink entry-point issue; key `9c3e13b0` was corroborated late on 2026-09-24. No approved raster comp or quality-bar board existed, and no retroactive pre-build design approval is claimed.
