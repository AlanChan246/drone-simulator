# Mission 3 — 天空機關城 / Sky Gate Protocol

## 開始遊玩

執行 `npm install`、`npm start`，打開 `http://127.0.0.1:8080` → 選擇任務 → 天空機關城。請透過 HTTP 開啟；瀏覽器不能從 `file://` 載入 GLB。正式入口、簡報、積木工具箱、錯誤回饋、重試及結算均已整合。

預設不載入答案。教師／QA 參考程式是 `test/fixtures/mission3-conditional.xml`，可用原有匯入功能開啟；包含距離感測迴圈、if/else、等待及無參數自訂行為。`scripts/mission3-fixtures.cjs` 產生相同 XML 與錯誤測試程式，不會載入學生頁面。

## 概念與學習目標

破解三道智能閘門，重啟天空基地。三道門都遵守「靠近 → 感測 → 判斷 → 發送 → 等門開 → 飛過」；第二段右轉並上升，第三段左轉再上升，最後降落核心平台。航線資料可展開查看，通訊邏輯由學生編寫。

高小學生可用 if/else 分別設定 A、B、C，逐段編寫飛行；初中學生可使用距離感測迴圈、變數及自訂行為，令同一程式可靠處理不同配置。沒有自動破解或自動飛往下一門積木。固定前進／轉向程式不能開門；固定頻道答案只適用部分配置，條件程式才可重用。

## 模式與重試

| 行為 | 標準 | 挑戰 |
|---|---|---|
| 場景與核心規則 | 相同三道門、相同航線 | 相同 |
| 訊號 | 固定 B / A / C | 六種 A/B/C 排列依配置版本輪替 |
| 開門時間 | 1.8 / 2.4 / 3 秒 | 2.4 / 3.6 / 4.8 秒輪替 |
| 倒數、電池、隨機障礙 | 無 | 無 |
| 提示／計分 | 相同 | 相同，重點是跨配置可靠性 |

「重試」或「重置」保留積木及完整配置，回到出發點；已開門狀態會復原。「新挑戰」保留積木並換下一組訊號和開門速度。切換模式會復原飛行。沒有中途 checkpoint，以免從程式中段恢復時感測器與變數狀態不一致。配置代號 S/C 顯示在狀態列，便於比較除錯前後結果。

## 閘門與完成規則

- A ●、B ▲、C ■ 同時使用字母、圖形及顏色，辨識不依賴聲音或色覺。
- 感測位置：目前目標門正面 190 cm 內、通道橫向 ±90 cm、相對平台高度 35–170 cm。距離感測結果以 0.01 cm 量化，避免浮點誤差令停止條件多飛一步。
- 設定頻道和發送訊號是兩個動作。訊號不符、未發送便通過、未開完便前進，都停止程式並指出原因。
- 狀態依序為 `locked`（待通訊）、`accepted`（開啟中）、`open`（可通過）、`completed`（已通過）。門扇向上收進門框，文字與動畫一起顯示狀態；開門後不突然關閉。
- 以每步移動線段判定穿越，避免大步長穿門。只有從正面、在開啟通道內按次序飛過才算通過；反向穿越、從門外繞過、飛越門頂均不計數。
- 三門完成後，在核心平台中心 85 cm 內降落，再執行「啟動天空基地」。飛抵終點或在空中啟動都不算完成。
- 成功後核心塔冠及導管亮起，天線運轉，再顯示結算。Reduced motion 保留必要門狀態變化，停止裝飾天線旋轉。

全程使用 cm。起點 `(-450,14,450)`、朝負 Z；三門中心為 `(-450,150)`、`(-50,50)`、`(50,-450)`，平台基準高度 0 / 80 / 160。核心降落位置為 `(50,174,-650)`。寬闊感測區與航線資料讓難度集中於程式判斷。

## Blockly 與執行回饋

| 類別 | 新增積木／重用功能 |
|---|---|
| 訊號 | 閘門要求的頻道、頻道 A/B/C、閘門頻道是 A/B/C？ |
| 動作 | 設定通訊頻道、發送通行訊號、啟動天空基地 |
| 狀態與等待 | 閘門已打開？、距離下一道閘門、等待直到 |
| 原有功能 | 起飛、降落、cm 移動、角度轉向、懸停、高度、記錄、if/else、重複、while/until、邏輯、算術、變數 |
| 進階重用 | 無參數、無回傳值自訂行為；不強迫使用 |

