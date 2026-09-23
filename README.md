# Drone Simulator v2 — 救災無人機訓練

以 Blockly 積木操控 3D 無人機，練習路線規劃、觀察飛行結果與修正程式。包含震後街區搜救、山火應對及自由練習。

## 本機啟動

需要 Node.js、npm 與 Python 3。

```sh
npm ci
npm start
```

在瀏覽器開啟 http://localhost:8080。不能直接雙擊 index.html；瀏覽器會阻止載入 3D 模型。初次啟動需要安裝依 lockfile 固定的程式庫。

## 操作

1. 選擇任務，閱讀簡短目標；詳細圖例和計分規則可展開查看。
2. 從工具箱拖入積木，或在自由練習加入第一次飛行示範。
3. 按「執行」，觀察高亮積木、指令提示及無人機。
4. 按「重置」回到起點；積木會保留，可修正後再試。

「並排觀察／專心編程／觀察飛行」切換同一份程式及場景。較窄的橫向平板預設完整編程空間，執行時切換到飛行畫面。暫停在積木邊界生效；逐步執行、斷點、詳細數據及飛行紀錄在「更多工具」。

鏡頭可跟隨、全景或俯視。滑鼠拖曳旋轉、滾輪縮放；原有單指旋轉／雙指縮放手勢保留。鍵盤聚焦 3D 畫布後，用方向鍵旋轉、加減鍵縮放。積木面板分隔線亦支援左右方向鍵。

## 儲存與相容性

積木按任務保存在同一瀏覽器的 localStorage，亦可匯出／匯入 XML。原有 `drone-simulator:v1:blockly-workspace:` 儲存鍵與 XML 格式保留；路面設定仍使用 `drone-simulator-road-overrides-v2`。飛行紀錄是當次工作階段紀錄，沒有新增雲端帳號或成績資料庫。清除瀏覽器資料前請先匯出。

任務一以沿道路抵達疏散區並降落完成，巡檢為加分項。任務二保留原有滅火、充電、降落和時間計分規則；未全滅仍可降落結算。新版沒有改動飛行物理或計分公式。

## 檢查

```sh
npm test
node scripts/verify-static-site.cjs
```

第二個指令在暫存目錄執行既有 GitHub Pages 打包步驟，核對離線清單，然後清理暫存輸出；不會部署。

## 架構

- `index.html`：畫面、工具箱與對話框。
- `assets/styles/`：v2 tokens、基本元素、入口、工作區和浮層；舊 style.css 不再載入。
- `js/v2_ui.js`：視圖切換、指令提示、鏡頭預設、世界標示和焦點隔離。
- `js/main.js`：工作區、執行流程、教學、儲存及任務畫面整合。
- `js/blockly_workspace_io.js`：先驗證再取代工作區，保護匯入失敗前的積木。
- `js/simulator.js`：既有場景、移動、碰撞、感測及任務計算。
- `js/flight_command_execution.js`、`mission_rules.js`、`scene_lifecycle.js`、`flight_deck_view.js`：既有介面邊界。
- `sw.js`：正式網站離線快取；本機開發不自動安裝，避免重製時混入舊版資源。

GitHub Pages 沿用靜態部署方式。完成一次線上載入並安裝快取後，正式網站可使用已快取資源離線運作；Google Fonts 離線時使用系統字體。新版本程式採網絡優先、離線回退。這次工作僅作本機 Git 提交，沒有推送或部署。

## 設計與驗證紀錄

- [產品審視](docs/design/v2-audit.md)
- [設計系統](docs/design/v2-design-system.md) · [元件與視覺規範](DESIGN.md)
- [操作架構](docs/design/v2-ux-architecture.md)
- [前後比較](docs/design/v2-before-after.md)
- [測試與限制](docs/design/v2-qa.md)

既有模型與媒體授權文件保留於 assets。沒有加入新的第三方模型、圖片或圖示套件。
