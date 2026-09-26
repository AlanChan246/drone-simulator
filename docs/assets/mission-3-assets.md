# Mission 3 素材來源與授權

下載／核驗日期：2026-09-26。所有模型為原作者授權資產；只提交場景實際使用的子集。主要場景不是 Three.js primitives。

## 外部素材

| Asset / pack | Creator | Source / licence | Usage |
|---|---|---|---|
| city-kit-industrial | Kenney | [Original source](https://kenney.nl/assets/city-kit-industrial) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 港口倉庫、貨櫃、基地太陽能、山區風力設備 |
| city-kit-commercial | Kenney | [Original source](https://kenney.nl/assets/city-kit-commercial) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 城鎮商用樓、避難中心與醫療中心 |
| nature-kit | Kenney | [Original source](https://kenney.nl/assets/nature-kit) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 海岸岩石、山體、草地、松林、城鎮樹木 |
| car-kit | Kenney | [Original source](https://kenney.nl/assets/car-kit) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 救護車、消防救援車、交通錐 |
| watercraft-kit | Kenney | [Original source](https://kenney.nl/assets/watercraft-kit) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 貨船、拖船 |
| Crane | J-Toastie | [Original source](https://poly.pizza/m/gCcpjaxFdv) · [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 港口吊機 |
| Transmission Tower | iPoly3D | [Original source](https://poly.pizza/m/Xfb0lAPvnh) · [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 基地及山區通訊／能源塔 |

CC BY attribution: **Crane by J-Toastie**, https://poly.pizza/m/gCcpjaxFdv, licensed under CC BY 3.0. Runtime scale and orientation adjusted. Attribution also appears in the Mission 3 briefing. CC0 credits are voluntary and retained.

## 格式與修改

- Original format: GLB/glTF 2.0. Final format: GLB unchanged. No third-party model conversion or destructive mesh edits.
- Runtime: normalization, scale, position and rotation. Static geometry is instanced with scene-owned copies; original template resources are not disposed during scene switches.
- Medical Centre uses a real commercial building model with an authored H landing marker, ambulance, emergency tent and generator. It is not claimed to be an original hospital model.
- Markers, text labels, water surface, rain, cloud sprites and light pools are runtime graphics; all principal buildings, vehicles, equipment, vegetation and terrain are model assets.
- Licence files are retained beside each downloaded pack; per-file sizes and SHA-256 checksums are in `assets/models/mission3/manifest.json`.

## Reused repository assets

| Model | Author / source | Licence evidence | Usage |
|---|---|---|---|
| `factory/machine.glb`, `screen-panel-small.glb` | [Kenney Factory Kit](https://kenney.nl/assets/factory-kit) | CC0; downloaded pack notice at `assets/models/mission3/licences/factory-kit.txt` | Relay family, command screen, generator and charging equipment |
| `survival/tent.glb`, `structure-metal-floor.glb` | [Kenney Survival Kit](https://kenney.nl/assets/survival-kit) | CC0; `licences/survival-kit.txt` | Base camp, medical tent, drone and relay platforms |
| `flood/suburban/building-type-a.glb` | [Kenney City Kit Suburban](https://kenney.nl/assets/city-kit-suburban) | CC0; `licences/city-kit-suburban.txt` | Houses |
| `starter-city/models/road-straight-lightposts.glb`, `road-intersection.glb` | [Kenney Starter Kit City Builder](https://github.com/KenneyNL/Starter-Kit-City-Builder) | Retained upstream README identifies models as CC0; repository code MIT notice also retained | Roads and street lighting |

Existing source files are reused in place and have not been deleted or modified.

## Selected file inventory

| Model | Bytes |
|---|---|
| `city-kit-industrial/building-a.glb` | 177,316 |
| `city-kit-industrial/building-j.glb` | 80,792 |
| `city-kit-industrial/shipping-container-a.glb` | 36,624 |
| `city-kit-industrial/solar-panel-landscape.glb` | 21,776 |
| `city-kit-industrial/windmill.glb` | 46,292 |
| `city-kit-commercial/building-a.glb` | 108,936 |
| `city-kit-commercial/building-c.glb` | 102,788 |
| `city-kit-commercial/building-f.glb` | 148,952 |
| `nature-kit/rock_largeA.glb` | 7,552 |
| `nature-kit/tree_pineTallA_detailed.glb` | 10,708 |
| `nature-kit/tree_oak.glb` | 14,644 |
| `nature-kit/ground_grass.glb` | 1,576 |
| `car-kit/ambulance.glb` | 233,612 |
| `car-kit/firetruck.glb` | 232,448 |
| `car-kit/cone.glb` | 16,696 |
| `watercraft-kit/ship-cargo-a.glb` | 98,052 |
| `watercraft-kit/boat-tug-a.glb` | 41,036 |
| `poly-pizza/crane.glb` | 542,664 |
| `poly-pizza/tower.glb` | 177,120 |

Total new GLB payload: **2,099,584 bytes** across 19 selected models, excluding the small colormap textures.

## Preview provenance

`assets/images/mission-preview-3.png` is a screenshot of this project’s actual Three.js Mission 3 scene, captured by `scripts/mission3-browser-qa.cjs`. It is not an AI illustration. Screenshot evidence in `audit/mission-3/` uses the same scene and the same credited assets.
