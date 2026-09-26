# Mission 3 外部資產與授權

所有正式模型與紋理均在專案內；不 runtime hotlink。下載日期：2026-09-26。

## 來源與授權

| Pack | 作者與官方來源 | 版本 / 原始格式 | 授權 | Attribution |
|---|---|---|---|---|
| Space Kit | [Kenney](https://kenney.nl/assets/space-kit) | 2.0；選用 GLB（包內亦有 DAE、FBX、OBJ、STL） | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 不強制；本文件自願致謝 |
| Space Station Kit | [Kenney](https://kenney.nl/assets/space-station-kit) | 1.0；選用 GLB + PNG（包內亦有 FBX、OBJ） | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 不強制；本文件自願致謝 |

官方原始 ZIP：

- [Space Kit](https://kenney.nl/media/pages/assets/space-kit/20874c75ac-1677698978/kenney_space-kit.zip)（6,677,531 bytes）
- [Space Station Kit](https://kenney.nl/media/pages/assets/space-station-kit/6475288f2e-1712749919/kenney_space-station-kit.zip)（1,835,875 bytes）

原始 licence notices 分別保留在 `assets/models/kenney/sky-city/space/License.txt` 與 `station/License.txt`。下表全為 Kenney、CC0、無強制署名，原始格式 GLB。

## 每個使用模型

共同修改：只在場景中置中、縮放、旋轉和重用；不重新建模，不增添主要 primitive 建築。靜態模型依材質與屬性合併，動態門扇／天線維持獨立。Space Kit GLB 原檔保留；Space Station Kit 移除多餘的 `KHR_texture_transform: {texCoord: 0}` metadata（UV0 本來就是預設，不改變外觀），避免 Three r128 無意義 warning。導管在成功時複製材質再調整 emissive。

| Asset name | Local path | Bytes | Source triangles | Mission 3 用途 |
|---|---|---:|---:|---|
| gate_complex | `assets/models/kenney/sky-city/space/gate_complex.glb` | 29,912 | 460 | 三道六角門框 |
| hangar_roundGlass | `assets/models/kenney/sky-city/space/hangar_roundGlass.glb` | 10,076 | 113 | 玻璃研究艙及塔冠 |
| machine_generatorLarge | `assets/models/kenney/sky-city/space/machine_generatorLarge.glb` | 10,220 | 126 | 第二區能源設備 |
| machine_wireless | `assets/models/kenney/sky-city/space/machine_wireless.glb` | 13,420 | 174 | 通訊天線 |
| pipe_straight | `assets/models/kenney/sky-city/space/pipe_straight.glb` | 6,492 | 80 | 啟動時亮起的導管 |
| platform_large | `assets/models/kenney/sky-city/space/platform_large.glb` | 6,272 | 76 | 主航線七塊平台及遠景島台 |
| platform_low | `assets/models/kenney/sky-city/space/platform_low.glb` | 10,828 | 156 | 平台下方的懸浮機械結構 |
| satelliteDish | `assets/models/kenney/sky-city/space/satelliteDish.glb` | 19,528 | 274 | 遠景通訊站天線 |
| satelliteDish_large | `assets/models/kenney/sky-city/space/satelliteDish_large.glb` | 13,948 | 186 | 核心塔可旋轉天線 |
| structure_closed | `assets/models/kenney/sky-city/space/structure_closed.glb` | 15,604 | 264 | 中央控制塔實心塔身 |
| structure_detailed | `assets/models/kenney/sky-city/space/structure_detailed.glb` | 13,944 | 232 | 遠景研究站骨架 |
| computer-wide | `assets/models/kenney/sky-city/station/computer-wide.glb` | 17,076 | 174 | 第二區研究終端 |
| door-double-closed | `assets/models/kenney/sky-city/station/door-double-closed.glb` | 6,924 | 52 | 可升起的閘門門扇 |
| table-display | `assets/models/kenney/sky-city/station/table-display.glb` | 24,280 | 240 | 核心區控制桌 |

## 紋理、場景標示與預覽

- `assets/models/kenney/sky-city/station/Textures/colormap.png`：Kenney Space Station Kit 原始 PNG 像素、CC0；只新增來源 metadata，無視覺改動；所有 Station 模型共用同一張小型色盤，無高解析貼圖。
- `assets/images/mission-preview-3.jpg`：本專案 Mission 3 實際 WebGL 畫面截圖；使用上列 CC0 模型。由本次實作產生，不是外部概念圖。
- 門號、頻道圖形、停機坪文字以 CanvasTexture 標示；雲層是輕量 sprite 特效。這些是 UI／效果，不是主要場景結構。
- 無新增外部音效；靜音可完整遊玩。無 AI 生成模型或模型熱連結。

## 優化與證據

正式選集 14 個 GLB、合共 198,524 bytes（約 193.9 KiB）。原始整套 ZIP、未使用格式及未使用模型不隨應用交付。

`audit/mission-3/assets-manifest.json` 記錄各檔案 SHA-256、bytes 及原始三角形數。實例化後的實際 draw calls／triangles／memory 見 `audit/mission-3/browser-qa.json`。Mission 3 關閉實時陰影，離開時恢復原設定；模型從本機載入並加入 service worker shell，靜態 Pages 打包測試涵蓋所有新增路徑。
