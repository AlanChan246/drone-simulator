# Mission 3 — 天空機關城 / Sky Gate Protocol

## 執行紀錄與範圍

2026-09-26 one-shot 授權：完成實作、試玩、回歸、文件及 local commits，不 push、不 deploy。起始分支 `codex/mission-3-primary-school`；既有 `.DS_Store` 修改保留。

Model Selection Gate：建議 GPT-6 Astra / high；系統只可核實 GPT-6 身分，無法核實實際型號細節或 effort。大型實作用量。3 個 fresh default 子代理分別唯讀探索 runtime、simulator hooks 及官方資產；主代理設計、修改、整合及最終驗證。模型參考：https://developers.openai.com/api/docs/models/gpt-6-astra

## 概念與學習目標

破解三道智能閘門，重啟天空基地。核心循環是「感測 → 判斷 → 發送 → 等待 → 飛行」。三道門使用相同規則；第二段右轉並上升，第三段左轉並再次上升。重點為 sequence、if/else、即時 sensor、迴圈與條件等待。程序重用是可選進階技巧。

## 設計合約

延伸既有 Flight Deck 的暖紙色、深綠控制與橙色執行鍵。天空場景用 Kenney 白色機械平台、六角機關門與玻璃研究模組，與街區及山火場景明確分別。主畫面先看見出發平台、三道門與中央塔；閘門有編號、頻道字母／圖形、狀態文字和門扇移動。介面沿用既有任務卡、簡報和結算，不重設全站視覺系統。

## 核心規則

- 頻道 A／B／C 以字母、圓／三角／方形及顏色共同表示。
- 在門前 190 cm 內、通道中央及指定高度讀取訊號。設定頻道與發送是分開的動作。
- 門依序經過 locked → accepted → open → completed。只有開門完成且從正面真正穿越通道才算通過。繞過門不算完成。
- 標準模式不設倒數、電池或隨機障礙；開啟的门不會突然關閉。
- 通過三道門後，在核心平台降落並執行「啟動天空基地」。
- 錯誤會停止程式並指出原因，保留積木。重試保留配置；「新挑戰」才改變頻道與開門時間。

## 架構

`js/mission3/config.js` 定義航線與配置；`gates.js` 是不依賴 DOM 的閘門狀態和掃掠碰撞規則。Mission 3 使用獨立即時執行路徑，避免現有 Mission 1／2 預掃描把 sensor 固定在飛行前。原有兩關的指令與計分規則保持原樣。

完整 QA、積木清單及資產清單會在實作驗證後記錄於本文件與 `docs/assets/mission-3-assets.md`。
