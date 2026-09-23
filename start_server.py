#!/usr/bin/env python3
"""
簡單的 HTTP 服務器，用於運行 drone-simulator
解決 CORS 問題
"""
import http.server
import socketserver
import os
import sys

PORT = 8000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 添加 CORS 標頭，允許跨域請求
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def log_message(self, format, *args):
        # 自定義日誌格式
        sys.stderr.write("%s - - [%s] %s\n" %
                        (self.address_string(),
                         self.log_date_time_string(),
                         format%args))

if __name__ == "__main__":
    # 切換到腳本所在目錄
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    Handler = MyHTTPRequestHandler
    
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print("=" * 60)
            print("🚀 本地 HTTP 服務器已啟動")
            print("=" * 60)
            print(f"📍 服務器地址: http://localhost:{PORT}")
            print(f"📂 服務目錄: {os.getcwd()}")
            print("")
            print("💡 在瀏覽器中打開: http://localhost:8000/index.html")
            print("")
            print("按 Ctrl+C 停止服務器")
            print("=" * 60)
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n🛑 服務器已停止")
        sys.exit(0)
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"❌ 錯誤：端口 {PORT} 已被占用")
            print(f"   請關閉其他使用該端口的程序，或修改 PORT 變數")
        else:
            print(f"❌ 錯誤：{e}")
        sys.exit(1)
