#!/usr/bin/env python3
"""
使用 Blender Python API 將 FBX 轉換為 GLB
需要先安裝 Blender 並確保 blender 命令在 PATH 中
"""
import subprocess
import sys
import os
def convert_fbx_to_glb(fbx_path, glb_path):
    """使用 Blender 將 FBX 轉換為 GLB"""
    # 檢查文件是否存在
    if not os.path.exists(fbx_path):
        print(f"❌ 錯誤：找不到文件 {fbx_path}")
        return False
    
    # Blender Python 腳本
    blender_script = f"""import bpy
import sys

# 清除場景
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# 導入 FBX
try:
    bpy.ops.import_scene.fbx(filepath=r"{fbx_path}")
    print("✅ FBX 導入成功")
except Exception as e:
    print(f"❌ FBX 導入失敗: {{e}}")
    sys.exit(1)

# 導出 GLB
try:
    bpy.ops.export_scene.gltf(
        filepath=r"{glb_path}",
        export_format='GLB',
        export_draco_mesh_compression_enable=False
    )
    print("✅ GLB 導出成功")
except Exception as e:
    print(f"❌ GLB 導出失敗: {{e}}")
    sys.exit(1)
"""
    
    # 將腳本寫入臨時文件
    script_path = "/tmp/blender_convert.py"
    with open(script_path, 'w') as f:
        f.write(blender_script)
    
    # 執行 Blender（macOS 上使用完整路徑）
    blender_paths = [
        '/Applications/Blender.app/Contents/MacOS/Blender',  # macOS 標準路徑
        'blender'  # 如果已在 PATH 中
    ]
    
    blender_cmd = None
    for path in blender_paths:
        if os.path.exists(path) or path == 'blender':
            try:
                # 測試命令是否可用
                test_result = subprocess.run(
                    [path, '--version'],
                    capture_output=True,
                    timeout=5
                )
                if test_result.returncode == 0 or path == 'blender':
                    blender_cmd = path
                    break
            except:
                continue
    
    if not blender_cmd:
        print("❌ 錯誤：找不到 Blender 命令")
        print("   請確保 Blender 已安裝在 /Applications/Blender.app")
        return False
    
    # 執行 Blender
    try:
        result = subprocess.run(
            [blender_cmd, '--background', '--python', script_path],
            capture_output=True,
            text=True,
            check=True
        )
        print(result.stdout)
        if os.path.exists(glb_path):
            print(f"✅ 轉換完成！輸出文件：{glb_path}")
            return True
        else:
            print("❌ 轉換失敗：輸出文件不存在")
            return False
    except FileNotFoundError:
        print("❌ 錯誤：找不到 Blender 命令")
        print("   請確保 Blender 已安裝並在 PATH 中")
        print("   或使用其他轉換方法（見 CONVERT_README.md）")
        return False
    except subprocess.CalledProcessError as e:
        print(f"❌ 轉換過程出錯：{e}")
        print(e.stderr)
        return False
    finally:
        # 清理臨時文件
        if os.path.exists(script_path):
            os.remove(script_path)

if __name__ == "__main__":
    fbx_file = "assets/models/drone.fbx"
    glb_file = "assets/models/drone.glb"
    
    # 轉換為絕對路徑
    script_dir = os.path.dirname(os.path.abspath(__file__))
    fbx_path = os.path.join(script_dir, fbx_file)
    glb_path = os.path.join(script_dir, glb_file)
    
    print(f"正在將 {fbx_file} 轉換為 {glb_file}...")
    success = convert_fbx_to_glb(fbx_path, glb_path)
    
    sys.exit(0 if success else 1)

