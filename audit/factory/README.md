# Mission 3 驗收紀錄

2026-09-27（香港時間）。本機完成，未推送、部署或發布。既有未提交變更與舊天空城任務的刪除狀態保留。

## 驗證結果

- `npm test`：**53/53 通過**，包含原有39項測試及14項工廠測試。完整輸出：[unit-results.txt](unit-results.txt)。
- 真實Chrome瀏覽器：**46項檢查通過，0個頁面／本機資源錯誤**。[browser-results.json](browser-results.json)。實際匯入Blockly XML、按Run、執行相對飛行與夾取／維修／交付、在出貨平台降落。沒有直接改進度、瞬移或呼叫成功函式。
- 同一份條件／迴圈程式解三張不同訂單（seed 0、1、2），均800分，涵蓋6／9／12個模擬秒維修。單元測試另解全部20種三正常／三故障排列。
- 複製六次的程式能完成並收到迴圈建議；固定寫死初始次序的程式在換訂單後失敗；只有飛行／降落的程式不完成且0分。
- 錯誤站別、未修好取回、正常料送修、故障料直交、重複啟動、空夾具放下、同一ID重複交付、範圍／高度限制均有規則測試。錯誤訊息保留現場並選取相關積木。
- 瀏覽器確認重試保留訂單、換訂單保留程式；飛行中停止及重設、取件Promise中重設、維修中重設、等待中停止均無殘留更新。維修等待期間要求暫停，機器先完成，下一塊前暫停；單步可取回零件。
- 瀏覽器載入實際模型後驗證：所有標線航道在0–180cm高度範圍內，均有至少3m寬淨空；整段移動使用掃掠碰撞檢查。裝飾不參與距離感測。
- 在同一個瀏覽器切回舊任務：Mission 1完成3個巡檢、降落結算1000分；Mission 2完成4個火點、降落結算1225分。再切回工廠，程式從獨立儲存鍵還原。
- 首次成功載入後，離線重新整理可載入場景、全部50個GLB及Blockly；缺少模型時顯示失敗，按重新載入後恢復正式模型。[offline-results.json](offline-results.json)。本機通常停用自動SW註冊，測試在獨立瀏覽器設定檔中明確註冊正式Service Worker。
- 靜態網站打包及**232個離線資源**核對通過：[static-site-results.txt](static-site-results.txt)。沒有改用刪除舊測試或放寬原有邏輯合約取得通過。舊檔案雜湊檢查只排除17條精確登記的工廠接點，接點清單本身亦有固定雜湊測試。

## 畫面

桌面1440×900、筆電1280×800、橫向平板1024×768，均檢查light／dark主題與簡報。主要操作按鈕在視窗內，操作台中央未被HUD遮蔽；平板可切換專心編程或觀察飛行。

- [任務選擇](mission-selection.png)、[全景](final-overview.png)、[起飛基地](base.png)
- [取件](pickup.png)、[維修](repair.png)、[裝配](assembly.png)、[出貨](dispatch.png)、[800分結算](result.png)
- [1440淺色](layout-1440x900-light.png)、[1440深色](layout-1440x900-dark.png)
- [1280淺色](layout-1280x800-light.png)、[1280深色](layout-1280x800-dark.png)
- [1024淺色](layout-1024x768-light.png)、[1024深色](layout-1024x768-dark.png)
- [平板簡報](briefing-1024x768-light.png)、[平板深色簡報](briefing-1024x768-dark.png)、[離線畫面](offline.png)

機械式介面檢查輸出為空陣列：[design-detection.json](design-detection.json)。該工具缺少HTML解析依賴，降級為regex，**沒有進行computed contrast檢查**；另以實際截圖和瀏覽器操作檢查版面。沒有把這項降級結果當作完整無障礙認證。

## 素材與效能

