# Mission 3 — 暴風島能源重啟

## Primary School Design

香港小學生的主線只有一句話：**飛去每個能源站，先掃描，關了就重新啟動。** 三站完成後，返回基地降落。學習順序是 Scan → Decide → Act → Repeat；Mission 1 / 2 保留原有行為。

### Before → after

| 範圍 | 原本負擔 | 現在主流程 |
| --- | --- | --- |
| Briefing | 規則、風暴、電量、編程提示同時出現 | 一句故事、一句任務、三個圖示、返回降落 |
| Blockly | 34 塊、計數變數、數值比較、兩個等待迴圈 | 11 塊：Repeat 3 + 一個 IF + 狀態感測 |
| Relay | 技術狀態名稱 | 先掃描；掃描後只分「正常／需要啟動」 |
| Storm | 三個等級、隨機相位、累積暴露失敗 | 安全／危險，固定週期，導航可等候 |
| Backup | 600 秒倒數及失敗 | 普通模式不倒數、不因此失敗 |
| HUD | 風暴數值、備電、多站清單、遙測 | 站數、山區風暴、一個目前目標、短回饋 |
| Hints | 固定答案階梯與變數要求 | 到站、掃描、判斷、重複、風暴、重試時才提示 |
| Result | 七項技術統計及效率分 | 三站亮起、安全、時間；以文字肯定 IF 和 Repeat |

### Main student flow

1. 起飛。
2. **重複 3 次**：前往下一站 → 掃描 → **如果「能源站需要啟動？」便啟動**。
3. 返回基地，降落。

[主答案 XML](../answers/mission-3-primary.xml) 可從工具列匯入；測試 fixture 是相同內容。主答案沒有變數、數學比較、巢狀 IF、巢狀迴圈或等待秒數。正常能源站也必須掃描，不能只用方向積木飛回基地完成。

「前往下一站」每次只導航至 A、B、C 中下一站，並在山區危險時先於山外等候。它**不會掃描、判斷能源站或啟動**，也不會一次走完三站。自動等候是降低導航負擔的支援，不能算作學生自己寫了風暴判斷。學生仍須自己寫狀態感測、IF 與 Repeat；工具提示明示這個分工。

普通工具箱有「飛行、能源站、如果、重複」四個核心分類，另有預設收合的「進一步」。完整答案沒有在學生初始介面自動展示。Briefing 不講 programming theory；素材授權藏於可展開的鳴謝，仍保留作者連結。

### Hints and recovery

- 先嘗試啟動但未掃描：提示「先掃描，看看能源站是不是關了」。
- 掃描後：先問哪個動作需要判斷，再提示 IF，最後才提示 IF 內放啟動。
- 相同流程重複、沒有迴圈：引導把下一站、掃描、IF 放進 Repeat 3。
- 遇上山區風暴：只介紹安全／危險，並說明導航等候。
- 程式結束但未完成：保留已亮起的站，學生修改後直接再執行，無人機從基地重新出發。
- 碰撞仍會停下，需重設；重設保留 XML 及本次站點組合。新進入任務才更換組合。

提示一次只顯示一個問題或下一步；按「再給我一點提示」才深入。未完成不是 Game Over。風暴暴露只出現警告和次要安全分數影響；等待或思考沒有倒數懲罰。

### Advanced extensions

「進一步」保留指定站點飛行、方向與等待、Boolean 風暴感測、while/until、變數、計數、數值感測和比較。教師可讓學生自行決定山區出發時機、使用變數記錄完成數量、寫巢狀條件，或比較積木與飛行效率。不另建複雜模式，也不阻塞普通完成。

[原進階答案](../test/fixtures/mission3-advanced-reference.xml) 保留原 XML 作相容性驗證；舊比較、變數與數值感測仍可編譯執行，但舊風暴週期與失敗規則已由本次簡化取代。完成時間只供比較，沒有時間扣分。

## Rules and architecture

`core.js` 負責獨立規則，`blockly.js` 負責積木及隔離編譯，`runtime.js` 負責真實非同步執行與回饋，`scene.js` 負責場景。Mission 1 / 2 仍使用原 command queue。Mission 3 編譯暫時包裝 statement generators，並在 finally 還原；感測是在指令執行後讀取即時狀態。

