#!/bin/bash
# 啟動本地 HTTP 服務器
PORT=8000

echo "🚀 啟動本地 HTTP 服務器..."
echo "📍 服務器地址: http://localhost:$PORT"
echo "📂 服務目錄: $(pwd)"
echo ""
echo "按 Ctrl+C 停止服務器"
echo ""

# 檢查 Python 版本並啟動服務器
if command -v python3 &> /dev/null; then
    python3 -m http.server $PORT
elif command -v python &> /dev/null; then
    python -m http.server $PORT
else
    echo "❌ 錯誤：找不到 Python，請安裝 Python 3"
    exit 1
fi
