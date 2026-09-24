# Mission 2 Behaviour Contract

Baseline: `e3f656d` on `main`, inspected 2026-09-24. Legacy remains the default. The v2 scene is a visual variant of `city`, not a new mission identity.

## World and player flow

Wildfire Response: launch → collect water → extinguish fires / recharge → land in the disaster area. Grid is 14×14, cell size 150 cm, offsets −1050 on X/Z, flat height 0. Cell values: 0 path, 1 obstacle, 2 launch, 3 goal, 4 fire, 5 water, 6 charge. The full grid is preserved in the legacy `createCityMap`; v2 has an independently frozen copy tested against it.

| Role | row,column | x,y,z (cm) |
|---|---|---|
| Launch | 1,1 | −825,14,−825; heading 180° |
| Goal | 1,12 | 825,0,−825 |
| Fire A | 2,12 | 825,0,−675 |
| Fire B | 4,10 | 525,0,−375 |
| Fire C | 11,5 | −225,0,675 |
| Fire D | 12,10 | 525,0,825 |
| Water | 1,4; 4,8; 9,7; 12,2 | −375,0,−825; 225,0,−375; 75,0,375; −675,0,825 |
| Charge | 3,5; 6,8; 10,7 | −225,0,−525; 225,0,−75; 75,0,525 |

## Actions, outcomes and score

- Water/fire interaction: nearest matching cell center at horizontal distance <95 cm; no height requirement. Collect and release each wait 2000 ms through the existing execution clock. One full tank per successful release.
- Initial battery 20 movement commands. Only `move_*` consumes capacity. Each charge station adds 15 once per reset, requiring hover ≥3 simulated seconds in its cell at Y 25–220 inclusive. Leaving resets unfinished hover credit.
- Timer starts while flying above ground +35 cm. Completion requires timer started, goal cell, not flying, relative altitude ≤120 cm. Four fires are optional for completion.
- Unique fire scores A/B/C/D = 200/150/125/100. All-fire bonus 200. Time tiers ≤240/360/480/600 seconds = 450/300/150/50, thereafter 0. Maximum intended score 1225.
- No timeout failure. Empty water/wrong location produces an action warning. No battery stops a requested movement. Collisions revert blocked horizontal axes to last safe position and set the existing collision flag.
- Grid collision samples center and ±15 cm cardinal points for cell value 1, at Y≤420; above 420 this check is skipped. The border consists of obstacle cells, not an added world clamp.
- Front/left/right sensors raycast the legacy `isWall` meshes, range 1000 cm, origin backed by 15 cm, missing-hit reading 500 cm. The invisible 150×400×150 obstacle boxes, original tree/rock shapes and charge-machine shapes must be retained for sensor parity. Bottom sensor reports absolute Y.
- Reset/retry restore spawn, heading, empty tank, 20 battery, fires, charge stations, scoring and timer; retain Flight Program as before.

## Preservation boundaries

No changes to `main.js`, `mission_rules.js`, `blockly_def.js`, flight execution, drone model/physics, reference answer, or Mission 1 builders. Preserve legacy builder functions and asset bytes. V2 owns its rendering configuration, geometry/materials, animations and temporary atmosphere. Decorative meshes never acquire `isWall`.

## Existing limitations, not fixes in this scene task

The reference fixture previously completed 3/4 fires (925 points within the first time tier), because its fourth water action misses the source. Release increments the fire count even for an already extinguished site, while score is deduplicated. High flight can bypass the forest grid. Do not silently change any of these behaviors.