每次只有哪些站正常／關閉會隨機變化；位置、目標和風暴規則固定。風暴每 40 模擬秒循環，首 16 秒危險，之後 24 秒安全；舊數值感測維持 85／15，相位固定為 0。山區範圍為 C 周圍 290 cm、80 cm 以上。普通模式無 30 秒暴露失敗、無啟動風暴鎖、無備電倒數；所有站用同一套 scan-before-activate 規則。

到站掃描須水平距離 ≤85 cm、高度差 ≤65 cm。啟動正常站無害，但計入多餘動作。完成必須三站全掃描且正常，再回基地降落。碰撞仍按小步進檢查；停止／重設以 generation token 取消舊動畫。迴圈和動作各有 600 次保護，避免無限執行。

計分維持滿分 1000：完成 500、安全 150、編程 250、時間項固定 100。編程獎勵迴圈與 IF + 狀態讀取；不再要求變數。重複程式仍可完成，但重複積木、無效掃描／啟動／移動會減低次要效率分。結果主要回饋用文字指出學生用了哪些概念。

舊 block IDs、OFFLINE／ACTIVE／UNKNOWN 內部值與 XML 格式保留。新增 `m3_next`、`m3_needs_power`、`m3_storm_safe`。Mission 3 存檔 key 仍是 `drone-simulator:v1:blockly-workspace:mission-3`；Mission 1 / 2 keys 不變。不支援的匯入積木會顯示可修正錯誤。

## Scene and design

The existing rescue field school UI is extended in Operate mode: compact warm-paper HUD, readable Chinese status, existing controls, no new visual identity. A maritime palette and island geography distinguish this mission.

- Base: landing platform, emergency tent, command equipment, rescue vehicle, solar charging and mast.
- Port: warehouses, stacked containers, quay, cargo ship, tug, crane, flooded roadside and traffic barriers.
- Town: residential and commercial models, road network, obstructed junction, civic shelter and street lamps.
- Medical Centre: recognisable building, rooftop helipad, ambulance, tent and generator.
- Mountain: authored rock meshes, forest, raised relay platform, communication tower and wind turbine.
- Storm Zone: local cloud/rain, binary safe/danger feedback and optional safety reflection. Reduced-motion preference hides rain; there are no flashing lightning effects.

Primary art uses real external GLBs. Procedural geometry is limited to water, gameplay indicators and lightweight effects. See [asset register](assets/mission-3-assets.md) for licences and exact files. Static model instances share scene-owned geometry/materials; the global template cache survives scene switching. New assets are loaded only on entry to Mission 3, while the offline app shell includes them for subsequent offline use.

## Verification

執行 `npm start`，另一終端執行以下本地檢查。Playwright 可由 `PLAYWRIGHT_MODULE` 指向既有安裝，`QA_URL` 指定 localhost，`QA_CHANNEL` 選瀏覽器。

- `npm test`：規則、真實 Blockly 生成、主答案四種狀態、進階舊答案、legacy contracts。
- `node scripts/mission3-browser-qa.cjs`：真實執行、錯誤與重試、匯入及存檔、四尺寸截圖。
- `node scripts/mission3-student-qa.cjs`：首次操作分類、先啟動錯誤、重複提示、保留進度修正、舊 XML 匯入。
- `node scripts/mission3-regression-qa.cjs`：進入 Mission 3 後真實執行 Mission 1／2 舊答案，驗證分數、清理和存檔隔離。
- `node scripts/mission3-lifecycle-qa.cjs`：切換、16 種重複 RNG、資源穩定、載入失敗復原。
- `node scripts/verify-static-site.cjs` 及 `node scripts/verify-mission1-answer.cjs`。

本次證據放在 `audit/mission-3-primary/`，原 `audit/mission-3/` 是簡化前歷史紀錄，不代表現行規則。

### Testing limits

這次是模擬首次遊玩流程及獨立 UI 檢查，**沒有真人小學生測試**，因此不能聲稱已實證所有學生 5–10 秒理解。桌面 Chrome 的 iPad 尺寸測試不代表實體 iPad、Safari 或觸控已認證。Detector 缺少 optional parser，退回 regex；空結果不是無障礙合格證明。沒有 push、PR 或部署。

## Final QA — 2026-09-26

