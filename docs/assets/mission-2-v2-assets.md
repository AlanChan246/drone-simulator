# Mission 2 v2 asset register

Verified 2026-09-24. No new third-party downloads, GLB conversions or texture files were necessary. V2 uses four read-only Nature Kit templates already present in the repository, and original sensor geometry for compatibility. It creates private geometry and materials at runtime; no original asset file is modified. The environment's authored primitives and Canvas labels live under `js/scenes/mission2-v2/` rather than duplicating model binaries.

## Licence evidence

- Creator of all third-party models below: **Kenney**.
- [Nature Kit official source](https://kenney.nl/assets/nature-kit): CC0, version 1.0.
- [Factory Kit official source](https://kenney.nl/assets/factory-kit): CC0, version 3.0.
- [Survival Kit official source](https://kenney.nl/assets/survival-kit): CC0, version 2.0; retained by the existing preload, not used in the v2 visible environment.
- [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/): attribution is not required. This register nevertheless credits Kenney and retains source URLs. No endorsement is implied.
- Existing local provenance: `assets/models/kenney/README.md`. Original download archives/licence files for these older local copies were not present; this task verifies the official pack pages and records exact local file hashes, rather than claiming to have downloaded/verified a new archive.

## Visible external assets

All original and on-disk optimized formats are GLB (unchanged). Runtime optimization is instancing; materials are private low-cost matte materials. No textures, external mesh colliders or imported animations are used for these visible instances.

| Asset / local path below assets/models/kenney/ | Purpose | Source | Creator | Licence / attribution | Modifications |
|---|---|---|---|---|---|
| nature/tree_detailed.glb | Broadleaf woodland clusters | Nature Kit link above | Kenney | CC0 / none required | Private cloned geometry, instanced; olive foliage and brown trunk, normalized uniform scale |
| nature/tree_tall.glb | Narrow tree silhouette and outer woodland belt | Nature Kit | Kenney | CC0 / none required | Same private runtime recolor/instancing, varied rotation/size |
| nature/rock_largeA.glb | Rocks beside fire-damaged woodland | Nature Kit | Kenney | CC0 / none required | Private runtime stone/charcoal materials; uniform scale |
| nature/rock_largeB.glb | Outer landscape rock landmarks | Nature Kit | Kenney | CC0 / none required | Private runtime stone materials; uniform scale |

## Retained sensor-only assets

Each entry below is also by Kenney, CC0, with no required attribution. Original format = GLB; retained format = GLB, bytes unchanged. Purpose is exact compatibility with the original `isWall` mesh layout. Private scene copies are hidden and cloned for safe disposal; their vertex positions, material sides and transforms retain the Legacy sensor geometry. None are new visible clutter.

| Asset | Source | Runtime treatment |
|---|---|---|
| nature/tree_default.glb | Nature Kit | Hidden private sensor clone |
| nature/tree_detailed.glb | Nature Kit | Hidden private sensor clone in addition to visible instancing above |
| nature/tree_tall.glb | Nature Kit | Hidden private sensor clone in addition to visible instancing above |
| nature/tree_oak_dark.glb | Nature Kit | Hidden private sensor clone |
| nature/rock_largeA.glb | Nature Kit | Hidden private sensor clone |
| nature/rock_largeB.glb | Nature Kit | Hidden private sensor clone |
| nature/stump_old.glb | Nature Kit | Hidden private sensor clone |
| nature/campfire_logs.glb | Nature Kit | Hidden private sensor clone |
| factory/machine.glb | Factory Kit | Hidden private charging-machine sensor clone |
| factory/indicator-special-area.glb | Factory Kit | Hidden legacy charge assembly component, non-wall |
| factory/screen-panel-small.glb | Factory Kit | Hidden legacy charge assembly component, non-wall |
| factory/button-floor-round.glb | Factory Kit | Hidden legacy charge assembly component, non-wall |
| factory/warning-orange.glb | Factory Kit | Hidden legacy charge assembly component, non-wall |

Factory GLBs keep their existing sibling `Textures/colormap.png` dependencies. The original preload policy is unchanged; v2 does not add any network asset requests.

## Authored / reused local resources

| Resource | Purpose | Format and optimization | Provenance |
|---|---|---|---|
| Ground, trail, verges | Continuous woodland floor and unchanged navigation paths | Vertex-colored low-poly terrain; instanced boxes | Authored in environment.js; no external image |
| Ranger hut, shelters, tank, closed gate, rails, supply crates | Rescue staging, scale cues and road-access story | Shared primitive geometry/materials, instanced | Authored in environment.js |
| Landing pads, water points, recharge equipment | Contextual objective presentation | Shared low-poly primitives; independent charge material for reset state | Authored in environment.js |
| Burn patches, fallen branches, charred trunks | Fire response storytelling | Shared cylinder/rock primitives, instanced; remain after extinguishing | Authored in environment.js |
| Chinese place labels | Base, rescue, water, charging identifiers | Runtime Canvas 512×128 textures | Authored text/Canvas drawing in assets.js; no raster downloads |
| A–D labels and animated fire/smoke | Existing objective IDs and feedback | Existing local Canvas/sprite effects; v2 omits the four local point lights | `createFireSiteLabel`, `createForestFireEffects` in simulator.js, unchanged |
| Medical drone | Existing player airframe | Unchanged | Existing `medical_drone_model.js`, outside scope |

## Scale and budget

World units remain centimeters. Active cells are 150 cm. Paths are 124 cm wide, pads approximately 126 cm, water basins approximately 139 cm. Foreground service road 330 cm, ranger hut 300×340×250 cm, staging canopies 190 cm high, outer trees roughly 280–450 cm subject to width caps. The existing enlarged drone display is unchanged.

The v2-owned model/texture download payload is **0 bytes**, versus the proposed ≤5 MB ceiling. Four visible GLBs already in the shared preload total 54,524 bytes; only scene-local resources are added at runtime. GPU/render measurements and their device limitations are in `audit/mission-2-v2/README.md`. No 4K textures, reflection passes, expensive custom shaders or mesh physics colliders were introduced.

## Mission preview image

`assets/images/mission-preview-2-v2.png` is now an actual v2 renderer capture without UI overlays, shared by the mission selection card and mission briefing. Generated locally using the audit harness Export scene preview button; no external image or licence added. The previous PNG remains unchanged at `assets/images/mission-preview-2.png` (also archived under `audit/mission-2-v2/legacy-preview.png`). The service-worker cache version is advanced so installed clients refresh the shared image.
