# 首頁影片及正式場景預覽

使用者接受 Mission 1 精修場景，沿用現有正式入口。任務卡與任務簡介改用 `assets/images/mission-preview-1-final.png`：從正式 WebGL 場景直接匯出，無 UI 遮擋，非 AI 重建。Mission 2 不變。

影片來源：使用者提供 `/Users/alanchan/Downloads/hero-ai-first-three (online-video-cutter.com).mp4`。30 秒、1280×720 H.264、無音軌。`rescue-home-720.mp4` 只作 fast-start remux，沒有重新編碼或聲稱提升細節；poster 取第 3 秒。未送往第三方。影片最大 640 CSS px、完整 16:9，並標示概念短片。

驗證：25/25 現有測試通過，靜態打包 166 項離線資源通過。桌面 1440×900、平板 1180×820、手機 390×844 檢查；不等於實體 iPad/Safari 驗證。播放／暫停、離開首頁停止及任務簡介新圖已確認。影片交由瀏覽器處理 Range，不納入離線快取，離線保留 poster。Detector 降級為 regex，無回報；不聲稱完整 contrast audit 或獨立子代理審核。

## 使用者後續修訂

移除片下說明及播放／暫停按鈕，只保留影片。新增明確 1280×720 尺寸、height:auto、max-width:100% 及可縮小容器，並更新樣式與 service worker 版本以避免舊版快取。1440、1024、701、390px 的瀏覽器測量均為 16:9、object-fit:contain，右邊界沒有溢出，25/25 測試通過。未直接驗證使用者外部瀏覽器，未聲稱確認該瀏覽器原始裁切成因。
