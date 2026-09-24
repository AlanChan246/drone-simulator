# Mission 1 素材紀錄

本次 quality pass 沒有下載或加入第三方素材；沒有修改 GLB、貼圖檔案或無人機模型。

| 名稱 | 來源／作者 | 授權證據 | 用途與修改 | 實際使用檔案 |
|---|---|---|---|---|
| Starter Kit City Builder | Kenney；既有來源 https://github.com/KenneyNL/Starter-Kit-City-Builder | 本機 UPSTREAM-README.md 第 70 行註明美術資產 CC0；LICENSE.md 的 MIT 適用程式碼，不混為一談 | 保留建築、樹群、噴水池、位置、尺寸、感測幾何；在既有光照下改善表現 | assets/models/kenney/starter-city/models/*.glb；既有 colormap.png |
| City Kit Commercial | 既有 Kenney 目錄 | 本次未下載；該舊目錄沒有附本機 licence 檔，不補造來源證明 | 保留四款既有樓宇及碰撞／感測形狀 | assets/models/kenney_city-kit-commercial_2.1/Models/GLB format/building-{g,c,skyscraper-a,skyscraper-b}.glb |
| City Kit Roads | 既有 Kenney 目錄 | 本次未下載；該舊目錄沒有附本機 licence 檔，不補造來源證明 | 保留五種路片、路地塊、方向、寬度及貼圖 | assets/models/kenney_city-kit-roads/Models/GLB format/road-*.glb |
| 起降標線與站牌 | 本專案原創 Canvas 繪製 | 無第三方素材 | ALPHA／BRAVO，各兩張 256px CanvasTexture；材質使用 sRGB encoding | js/simulator.js：polishMission1Environment |
| 通訊箱、掃描器、環境感測器、接應棚、路障、花槽及維修痕跡 | 本專案原創幾何 | 無第三方素材 | 同色合併 InstancedMesh；無碰撞、無感測、無額外投影光；按現有縮尺城市比例製作 | 同上 |
| 地面 | 本專案原創頂點色 | 無第三方素材 | 保留 3600×3600 footprint，24×24 細分、低對比草地色差，無新增圖片貼圖 | 同上 |

第三方署名與本機既有通知全部保留。沒有使用付費、授權不清的新模型。既有兩個舊 Kenney 目錄的授權證據缺口記錄在此，不宣稱本輪已重新審核其上游授權。