- `npm test`：49/49 通過。涵蓋主答案四種狀態、進階舊答案、Boolean 分支、generator 還原、長等待不失敗及舊任務 byte contracts。
- [真實瀏覽器紀錄](../audit/mission-3-primary/browser-qa.json)：test-a、test-b、test-c、all-offline 全部完成，11 塊積木、1000/1000、零多餘啟動、零風暴暴露；模擬時間 30–32 秒。透過實際檔案匯入入口驗證主答案。
- 同一份瀏覽器紀錄：提早返航、漏啟動不能完成；危險區暴露超過 52 秒只提醒不失敗；修正重跑成功；不使用 IF/Repeat 的重複程式可完成但效率較低；飛行中重設能取消舊動畫；存檔能跨 reload 還原。
- [首次遊玩模擬](../audit/mission-3-primary/student-walkthrough.json)：實際打開四個核心工具箱分類，先啟動未掃描不會修好；兩站重複流程觸發迴圈提示；修改後直接執行，保留先前修好的站並完成；原進階 XML 在真實 Blockly 可匯入編譯。
- [場景生命周期](../audit/mission-3-primary/performance.json)：16 種強制重複 RNG 都能產生不同組合；reset 保留本次組合；三次 2→3 切換穩定為 143 geometries、40 textures、54 model batches；無 pageerror/HTTP failure。阻擋 manifest 時仍能顯示可重試訊息。
- [舊任務實測](../audit/mission-3-primary/legacy-regression.json)：Mission 1 到達 Bravo 並降落；Mission 2 四火點全部撲滅、1225 分。兩者無碰撞、無 pageerror，M3 HUD 隱藏、toolbox 還原、disposer 清理，M3 XML 存檔未被改寫。
- 本機 Chrome、1180×820 樣本：157 draw calls、76,715 triangles、frame median/p95 約 16.7 ms，80 materials、38 scene textures；沒有修改模型檔案、位置、照明或幾何。這不是實體 iPad 效能保證。
- 視覺證據涵蓋四個指定尺寸的 briefing、Blockly、HUD、展開 hints、results。獨立 reviewer 判定 ship；主代理補核全部 hint captures。無文件橫向溢出，HUD 留在場景容器內，結果操作完整可見。[審閱範圍](../audit/mission-3-primary/review.md)。
- 靜態打包驗證通過 197 個 offline entries；JavaScript syntax、舊任務一路線 fixture、`git diff --check` 均通過。

### Final QA questions

| 問題 | 判定與依據 |
| --- | --- |
| 小學生 5–10 秒看懂嗎？ | 三步、一句規則符合閱讀設計目標；模擬者可回答，但真人理解速度尚未實證。 |
| Briefing 是否少字？ | 是；只有故事、任務、三圖示、返回降落；授權收合。 |
| 是否很快可以開始？ | 是；一個「開始編程」，四核心分類，無設定問卷。 |
| 是否少量核心規則？ | 是；每站先掃描，有需要才啟動，重複三站。 |
| Condition 是否仍重要？ | 是；各站隨機正常／關閉，IF 避免多餘啟動並獲編程回饋。 |
| Loop 是否仍鼓勵？ | 是；一組流程重複三次，無 loop 時有情境提示及結果引導。 |
| Sensor 是否容易理解？ | 是；Boolean「能源站需要啟動？」可直接放 IF，先掃描才有資訊。 |
| Variables 是否不阻塞？ | 是；主答案不含任何變數。 |
| Storm 是否保留但不複雜？ | 是；場景風雨保留，只顯示安全／危險，導航等候，手動感測作延伸。 |
| HUD 是否清楚？ | 是；站數、山區風暴、一個下一步，細節按需展開。 |
| Failure 是否較不挫敗？ | 是；未完成可修正重跑，既有修復保留，無電量倒數或風暴 Game Over。碰撞仍需重設。 |
| Result 是否學生用語？ | 是；小島亮起、避開風暴、肯定 IF/Repeat；分數與多餘動作收合。 |
| Mission 1 / 2 是否無 regression？ | 以本輪實際舊答案通關與 byte contracts 核驗；詳細數值見 legacy-regression.json。 |

上述涵蓋需求 1–55 及 Definition of Done 的實作／本地 QA 項目。真人小學生理解時間、實體 iPad 仍是已列明的外部驗證限制，不以模擬測試冒充。
