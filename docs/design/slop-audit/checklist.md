# 完整 Slop Catalog 核對表

來源：[Impeccable 當前 catalog](https://impeccable.style/slop/)，2026-09-24 擷取，**67 項：49 source、12 browser、6 設計評審**。原始頁 SHA-256 見 catalog.json。修改前版本保留於 [checklist-before.md](checklist-before.md)。

每項有方法、證據和判定；「未發現」僅指本次檢查範圍，不代表所有裝置／狀態皆已保證。沒有新增或修改 ignore 規則。完整執行方式、狀態覆蓋和限制見 [report.md](report.md)。

本站沒有公開搜尋或管理後台；公開入口對應首頁／任務選擇，本機操作對應積木／儲存／匯入匯出／debug。道路編輯器由原有 feature flag 停用，列為不適用，未為核對表新開功能。

| # | Catalog ID | 檢查方法 | 證據及判斷 | 狀態 |
|---|---|---|---|---|
| 1 | `design-system-font` | source detector＋人工源碼/用途核對 | 核對 CSS font-family 與 DESIGN.md；移除未使用 Inter 請求，記錄原有 Noto Sans TC／IBM Plex Sans／Mono 的用途。 [證據](../../../DESIGN.md) | 已修正 |
| 2 | `design-system-color` | source detector＋人工源碼/用途核對 | canvas/backdrop 改用 tokens；source-after 尚有 skip-link 黑色 advisory，實際 computed 為 rgb(23,59,55)，是靜態解析 CSS imports 的限制。 [證據](evidence/manual-runtime.json) | 已修正；保留誤報 |
| 3 | `design-system-radius` | source detector＋人工源碼/用途核對 | 6/12px 為按鈕／面板；2px 僅窄拖曳把手端點，補記既有用途，沒有新增大圓角。 [證據](../../../DESIGN.md) | 已核對 |
| 4 | `design-system-font-size` | source detector＋人工源碼/用途核對 | 11/12px 次要文字升至13；HUD small 從9.1667升至13；17/23/25/38 收斂至18/24/24/36。層級寫入 DESIGN，不以全部新增豁免處理。 [證據](evidence/manual-runtime.json) | 已修正 |
| 5 | `codex-grid-background` | source detector＋人工源碼/用途核對 | 首頁無裝飾網格；Blockly 點陣用於積木定位，3D 地面格線提供飛行空間參考。 [證據](evidence/after-laptop-split.jpg) | 有意保留功能網格 |
| 6 | `border-accent-on-rounded` | source detector＋人工源碼/用途核對 | 面板以完整邊框組織；分類條屬於 Blockly 行，不是在圓角營銷卡上加單邊裝飾。 [證據](evidence/after-laptop-split.jpg) | 未發現該模式 |
| 7 | `glassmorphism` | 獨立設計評審＋主代理核對 | 獨立評審與 CSS 核對：面板實色、無 backdrop-filter；半透明 modal backdrop 用於遮罩而非玻璃卡。 [證據](report.md) | 未發現該模式 |
| 8 | `side-tab` | source detector＋人工源碼/用途核對 | browser 命中 Blockly 分類左色條，顏色對應積木語義且同時有文字；保留第三方工具的識別方式。 [證據](evidence/after-tablet-advanced.jpg) | 有意保留 |
| 9 | `gpt-thin-border-wide-shadow` | source detector＋人工源碼/用途核對 | 陰影局限 modal／浮動提示；主面板及任務卡以邊框和留白組織，無連續陰影卡堆疊。 [證據](evidence/after-desktop-home.jpg) | 未發現重復濫用 |
| 10 | `repeating-stripes-gradient` | source detector＋人工源碼/用途核對 | active CSS 搜索無 repeating-gradient；飛行場景道路標記是實際地圖。 [證據](evidence/manual-source-patterns.txt) | 未發現該模式 |
| 11 | `over-round` | 獨立設計評審＋主代理核對 | 獨立評審：按鈕6px、面板12px；沒有統一 pill 或誇張圓角。 [證據](evidence/after-desktop-missions.jpg) | 未發現該模式 |
| 12 | `sketchy-svg` | 獨立設計評審＋主代理核對 | 圖標為一致1.8 stroke幾何 SVG；無手繪塗鴉下划線。 [證據](../../../js/v2_ui.js) | 未發現該模式 |
| 13 | `kicker-above-heading` | source detector＋人工源碼/用途核對 | 首頁直接主標題；任務類別為圖片下角的路線規劃／資源管理，提供比較維度。 [證據](evidence/after-desktop-home.jpg) | 未發現重復模式 |
| 14 | `undersized-ui-text` | source detector＋人工源碼/用途核對 | caption／日誌／說明統一至少13px；可見 HUD 及保存狀態已復核。 [證據](evidence/after-mobile-world-debug.jpg) | 已修正 |
| 15 | `flat-type-hierarchy` | source detector＋人工源碼/用途核對 | 首頁36–60、任務24、工作區14–20、輔助13；重點由字號、位置、字重共同區分。 [證據](evidence/after-desktop-home.jpg) | 已核對 |
| 16 | `icon-tile-stack` | source detector＋人工源碼/用途核對 | 入口用真實任務場景圖；圖例 SVG／模型縮圖服務地標辨識，不是重復特性三件套。 [證據](evidence/after-desktop-rules.jpg) | 未發現該模式 |
| 17 | `italic-serif-display` | source detector＋人工源碼/用途核對 | active 字體皆 sans／mono，無斜體襯線展示字。 [證據](evidence/manual-source-patterns.txt) | 未發現該模式 |
| 18 | `hero-eyebrow-chip` | source detector＋人工源碼/用途核對 | 主標題上方無廣告膠囊；場景說明僅貼近圖片，手機隱藏非必要說明。 [證據](evidence/after-mobile-home.jpg) | 未發現該模式 |
| 19 | `oversized-h1` | source detector＋人工源碼/用途核對 | 桌面 clamp36–60、手機36；1440/1024/390 首屏及滾動入口檢查，無標題擠走所有操作。 [證據](evidence/after-mobile-home.jpg) | 已核對 |
| 20 | `extreme-negative-tracking` | source detector＋人工源碼/用途核對 | 標題僅-.03em；中文正文無負字距。 [證據](../../../assets/styles/hub.css) | 未發現該模式 |
| 21 | `overused-font` | source detector＋人工源碼/用途核對 | 移除未實際採用的 Inter 網絡請求；保留中文閱讀、拉丁標題、等寬數值分工。 [證據](../../../index.html) | 已修正 |
| 22 | `single-font` | 獨立設計評審＋主代理核對 | 獨立評審與 tokens：Noto中文、IBM Plex Sans標題、IBM Plex Mono數據，區別有用途。 [證據](../../../DESIGN.md) | 未發現該模式 |
| 23 | `all-caps-body` | source detector＋人工源碼/用途核對 | 正文為繁體中文；技術名詞 cm／Blockly／3D 不是大寫段落。 [證據](evidence/after-desktop-briefing.json) | 未發現該模式 |
| 24 | `radial-halo` | source detector＋人工源碼/用途核對 | active CSS 無 radial-gradient 光暈；場景燈光不是網頁裝飾暈。 [證據](evidence/manual-source-patterns.txt) | 未發現該模式 |
| 25 | `radial-spotlight-glow` | source detector＋人工源碼/用途核對 | 首頁真實場景圖，背景實色，無 CSS 聚光暈。 [證據](evidence/after-desktop-home.jpg) | 未發現該模式 |
| 26 | `ai-color-palette` | source detector＋人工源碼/用途核對 | 暖紙／深綠／救援橙有場地教學語境；未使用紫藍漸變套裝。 [證據](../../../DESIGN.md) | 已核對 |
| 27 | `dark-glow` | source detector＋人工源碼/用途核對 | 淺色背景，焦點有實線outline，無暗色霓虹發光。 [證據](evidence/after-laptop-split.jpg) | 未發現該模式 |
| 28 | `gradient-text` | source detector＋人工源碼/用途核對 | 標題直接 text color，無 background-clip:text 或漸變文字。 [證據](evidence/manual-source-patterns.txt) | 未發現該模式 |
| 29 | `gray-on-color` | source detector＋人工源碼/用途核對 | 實色表面用深綠文字，主按鈕米白／救援橙；contrast與渲染 detector 交叉核對。 [證據](evidence/manual-runtime.json) | 已核對 |
| 30 | `cream-palette` | source detector＋人工源碼/用途核對 | 官方 URL 三尺寸均報告；獨立設計評審認為暖紙色契合救援現場教學。未為了清零改色或忽略規則。 [證據](evidence/url-desktop-after.json) | 有意保留 |
| 31 | `numbered-section-labels` | source detector＋人工源碼/用途核對 | 無01/02裝飾章節；任務一／二和教學步數有實際流程含義。 [證據](evidence/after-desktop-tutorial.json) | 未發現該模式 |
| 32 | `edge-flush-cards` | browser detector＋互動/視覺核對 | 卡片內部24px、mobile20px，手機modal12px外距；場景圖允許滿幅。 [證據](evidence/after-mobile-result.jpg) | 已核對 |
| 33 | `text-occlusion` | browser detector＋互動/視覺核對 | 詳細HUD以真實log高度上移並可滾動，ResizeObserver處理日誌增長；前後截圖確認不再被記錄遮蓋。 [證據](evidence/after-tablet-telemetry-log.jpg) | 已修正 |
| 34 | `first-viewport-column-overflow` | browser detector＋互動/視覺核對 | 1024入口兩欄，390縱排並可滾動；工作區顯式切換code/world，無意外水平頁面滾動。 [證據](evidence/after-tablet-home.jpg) | 已核對 |
| 35 | `heading-rhythm` | browser detector＋互動/視覺核對 | 首頁h1至正文24px、任務標題至描述12px、規則24/12px；沒有機械統一間距。 [證據](../../../assets/styles/hub.css) | 已核對 |
| 36 | `hero-metric-layout` | 獨立設計評審＋主代理核對 | 獨立評審：首頁不含虛構數字；結果頁分數是真實執行輸出。 [證據](evidence/after-desktop-result.jpg) | 未發現該模式 |
| 37 | `identical-card-grids` | 獨立設計評審＋主代理核對 | 獨立評審：只兩項實際任務，統一圖片/目標/學習點便於比較；非不同內容全塞卡。 [證據](evidence/after-desktop-missions.jpg) | 有意保留比較結構 |
| 38 | `monotonous-spacing` | source detector＋人工源碼/用途核對 | 主頁48px區塊、任務28px間距、工作區8/16px密度，適應不同信息層級。 [證據](../../../assets/styles/hub.css) | 已核對 |
| 39 | `nested-cards` | source detector＋人工源碼/用途核對 | workspace/world為功能分區；HUD、日誌有獨立用途，非裝飾卡套卡。 [證據](evidence/after-laptop-split.jpg) | 未發現重復容器問題 |
| 40 | `line-length` | browser detector＋互動/視覺核對 | 首頁段落max35ch；簡報兩欄轉單欄；390px中文說明保持可讀換行。 [證據](evidence/after-mobile-city-briefing.jpg) | 已核對 |
| 41 | `text-overflow` | browser detector＋互動/視覺核對 | collapsed console-summary用ellipsis，點擊即可看完整記錄；展開後隱藏摘要，正文可換行。其餘可見標題及按鈕無截斷。 [證據](evidence/after-mobile-world-debug.jpg) | 有意保留單行摘要 |
| 42 | `clipped-overflow-container` | browser detector＋互動/視覺核對 | code-only視圖故意收起且inert world，detector仍報1px容器；切world後完整顯示。詳細HUD和modal使用可滾動內容。 [證據](evidence/after-mobile-code.json) | 保留狀態誤報 |
| 43 | `pulsing-dot` | source detector＋人工源碼/用途核對 | 無裝飾閃動狀態點；狀態使用中文標籤。 [證據](evidence/manual-source-patterns.txt) | 未發現該模式 |
| 44 | `blinking-cursor` | browser detector＋互動/視覺核對 | 無打字機標題/閃爍游標；編輯器原生光標屬輸入功能。 [證據](evidence/manual-source-patterns.txt) | 未發現該模式 |
| 45 | `marquee` | source detector＋人工源碼/用途核對 | 入口及任務頁無自動橫向滾動內容。 [證據](evidence/after-desktop-home.jpg) | 未發現該模式 |
| 46 | `bounce-easing` | source detector＋人工源碼/用途核對 | 交互僅150ms顏色/位移，未用彈跳曲線。 [證據](evidence/manual-source-patterns.txt) | 未發現該模式 |
| 47 | `layout-transition` | source detector＋人工源碼/用途核對 | active transition只background/border-color/transform；無width/height動畫。 [證據](evidence/manual-source-patterns.txt) | 未發現該模式 |
| 48 | `image-hover-transform` | source detector＋人工源碼/用途核對 | 任務卡整體上移3px，圖片自身不縮放；reduce-motion禁用位移。 [證據](../../../assets/styles/hub.css) | 已核對 |
| 49 | `repeated-container-text` | source detector＋人工源碼/用途核對 | 不同行為狀態有獨立文案；重復的任務名屬於導航/簡報的上下文；無空卡樣板。 [證據](evidence/after-desktop-rules.json) | 已核對 |
| 50 | `em-dash-overuse` | source detector＋人工源碼/用途核對 | 無宣傳段落破折號串聯；目標—代表無目標數據。 [證據](evidence/after-tablet-tools.json) | 未發現該模式 |
| 51 | `marketing-buzzword` | source detector＋人工源碼/用途核對 | 文案描述連接積木、起飛、巡檢、取水等具體動作，無泛化AI營銷承諾。 [證據](evidence/after-mobile-city-rules.json) | 未發現該模式 |
| 52 | `aphoristic-cadence` | source detector＋人工源碼/用途核對 | 「觀察。修正。再試一次。」是實際迭代學習流程；未在正文堆疊空泛對偶。 [證據](evidence/after-desktop-home.jpg) | 有意保留學習提示 |
| 53 | `theater-slop-phrase` | source detector＋人工源碼/用途核對 | 未見production-ready／seamless類自證質量話術；界面圍繞下一步操作。 [證據](evidence/after-desktop-home.json) | 未發現該模式 |
| 54 | `shape-assembled-illustration` | source detector＋人工源碼/用途核對 | 實際Three.js任務截圖和模型預覽提供地圖上下文；無CSS形狀拼湊營銷插圖。 [證據](evidence/after-desktop-missions.jpg) | 未發現該模式 |
| 55 | `organic-clip-path` | source detector＋人工源碼/用途核對 | 4.1.0 source規則＋人工搜索；唯一clip-path是sr-only inset，未用blob/有機裁剪。3.6.1運行時不含本項，未虛報覆蓋。 [證據](evidence/manual-source-patterns.txt) | 未發現該模式 |
| 56 | `buried-raster` | source detector＋人工源碼/用途核對 | 4.1.0 source規則＋手動查img/SVG；場景PNG直接img，沒有base64柵格隱藏在SVG中。 [證據](../../../index.html) | 未發現該模式 |
| 57 | `broken-image` | source detector＋人工源碼/用途核對 | 三尺寸主頁、兩任務簡報、圖例實圖均加載；靜態封裝161路徑通過。 [證據](evidence/after-desktop-rules.jpg) | 已核對 |
| 58 | `script-error` | browser detector＋互動/視覺核對 | 官方URL三尺寸及每個狀態dev.logs均無error；17項測試通過，非只憑detector判定。 [證據](evidence/after-desktop-result.json) | 已核對 |
| 59 | `content-hidden-at-rest` | browser detector＋互動/視覺核對 | 1100px以下保存狀態原被display:none，現可見；高級工具/非當前視圖有明確入口，預期隱藏另行判讀。 [證據](evidence/after-tablet-code.jpg) | 已修正 |
| 60 | `cramped-padding` | browser detector＋互動/視覺核對 | 日誌篩選、手機debug控制改wrap；empty提示限制寬度，工具菜單可滾動。 [證據](evidence/after-mobile-world-debug.jpg) | 已修正 |
| 61 | `body-text-viewport-edge` | browser detector＋互動/視覺核對 | 手機文案24px、modal20px內距；full-bleed場景不等於正文貼邊。 [證據](evidence/after-mobile-home.jpg) | 已核對 |
| 62 | `justified-text` | source detector＋人工源碼/用途核對 | active CSS無text-align:justify，中文左對齊。 [證據](evidence/manual-source-patterns.txt) | 未發現該模式 |
| 63 | `low-contrast` | source detector＋人工源碼/用途核對 | URL/state detector結合computed tokens核對；disabled淡化不是可操作正文；未將canvas識別當作文字contrast保證。 [證據](evidence/manual-runtime.json) | 已核對 |
| 64 | `skipped-heading` | source detector＋人工源碼/用途核對 | 簡報動態h4改h3，dialog h2→說明/規則h3；不同隱藏頁面不並作一個可見層級。 [證據](../../../js/v2_ui.js) | 已修正 |
| 65 | `tight-leading` | source detector＋人工源碼/用途核對 | 中文說明1.7–1.9，正文1.5，展示標題1.25；無長段落擠成標題行高。 [證據](../../../assets/styles/overlays.css) | 已核對 |
| 66 | `tiny-text` | source detector＋人工源碼/用途核對 | HUD camera舊9.1667px明確改13px，13px輔助、14px控制；before/after原始報告可追溯。 [證據](evidence/manual-runtime.json) | 已修正 |
| 67 | `wide-tracking` | source detector＋人工源碼/用途核對 | active樣式僅標題-.03em，未對中文正文或大寫標籤加寬字距。 [證據](evidence/manual-source-patterns.txt) | 未發現該模式 |
