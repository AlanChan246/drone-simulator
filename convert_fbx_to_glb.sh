#!/bin/bash
# FBX 轉 GLB 轉換腳本
echo "正在檢查並安裝 FBX2GLTF 轉換工具..."
# 檢查是否已安裝 FBX2GLTF
if ! command -v fbx2gltf &> /dev/null; then
    echo "FBX2GLTF 未安裝，正在安裝..."
    npm install -g @facebookincubator/fbx2gltf
fi
# 轉換 drone.fbx 為 drone.glb
if [ -f "assets/models/drone.fbx" ]; then
    echo "正在轉換 drone.fbx 為 drone.glb..."
    fbx2gltf -i assets/models/drone.fbx -o assets/models/drone.glb
    echo "✅ 轉換完成！輸出文件：assets/models/drone.glb"
else
    echo "❌ 錯誤：找不到 assets/models/drone.fbx"
    exit 1
fi
