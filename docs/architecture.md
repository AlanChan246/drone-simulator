# 架構與日常維護

網站繼續直接載入 JavaScript；以 `npm start` 啟動，沒有新增編譯步驟。

## 素材清單

`js/asset_catalog.js` 是模型路徑與載入屬性的共同來源。瀏覽器透過 `AssetCatalog` 讀取，Service Worker 透過 `importScripts` 讀取，Node 驗證工具則使用同一份資料。

- `district`、`preload`、`roads`、`factory` 保留各載入器需要的順序、名稱和屬性。
- `supplemental` 列出額外貼圖、授權檔和待確認用途的資源；`retained-pending-review` 不代表可以直接刪除。
- `offline` 從上述資料產生去重清單；網頁、程式與其他靜態檔仍由 `sw.js` 管理。

新增模型時，更新對應清單及實際使用它的場景，並把模型引用的外部貼圖加入清單。`test/lifecycle-assets.test.cjs` 會檢查檔案存在、載入器使用的路徑及 GLB 外部依賴是否納入離線資源。更新發布內容時亦要更新 `sw.js` 的快取版本。

## 場景切換

`js/scene_lifecycle.js` 的 registry 管理切換次序；`js/simulator.js` 的 `simulatorSceneAdapters` 定義每個場景的 `preload`、`prepare`、`build`、`dispose` 及任務編號。

非同步 `enter` 先完成預載，才清理目前場景並建立下一個。預載失敗會保留原場景；被較新切換取代的預載不能提交。建立失敗會清理部分建立的場景，但不會自動重建上一個場景。`cancelPending` 用於離開選單流程；`enterSync` 只適合已具備所需資源的場景。

每個 adapter 負責自己的釋放 hook 與附帶 metadata。共用狀態清理由 `clearSceneContents` 負責，完成切換後再同步起點與介面。新增任務時應更新 adapter，而非在多處加入任務編號判斷。

## 執行、停止與收尾

`FlightCommandExecution.createSession()` 為每次執行提供識別。開始新執行或取消時，之前的識別失效。非同步操作必須在等待後或動畫更新前檢查識別，避免舊回呼改寫新執行。

一般任務的指令佇列與工廠解譯器共用 `flightProgramSession`，以 `finishFlightProgram` 收尾。停止、重設及切換場景會令舊執行失效；舊執行的 `finally` 不能清除新執行的狀態。新增等待行為時，使用 session 的 `wait`／`check`，並保留原有暫停、單步及計分規則。

## 驗證與輸出

執行 `npm test` 檢查行為合約，再以 `node scripts/verify-static-site.cjs` 驗證暫存網站包及實際 Service Worker 清單。涉及場景或執行流程時，啟動本機網站後執行 `node scripts/verify-factory-browser.cjs`；離線載入則使用 `node scripts/verify-factory-offline.cjs`。瀏覽器工具需要 Chrome 與 `promo/node_modules/playwright`。

日常瀏覽器、畫面及效能驗證透過 `scripts/qa-output.cjs`，每次建立獨立的 `test-results/<工具名稱>-<隨機字尾>/`，並印出位置。此目錄已加入 Git 忽略清單；可在不需要結果後刪除個別執行資料夾。它們不會覆寫 `audit/` 歷史證據或網站正式預覽圖。若要更新正式預覽，先檢視產出的圖片，再另外複製到網站素材位置。

歷史 hash 基準仍保留；這次修改的素材、場景及執行模組改由行為測試約束。測試涵蓋預載失敗、切換被取代、場景釋放、執行錯誤收尾、停止後重跑、舊動畫與取水等待回呼。瀏覽器回歸使用真實積木、飛行及計分，另檢查三個任務的存檔隔離。桌面 headless Chrome 的結果不等同實體平板驗證。