- 50個GLB：1,974,140 bytes。
- 新增模型＋兩張貼圖：**1,997,939 bytes**（約1.91MiB），連三份授權檔共1,999,957 bytes，低於12MB目標。
- 新瀏覽器設定檔實際工廠素材transfer：**2,013,539 bytes**，含Resource Timing計入的傳輸開銷。93筆請求紀錄對應52個獨立模型／貼圖URL，重複貼圖引用由瀏覽器快取供應；累計encodedBodySize為2,484,175 bytes，不把這個重複引用合計誤作素材包大小。
- 全景、1440×900、真實時鐘6秒採樣：**188 draw calls、43,502 triangles**；平均每幀16.62ms，p95為16.70ms，約60fps。
- 測試環境：macOS Darwin 27.2.0／arm64、Apple M5、Chrome 152.0.7977.83 headless，ANGLE Metal。資料：[performance.json](performance.json)。

通關測試使用Playwright虛擬時鐘推進真實動畫和計時器，以縮短多張訂單驗證時間；上述效能資料另以真實時鐘測量。沒有測試實體Chromebook、iPad、Safari或觸控手勢，尺寸模擬不代表這些實機效能。低階設備效能仍需教師在實際教室裝置確認。

## 範圍與限制

第一版函式只接受無參數、無回傳值；不支援完整Scratch VM或 `.sb3`。碰撞使用保守AABB及無人機半徑；精細模型間縫隙不代表可飛通道。等待診斷60模擬秒、1000輪迴圈／10000步及16層函式限制是除錯保護，不影響正常參考程式。

訂單在一次任務中固定，重試保持；重新進入任務回到初始訂單，學生程式會自動還原。教師XML屬教材，不會由應用程式預載入工作區。

玩法與Scratch對照：[教師說明](../../docs/missions/factory.md)。素材作者、CC0來源與修改：[素材說明](../../docs/assets/factory-assets.md)，[逐檔SHA-256清單](assets-manifest.json)。

## 視角撕裂及工具列修正

移除觀察模式下重複的航線提示列；分層提示與訂單資料移入任務說明，「換一張訂單」直接放在場景視窗右上角，結算入口保留。

以滑鼠實際拖動視角重現道路白色斜紋。關閉陰影仍會重現；原因為近平面1cm時，遠處幾個相近地面層的深度精度不足。工廠近平面改為10cm，地面／標線／停機坪使用明確的polygon offset與渲染順序，批次繪製保留順序。離開工廠還原相機近平面，不改碰撞或任務規則。

`node scripts/verify-factory-rendering.cjs` 比較12組視角的實際道路像素與同角度高精度參考。修正前最大干擾約46%；修正後每組低於0.04%（僅少量邊緣像素差異）。另確認場景右上按鈕可換訂單、任務說明保留提示、切回 Mission 1 隱藏工廠專屬選項，回自由練習還原近平面。

[修正前量測](rendering-before.json)、[修正後量測](rendering-results.json)、[轉動視角](rotation-after.png)、[移除提示列後介面](toolbar-after.png)。


### Mission 1、2 旋轉視角修正（2026-09-27）

在 Chrome 實際滑鼠拖動，再以每個任務 12 組角度比較相同畫面與高深度精度參考。原本 1 cm 近平面使薄地面層產生深度干擾；只提高至 10 cm 即消除大片閃紋，沒有改動路線、碰撞或任務規則。每個場景離開時還原原始相機值。

`node scripts/verify-legacy-rendering.cjs`：24 組通過。修正前 Mission 1 最多 2.584%、Mission 2 最多 0.738% 的視窗像素偏離參考；修正後分別低於 0.060%、0.011%。剩餘差異包含模型邊緣與透明效果，這是深度比較指標，不等於所有差異都是撕裂。原始和修正結果見 `legacy-rendering-before.json` / `legacy-rendering-after.json`，畫面見 `mission1-rotation-after.png`、`mission2-rotation-after.png`。自由練習還原至原近平面亦通過。

換訂單按鈕在場景右上角常駐，隨任務隱藏、執行中停用；與狀態卡預留獨立空間。排版檢查包括 1440×900、1280×800、1024×768，深淺主題。測試是桌面 Chrome，不是實體平板。
