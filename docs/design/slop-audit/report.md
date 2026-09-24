# 完整 Catalog Audit 與修正報告

2026-09-24 · Drone Simulator · 本機修正，未部署。

[67 項核對表](checklist.md) 逐項記錄方法、證據和狀態；[catalog.json](catalog.json) 保留官方 ID、擷取時間及來源雜湊。初始待檢查表在改碼前建立，保存於 [checklist-before.md](checklist-before.md)。本次沒有新增或修改 detector ignore 規則。

## 方法與範圍

- 官方來源：https://impeccable.style/slop/，共 49 source、12 browser、6 設計評審項目。
- source：官方 `impeccable@4.1.0` CLI 掃描 `index.html assets/styles/`，before/after JSON 完整保留。另人工檢查動態模板 `js/v2_ui.js`、Blockly XML、字體、配色、隱藏狀態及動作；vendor 生成 SVG／WebGL 不能只靠 HTML source 判斷。
- browser：官方 4.1.0 URL detector 在 1440×900、1024×768、390×844 執行 before/after；另用 skill 隨附 3.6.1 browser runtime 在操作後掃描，搭配 DOM snapshot、console errors、截圖和人工視覺檢查。1280×800 追加筆電並排檢查。
- 3.6.1 registry 只有 59 項 detector，缺 `organic-clip-path` 和 `buried-raster`；由 4.1.0 source 加人工查核補足。沒有聲稱 4.1.0 的所有規則都在每個互動狀態執行。
- 初次 bundled source detector 缺 htmlparser2/css-select/css-tree/domutils，降級輸出保存於 source-before；其結果只作定位，不作 computed-style 通過證據。後續 4.1.0 完整 source 掃描無該降級。
- runtime 會把幕後/inert 或縮成 1px 的非當前視圖列入報告，因此逐一結合可見畫面判讀。QA server 只在 `?audit=1` 注入掃描工具；截圖右下角 Scan complete 是測試工具，未寫入產品。

本站沒有公開搜尋或管理後台。公開流程對應首頁、任務選擇和簡報；本機管理對應積木儲存、匯入、匯出、逐步執行和紀錄。道路編輯原有 `ROAD_EDITOR_UI_ENABLED=false`，不適用；沒有為湊覆蓋而新增功能。

## 獨立設計評審與 source 檢查

兩個獨立唯讀子代理各自完成一輪，主代理負責取捨、改碼及最後驗證：

- `/root/slop_design_review`：先看畫面，不讀 detector 結果。桌面與手機實際進入首頁、任務、簡報、自由練習。六個主觀 catalog 項逐項判斷：無玻璃化、過度圓角、手繪 SVG、單字體、hero 虛構指標；兩張任務卡有比較用途。Nielsen 原始評分 31/40，指出 11 分類初學負擔及手機 code/world 切換說明不足。
- `/root/slop_source_detector`：定位小字、9.1667px HUD 繼承字級、未使用 Inter、canvas 字面顏色及設計文件漏列既有尺度。同時指出 bundled 工具降級，不把掃描無命中當作完成。

主代理查核後：手機執行本來已有自動切換 world，沒有移除或重寫此行為；補上轉向提示的具體說明。使用者已明確授權修正和 polish，因此評審後直接完成修正，沒有再次要求改善授權。

## 已修正

1. 說明、caption、紀錄由 11/12px 提至 13px；HUD camera 從 9.1667px 明確設為 13px。收斂零散字級，更新 DESIGN 的既有字體分工與尺寸用途。
2. 1100px 以下不再隱藏保存狀態，因此成功／失敗文字仍可見。
3. 展開飛行紀錄時，HUD 根據實際紀錄高度上移；ResizeObserver 處理紀錄增長，詳細數據可以滾動。
4. 分類預設僅顯示事件、飛行指令、進階積木；原有類別和積木仍可展開。實際發現 Blockly 未替初始收合群組寫 display:none，補上只作用於子群組的 CSS，並驗證展開／收合。
5. 手機 debug 控制換行、工具選單可滾動、空白程式提示限制寬度。
6. 手機轉向提示成為具名 dialog，焦點移入、Tab 不離開，背景 inert；關閉後回到目前工作區切換按鈕。
7. skip link 依目前可見畫面聚焦真正主內容；簡報規則 h4 改 h3；圖例 Unicode 裝飾換成一致 SVG。
8. 移除未使用 Inter 請求，canvas／遮罩／拖曳端點改用既有設計用途的 tokens。
9. 最後 polish 發現手機教學卡遮住上方積木，移到較下方並加入高度上限及滾動；保留 [修正前](evidence/polish-before-mobile-tutorial.jpg) 和 [修正後](evidence/after-mobile-tutorial.jpg)。

## 狀態覆蓋

每個 `after-*.json` 含 viewport、完整 findings、DOM snapshot 與 error logs；同名 JPG 為實際畫面。不是所有狀態與尺寸的笛卡兒積。