Run 時驗證並快照已連接的 Blockly 結構，之後逐塊非同步執行；條件和感測器在到達該積木時讀取，並非飛行前預算。執行積木高亮並移入可見區域，狀態列同步顯示無人機頻道、閘門進度、感測及發送回應。

暫停沿用「下一塊積木前停下」：已開始的動作／等待完成後停下，不會令開門等待互相鎖死。停止、重置及轉換任務會使舊執行 token 失效，防止舊起飛／降落動畫覆寫新任務。無限迴圈、空條件、無法成立的等待會有診斷；等待上限約 20 秒，單迴圈 200 次、總指令 600、總步數 2400、自訂行為深度 16。這些是程式安全界限，不是通關倒數。

## 計分與提示

成功共 600 分：三道門 300、基地重啟 200、可靠通訊 100。不按時間或積木數扣分。錯誤會停止本次執行，修正後重試可正常取得完整分數。結算會回應是否使用迴圈或自訂行為，但不另設複雜排名。

四層提示依次提醒感測區、條件分支、等開門及重用相同邏輯；不插入答案或代替學生修改積木。錯誤保留程式，指出要求／發送頻道、過早前進、航道或未完成目標的問題。

## 場景與介面架構

主要可見環境來自 Kenney Space Kit、Space Station Kit 的 14 個 CC0 GLB，正式模型合共 198,524 bytes。出發坪 → 第一六角門 → 右轉研究艙／能源設備 → 第二門 → 高台第三門 → 核心塔；遠景通訊島台和下方雲層提供高空感。平台、門框、門扇、塔身、研究模組及天線均為外部模型；CanvasTexture 僅用於標示、停機坪及雲 sprite 效果。

延伸既有 Flight Deck 暖紙色、深綠和橙色操作鍵。Mission 3 狀態列置於工作區上方，航線資料以 disclosure 收納；簡報維持三個短步驟，任務卡使用真實場景截圖。沒有改寫全站 DESIGN.md 或替換 Mission 1／2 的設計。跟隨、全景及俯視可切換；跟隨角度按航向調整，已完成的門標示讓出視野。

| 檔案 | 責任 |
|---|---|
| `js/mission3/config.js` | 航線、平台、門配置及模式資料 |
| `js/mission3/gates.js` | 純狀態規則、感測、穿越與啟動判定 |
| `js/mission3/runtime.js` | Blockly 結構驗證及有界即時直譯器 |
| `js/mission3/blocks.js` | 任務積木與工具箱 |
| `js/mission3/scene.js` | GLB 載入／重用／材質合併、光照、門與基地動畫 |
| `js/mission3/mission.js` | 模擬器接點、動作／停止／重試、計分 |
| `js/mission3/ui.js`、`assets/styles/mission3.css` | 簡報、狀態、提示、結算、響應式與主題 |
| `index.html`、`js/main.js`、`js/simulator.js`、`js/v2_ui.js` | 正式入口、獨立執行分支、場景／移動／相機接點 |
| `sw.js`、`.github/workflows/deploy-pages.yml` | 快取路徑與既有靜態打包依賴；本次未部署 |

Mission 1／2 繼續用原執行流程。規則／物理／原場景的既有 hash 合約保留，只排除新增 Sky hooks；shared file 的新基準另記在 `audit/mission-3/shared-integration-hashes.json`，原始基準檔未重寫。

## QA 與重現

2026-09-26，以本機 Chrome 真實 WebGL、Blockly 匯入及 Run 執行。瀏覽器 QA 使用受控時鐘加速動畫，沒有 teleport 或直接指定成功狀態。參考程式是真實的感測迴圈、if/else、自訂行為、等待及飛行動作。