| 視窗 | 已操作／記錄狀態 | 代表證據 |
|---|---|---|
| 1440×900 桌面 | 首頁、兩任務選擇、街區簡報、展開規則、XML 匯入確認／完成、執行、任務結果、重試、匯出、教學 | [結果](evidence/after-desktop-result.json)、[匯入](evidence/after-desktop-import-confirm.jpg) |
| 1024×768 平板橫向 | 首頁、空積木、進階分類展開／收合、空程式錯誤、示範程式、更多工具、詳細數據＋紀錄、暫停、單步、停止、重置 | [HUD＋紀錄](evidence/after-tablet-telemetry-log.jpg)、[暫停](evidence/after-tablet-paused.json) |
| 390×844 手機直向 | 首頁、任務選擇、山火簡報／規則、轉向提示、code/world、debug 控制、示範執行／結束、結果、教學 | [轉向](evidence/after-mobile-orientation.json)、[結果](evidence/after-mobile-result.jpg)、[控制](evidence/after-mobile-world-debug.jpg) |
| 1280×800 筆電 | 重載後保存程式恢復、並排 Blockly／飛行場景 | [並排](evidence/after-laptop-split.jpg) |

街區 `tunnel-direct.xml` 實際飛完：9 條飛行指令、20 秒、抵達終點，700 分；結果顯示剩餘 3 處巡檢建議。自由練習實際起飛、前進50cm、降落。匯出產物 `drone-blockly-mission-1.xml` 在下載目錄核實，XML解析48個元素／10個block；瀏覽器 download event 未捕捉到，但檔案及頁面成功紀錄均存在。重新載入後自由練習的積木恢復，未靠修改 runtime state 假造結果。

基線某些手機截圖原命名是預期操作，實際仍為轉向遮罩；已更名為 orientation-transition／orientation-overlay，沒有把它們當作 code/world 覆蓋。

## Detector 結果的判讀

- 完整 source：before 57 findings，after 1 advisory。剩餘為 skip-link 的黑色 fallback；實際 computed 是 `rgb(23,59,55)`，與 token 一致。[執行樣式證據](evidence/manual-runtime.json)。
- 官方 URL 三種尺寸 after 各 1 `cream-palette`；有意保留暖紙色，符合現場教學方向，不新增忽略規則。
- 互動 browser 還會報 Blockly `side-tab`：有功能意義的分類色條，保留文字標籤輔助。
- code-only 模式報 `clipped-overflow-container`：非當前 world 被收起且 inert，切 world 即恢復；不是漏掉一塊可操作內容。
- collapsed log 的 `text-overflow`：單行摘要刻意省略，展開後完整內容可讀。modal 幕後相同報告不是可見遮擋。
- 降低 findings 的部分原因是 DESIGN 原先只機讀宣告15px body，補齊已存在的階層；這不等於那些項目全是產品修正。實際小字、遮擋及隱藏狀態另有 before/after 證據。

## 技術 Audit（0–4）

| 面向 | 分數 | 證據與限制 |
|---|---|---|
| Accessibility | 3 | 明確 dialog、Tab trap、inert、skip link、13px輔助字、具名icon buttons、reduce-motion CSS。Blockly分類40px，未作實機觸控／完整讀屏驗證。 |
| Performance | 3 | 移除無用字體；新增ResizeObserver限於console，不新增大型依賴；保留原模擬與render架構。未量測實機FPS／電池／網路節流。 |
| Theming | 3 | active CSS集中tokens，字體／尺寸／半徑有用途；Blockly/vendor和3D場景顏色是獨立語義系統，未假稱全程token化。 |
| Responsive | 3 | 1440、1280、1024、390實際瀏覽器操作；修正HUD遮擋／控制換行／保存狀態／教學浮卡。沒有實體iPad Safari或觸控測試。 |
| Design integrity | 3 | 六項獨立評審、兩任務真實內容、沒有虛構指標，61個detector項逐項人工判讀。進階工具仍適合逐步引導。 |

合計15/20是本次證據下的評估，不是認證；未為了拿滿分擴大結論。

## 回歸與未覆蓋邊界

- `npm test`：17/17 通過，含舊街區／山火 XML 生成、非法匯入保持原積木、場景生命週期、offline與Pages子路徑。
- `node scripts/verify-static-site.cjs`：161 offline entries 通過，未部署。
- `node --check` 三個變更 JS 與 `git diff --check` 通過。
- 各記錄狀態 console error logs 為空；主代理另看畫面及操作結果，未以此取代67項覆蓋。
- 山火本次驗證簡報／規則及既有68指令回歸測試，未再跑完整山火路線。WebGL unavailable、儲存配額失敗、斷網、每種碰撞／timeout沒有再次故障注入；小字和錯誤訊息樣式共用，不等於全部故障分支已實測。
- 實體手機／iPad觸控、Safari、讀屏、低階硬件FPS仍需裝置驗收。

最終變更保留任務規則、physics及儲存格式；沒有把沒有測到的項目寫成通過。

修正程式 checkpoint：`44dfd9b`。完整互動證據主要對應 slop-20260924d；最後 e 版只再調整手機教學卡位置及資源版本，已重拍教學並重跑 source／三尺寸 URL detector。測試用 server 和分頁已關閉。