| 檢查 | 結果／證據 |
|---|---|
| `npm test` | 48/48 通過，包括 9 個新增 Mission 3 測試；`audit/mission-3/unit-tests.txt` |
| `node scripts/verify-static-site.cjs` | 靜態打包與 192 個 offline shell 路徑；`audit/mission-3/static-site.txt` |
| `node scripts/verify-mission1-answer.cjs` | 原任務航線及目標通過；`audit/mission-3/mission1-route-check.json` |
| `node scripts/verify-mission3-browser.cjs` | 13 項流程；`audit/mission-3/browser-qa.json` |
| `node scripts/verify-mission3-offline.cjs` | 斷網重載、觸控、新挑戰、dark mode；`audit/mission-3/offline-touch-qa.json` |

瀏覽器腳本使用既有 promo workspace 的 Playwright；如未安裝，先於 `promo/` 執行 `npm ci`，並安裝可用的 Google Chrome。QA 需要 `npm start` 在 8080 提供頁面。

完整流程涵蓋：標準三門通關及 600 分、重試保留 XML／配置、錯頻道、未發送、太早前進、飛越繞門不能完成、等待診斷、三個不同挑戰配置通關、硬編碼頻道失敗、起飛中重置取消、開門等待暫停及恢復。純規則測試另外證明固定 BAC 只可通過六種挑戰中的一種。

同一瀏覽器由 Mission 3 切回 Mission 1，完成三個巡檢及終點降落；再完成 Mission 2 v2 四處滅火及終點降落，原有陰影／工具箱／計分流程正常。對應截圖為 `mission-1-regression.png`、`mission-2-regression.png`。

畫面檢查 1440×900、1280×800、1024×768、1180×820；無橫向溢出，Run／狀態列／畫布均在視窗內。另以 1180×820、DPR 2、touch/mobile、reduced motion 模擬平板，主要操作高 44–48 px。另確認跟隨／全景／俯視均包含無人機，以及鍵盤 Enter 可開關航線資料，見 `camera-keyboard-qa.json`、`overview-top.png`。離線證據使用未快取 URL 的 fetch 拒絕確認斷網；Chrome mobile 模擬下 `navigator.onLine` 仍回傳 true，沒有把該欄位當成功依據。

截圖位於 `audit/mission-3/`：任務選擇、簡報、出發、三門、核心塔、結算、錯誤、四個尺寸及平板離線／暗色。獨立 fresh default 視覺核驗為 **ship**，回報見 `visual-review.md`；此判斷只覆蓋指定截圖。主代理另外執行互動及最終驗證。機械設計掃描一次，`design-scan.json` 為 `[]`。

效能樣本（全景、DPR 1）：148 draw calls、21,187 triangles、103 geometries、16 textures。靜態物件按材質合併、重用模型、停用 Mission 3 即時陰影；離開時恢復原光照／陰影。沒有新增高解析貼圖。

## 真實限制

- 實體 Chromebook、iPad Safari 未測；平板尺寸、觸控、離線及 reduced motion 是 Chrome 模擬，效能數據不是最低規格硬體 FPS 保證。
- 舊場景初始化仍有 Three r128 對既有模型 UV metadata／材質 `flatShading` 的有限批次警告，沒有逐幀警告循環；本次不改舊關卡資產。新 Mission 3 模型已移除冗餘 UV metadata。完整流程無未捕捉例外、console error 或缺少資產。首頁影片離開時的 `ERR_ABORTED` 是媒體取消，獨立記錄。
- 自訂行為限無參數及無回傳；程式超出安全界限會收到訊息。沒有中途 checkpoint，也沒有新增外部音效。

## Model Selection 與交付範圍

2026-09-26 one-shot：建議 GPT-6 Astra / high、大型實作用量；系統可核實 GPT-6 身分，無法核實實際 variant 或 effort。依使用者授權不等待 Gate 批准。[模型參考](https://developers.openai.com/api/docs/models/gpt-6-astra)。

共 4 個 fresh default 子代理：runtime 接點探索、simulator 接點探索、官方資產查證、獨立截圖核驗；全部唯讀且單輪。主代理負責完整方案、程式修改、整合、試玩及最終驗證。

在 `codex/mission-3-primary-school` 建立 local commits。原有 `.DS_Store` 修改保留、不納入提交。沒有 push、PR 或部署。外部資產逐項來源、作者、格式、授權、修改及用途見 [資產文件](../assets/mission-3-assets.md)。
