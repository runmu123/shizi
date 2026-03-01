#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Android APK 构建脚本

命令说明：
  build.py init      - 初始化 Capacitor Android 项目
  build.py sync      - 同步 Web 代码到 Android 项目
  build.py build     - 构建 APK 并复制到项目根目录
  build.py clean     - 清理构建文件
"""

import os
import sys
import subprocess
import argparse
import shutil
import json
import yaml
import re
import hashlib
from xml.sax.saxutils import escape as xml_escape
from pathlib import Path

# 全局变量
ANDROID_BUILD_DIR = "android_build"
ANDROID_DIR = os.path.join(ANDROID_BUILD_DIR, "android")
GRADLE_WRAPPER = os.path.join(ANDROID_DIR, "gradlew.bat")
BUILTIN_AUDIO_SRC_DIR = "shizi-audio-cache"
BUILTIN_AUDIO_WWW_DIR = os.path.join(ANDROID_BUILD_DIR, "www", "audio")
BUILTIN_AUDIO_MANIFEST = os.path.join(ANDROID_BUILD_DIR, "www", "audio-manifest.json")

# 颜色输出
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    END = '\033[0m'

    @classmethod
    def green(cls, text):
        return f"{cls.GREEN}{text}{cls.END}"

    @classmethod
    def yellow(cls, text):
        return f"{cls.YELLOW}{text}{cls.END}"

    @classmethod
    def red(cls, text):
        return f"{cls.RED}{text}{cls.END}"

    @classmethod
    def blue(cls, text):
        return f"{cls.BLUE}{text}{cls.END}"

# 日志函数
def log_info(message):
    print(f"[{Colors.blue('INFO')}] {message}")

def log_success(message):
    print(f"[{Colors.green('SUCCESS')}] {message}")

def log_warning(message):
    print(f"[{Colors.yellow('WARNING')}] {message}")

def log_error(message):
    print(f"[{Colors.red('ERROR')}] {message}")

def log_step(step):
    print(f"\n{Colors.blue('=' * 60)}")
    print(f"{Colors.blue(f'步骤: {step}')}")
    print(f"{Colors.blue('=' * 60)}")

# 执行命令函数
def run_command(cmd, cwd=None, capture_output=False):
    """执行命令并返回结果"""
    try:
        log_info(f"执行命令: {' '.join(cmd)}")
        if capture_output:
            result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, shell=True)
            return result.returncode, result.stdout, result.stderr
        else:
            result = subprocess.run(cmd, cwd=cwd, shell=True)
            return result.returncode, None, None
    except Exception as e:
        log_error(f"执行命令失败: {e}")
        return -1, None, str(e)

# 环境检查
def check_environment():
    """检查系统环境"""
    log_step("检查系统环境")
    
    # 检查 Python
    log_info("检查 Python 版本...")
    if sys.version_info < (3, 7):
        log_error("Python 版本需要 3.7 或更高")
        return False
    log_success(f"Python 版本: {sys.version}")
    
    # 检查 Node.js
    log_info("检查 Node.js 版本...")
    code, stdout, stderr = run_command(["node", "--version"], capture_output=True)
    if code != 0:
        log_error("Node.js 未安装或版本过低")
        return False
    log_success(f"Node.js 版本: {stdout.strip()}")
    
    # 检查 npm
    log_info("检查 npm 版本...")
    code, stdout, stderr = run_command(["npm", "--version"], capture_output=True)
    if code != 0:
        log_error("npm 未安装")
        return False
    log_success(f"npm 版本: {stdout.strip()}")
    
    # 检查 Java
    log_info("检查 Java 版本...")
    code, stdout, stderr = run_command(["java", "-version"], capture_output=True)
    if code != 0:
        log_error("Java 未安装或版本过低")
        return False
    log_success("Java 已安装")
    
    # 检查 Gradle (如果已初始化)
    if os.path.exists(GRADLE_WRAPPER):
        log_info("检查 Gradle 版本...")
        code, stdout, stderr = run_command([GRADLE_WRAPPER, "--version"], capture_output=True, cwd=ANDROID_DIR)
        if code != 0:
            log_warning("Gradle 检查失败，将在初始化时安装")
        else:
            log_success("Gradle 已安装")
    
    return True

# 读取配置
def read_args_yaml():
    """读取 args.yaml 配置"""
    default_config = {
        "name": "识字",
        "pkg": "com.shizi",
        "version": "v3.0",
        "icon": "./icon.png",
        "enable_zoom": True,
        "out_dir": "."
    }

    args_yaml_path = "args.yaml"
    if not os.path.exists(args_yaml_path):
        # 创建默认配置
        with open(args_yaml_path, 'w', encoding='utf-8') as f:
            yaml.dump(default_config, f, allow_unicode=True)
        log_warning(f"创建默认配置文件: {args_yaml_path}")
        return default_config
    
    try:
        with open(args_yaml_path, 'r', encoding='utf-8') as f:
            raw_config = yaml.safe_load(f)
            if not isinstance(raw_config, dict):
                log_warning("args.yaml 内容为空或格式不正确，使用默认配置")
                return default_config

            config = default_config.copy()
            config.update(raw_config)

            # 兜底清洗，避免空值导致构建信息丢失
            config["name"] = str(config.get("name") or default_config["name"]).strip() or default_config["name"]
            config["pkg"] = str(config.get("pkg") or default_config["pkg"]).strip() or default_config["pkg"]
            config["version"] = str(config.get("version") or default_config["version"]).strip() or default_config["version"]
            config["icon"] = str(config.get("icon") or default_config["icon"]).strip() or default_config["icon"]
            config["out_dir"] = str(config.get("out_dir") or default_config["out_dir"]).strip() or default_config["out_dir"]
            config["enable_zoom"] = bool(config.get("enable_zoom", default_config["enable_zoom"]))
            return config
    except Exception as e:
        log_error(f"读取配置文件失败: {e}")
        return default_config


def write_file(path, content):
    """写入文本文件（UTF-8）"""
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)


def update_file_by_regex(path, replacements):
    """按正则批量替换文件内容"""
    if not os.path.exists(path):
        return False

    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content
    for pattern, repl in replacements:
        new_content = re.sub(pattern, repl, new_content, flags=re.MULTILINE)

    changed = new_content != content
    if changed:
        write_file(path, new_content)
    return changed


def normalize_hex_color(color, fallback="#ffffff"):
    """规范化十六进制颜色值"""
    if not color:
        return fallback
    c = color.strip()
    if not c.startswith("#"):
        return fallback
    hex_part = c[1:]
    if len(hex_part) == 3 and re.fullmatch(r"[0-9a-fA-F]{3}", hex_part):
        return "#" + "".join(ch * 2 for ch in hex_part).lower()
    if len(hex_part) == 6 and re.fullmatch(r"[0-9a-fA-F]{6}", hex_part):
        return "#" + hex_part.lower()
    if len(hex_part) == 8 and re.fullmatch(r"[0-9a-fA-F]{8}", hex_part):
        return "#" + hex_part.lower()
    return fallback


def detect_navbar_background_color():
    """从 www/index.html 中提取导航栏背景色（--nav-bg），用于状态栏颜色"""
    default_color = "#ffffff"
    index_html_path = os.path.join(ANDROID_BUILD_DIR, "www", "index.html")
    if not os.path.exists(index_html_path):
        return default_color

    try:
        with open(index_html_path, "r", encoding="utf-8") as f:
            content = f.read()

        # 1) 优先读取 CSS 变量 --nav-bg
        var_match = re.search(r"--nav-bg\s*:\s*([^;]+);", content, flags=re.MULTILINE)
        if var_match:
            return normalize_hex_color(var_match.group(1), default_color)

        # 2) 兜底读取 body 背景色
        body_match = re.search(r"body\s*\{[\s\S]*?background-color\s*:\s*([^;]+);", content, flags=re.MULTILINE)
        if body_match:
            return normalize_hex_color(body_match.group(1), default_color)
    except Exception:
        return default_color

    return default_color


def write_main_activity_java(path, app_id, enable_zoom):
    """写入兼容录音权限请求的 MainActivity.java"""
    zoom_settings = ""
    if enable_zoom:
        zoom_settings = """
        bridge.getWebView().getSettings().setSupportZoom(true);
        bridge.getWebView().getSettings().setBuiltInZoomControls(true);
        bridge.getWebView().getSettings().setDisplayZoomControls(false);
        bridge.getWebView().getSettings().setUseWideViewPort(true);
        bridge.getWebView().getSettings().setLoadWithOverviewMode(true);
"""

    content = f"""package {app_id};

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {{
    private static final int REQ_RECORD_AUDIO = 2001;
    private PermissionRequest pendingAudioPermissionRequest = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {{
        super.onCreate(savedInstanceState);

        if (bridge != null && bridge.getWebView() != null) {{
{zoom_settings}
            bridge.getWebView().setWebChromeClient(new WebChromeClient() {{
                @Override
                public void onPermissionRequest(final PermissionRequest request) {{
                    runOnUiThread(() -> {{
                        handleWebPermissionRequest(request);
                    }});
                }}
            }});
        }}
    }}

    private void handleWebPermissionRequest(PermissionRequest request) {{
        if (request == null) {{
            return;
        }}

        boolean asksAudio = false;
        String[] resources = request.getResources();
        if (resources != null) {{
            for (String res : resources) {{
                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) {{
                    asksAudio = true;
                    break;
                }}
            }}
        }}

        if (!asksAudio) {{
            request.deny();
            return;
        }}

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                        != PackageManager.PERMISSION_GRANTED) {{
            pendingAudioPermissionRequest = request;
            ActivityCompat.requestPermissions(
                    this,
                    new String[]{{Manifest.permission.RECORD_AUDIO}},
                    REQ_RECORD_AUDIO
            );
            return;
        }}

        request.grant(new String[]{{PermissionRequest.RESOURCE_AUDIO_CAPTURE}});
    }}

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {{
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_RECORD_AUDIO || pendingAudioPermissionRequest == null) {{
            return;
        }}

        boolean granted = grantResults != null
                && grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED;

        if (granted) {{
            pendingAudioPermissionRequest.grant(new String[]{{PermissionRequest.RESOURCE_AUDIO_CAPTURE}});
        }} else {{
            pendingAudioPermissionRequest.deny();
        }}
        pendingAudioPermissionRequest = null;
    }}
}}
"""
    write_file(path, content)


def apply_android_app_metadata(config):
    """把 args.yaml 的基础信息应用到 Android 构建产物"""
    app_name = config["name"]
    app_id = config["pkg"]
    version_name = config["version"].lstrip('v')
    icon_path = config.get("icon", "./icon.png")
    enable_zoom = bool(config.get("enable_zoom", True))
    status_bar_color = detect_navbar_background_color()
    status_bar_color_argb = status_bar_color
    if re.fullmatch(r"#[0-9a-fA-F]{6}", status_bar_color):
        status_bar_color_argb = "#ff" + status_bar_color[1:]

    # 1) 写入 capacitor.config.ts，包含状态栏配置
    capacitor_config_path = os.path.join(ANDROID_BUILD_DIR, "capacitor.config.ts")
    capacitor_config = f"""import {{ CapacitorConfig }} from '@capacitor/cli';

const config: CapacitorConfig = {{
  appId: '{app_id}',
  appName: '{app_name}',
  webDir: 'www',
  server: {{
    androidScheme: 'https'
  }},
  plugins: {{
    StatusBar: {{
      overlaysWebView: false,
      backgroundColor: '{status_bar_color_argb}'
    }}
  }}
}};

export default config;
"""
    write_file(capacitor_config_path, capacitor_config)
    log_success("已写入 capacitor.config.ts（含状态栏配置）")

    # 2) 同步 Android 字符串资源中的显示名和包名
    strings_xml_path = os.path.join(ANDROID_DIR, "app", "src", "main", "res", "values", "strings.xml")
    if update_file_by_regex(
        strings_xml_path,
        [
            (r"(<string name=\"app_name\">).*?(</string>)", rf"\1{xml_escape(app_name)}\2"),
            (r"(<string name=\"title_activity_main\">).*?(</string>)", rf"\1{xml_escape(app_name)}\2"),
            (r"(<string name=\"package_name\">).*?(</string>)", rf"\1{xml_escape(app_id)}\2"),
            (r"(<string name=\"custom_url_scheme\">).*?(</string>)", rf"\1{xml_escape(app_id)}\2"),
        ],
    ):
        log_success("已同步 strings.xml 的应用名/包名")

    # 3) 同步 Gradle 的 namespace/applicationId/versionName
    app_build_gradle_path = os.path.join(ANDROID_DIR, "app", "build.gradle")
    if update_file_by_regex(
        app_build_gradle_path,
        [
            (r'namespace\s+"[^"]+"', f'namespace "{app_id}"'),
            (r'applicationId\s+"[^"]+"', f'applicationId "{app_id}"'),
            (r'versionName\s+"[^"]+"', f'versionName "{version_name}"'),
        ],
    ):
        log_success("已同步 app/build.gradle 的包名与版本号")

    # 4) 写入 MainActivity（修正包名 + 处理麦克风权限）
    main_activity_paths = list(
        Path(ANDROID_DIR).glob("app/src/main/java/**/MainActivity.java")
    ) + list(
        Path(ANDROID_DIR).glob("app/src/main/java/**/MainActivity.kt")
    )
    for activity_path in main_activity_paths:
        if str(activity_path).lower().endswith(".java"):
            write_main_activity_java(str(activity_path), app_id, enable_zoom)
            log_success(f"已更新 MainActivity（含录音权限处理）: {activity_path}")
        else:
            if update_file_by_regex(
                str(activity_path),
                [
                    (r"^\s*package\s+[a-zA-Z0-9_.]+\s*;?", f"package {app_id}"),
                ],
            ):
                log_success(f"已同步 MainActivity 包名: {activity_path}")

    # 5) 同步状态栏颜色，保持与页面背景一致
    styles_xml_path = os.path.join(ANDROID_DIR, "app", "src", "main", "res", "values", "styles.xml")
    if os.path.exists(styles_xml_path):
        styles_xml = f"""<?xml version="1.0" encoding="utf-8"?>
<resources>

    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
        <item name="android:statusBarColor">{status_bar_color}</item>
        <item name="android:navigationBarColor">{status_bar_color}</item>
        <item name="android:windowLightStatusBar">true</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
        <item name="android:statusBarColor">{status_bar_color}</item>
        <item name="android:navigationBarColor">{status_bar_color}</item>
        <item name="android:windowLightStatusBar">true</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash</item>
        <item name="android:statusBarColor">{status_bar_color}</item>
        <item name="android:navigationBarColor">{status_bar_color}</item>
        <item name="android:windowLightStatusBar">true</item>
    </style>
</resources>
"""
        write_file(styles_xml_path, styles_xml)
        log_success(f"已同步状态栏颜色: {status_bar_color}")

    # 6) 同步启动图标到 Android 资源（强制使用普通 mipmap 图标，避免 adaptive 前景放大）
    source_icon = Path(icon_path)
    if not source_icon.is_absolute():
        source_icon = Path(os.getcwd()) / source_icon
    if source_icon.exists() and source_icon.is_file():
        mipmap_dirs = list(Path(ANDROID_DIR).glob("app/src/main/res/mipmap-*"))
        for mipmap_dir in mipmap_dirs:
            for target_name in ("ic_launcher.png", "ic_launcher_round.png"):
                target_icon = mipmap_dir / target_name
                if target_icon.exists():
                    shutil.copy2(str(source_icon), str(target_icon))

        # 移除 adaptive 图标定义，强制回退到普通 mipmap 图标，确保视觉比例与源图一致
        anydpi_v26 = Path(ANDROID_DIR) / "app" / "src" / "main" / "res" / "mipmap-anydpi-v26"
        for xml_name in ("ic_launcher.xml", "ic_launcher_round.xml"):
            xml_path = anydpi_v26 / xml_name
            if xml_path.exists():
                xml_path.unlink()

        log_success(f"已同步应用图标（普通 mipmap，保持原比例）: {source_icon}")
    else:
        log_warning(f"图标文件不存在，跳过 launcher 图标同步: {source_icon}")


def cleanup_legacy_root_assets():
    """清理 android_build 根目录里历史遗留的重复资源"""
    legacy_dirs = ["js", "yaml"]
    legacy_files = ["index.html", "icon.png"]

    for name in legacy_dirs:
        path = os.path.join(ANDROID_BUILD_DIR, name)
        if os.path.isdir(path):
            shutil.rmtree(path)
            log_info(f"已清理历史重复目录: {path}")

    for name in legacy_files:
        path = os.path.join(ANDROID_BUILD_DIR, name)
        if os.path.isfile(path):
            os.remove(path)
            log_info(f"已清理历史重复文件: {path}")


def build_audio_manifest(audio_root_dir):
    """为内置音频生成清单，供启动时预热到 CacheStorage"""
    audio_root = Path(audio_root_dir)
    files = []
    digest = hashlib.sha256()

    if not audio_root.exists():
        return {
            "version": "empty",
            "count": 0,
            "files": []
        }

    for file_path in sorted(audio_root.rglob("*")):
        if not file_path.is_file():
            continue
        rel = file_path.relative_to(audio_root).as_posix()
        size = file_path.stat().st_size
        files.append({"path": rel, "size": size})
        digest.update(rel.encode("utf-8"))
        digest.update(str(size).encode("utf-8"))

    return {
        "version": digest.hexdigest()[:16],
        "count": len(files),
        "files": files
    }


def cleanup_post_build_artifacts():
    """构建成功后清理 android_build 下可再生的构建产物（非依赖项）"""
    targets = [
        os.path.join(ANDROID_BUILD_DIR, "www"),
        os.path.join(ANDROID_DIR, "app", "build"),
        os.path.join(ANDROID_DIR, "build"),
        os.path.join(ANDROID_DIR, ".gradle"),
        os.path.join(ANDROID_DIR, "app", "src", "main", "assets", "public"),
    ]

    cleaned = 0
    for target in targets:
        try:
            if os.path.isdir(target):
                shutil.rmtree(target)
                log_info(f"已清理构建产物目录: {target}")
                cleaned += 1
            elif os.path.isfile(target):
                os.remove(target)
                log_info(f"已清理构建产物文件: {target}")
                cleaned += 1
        except Exception as e:
            log_warning(f"清理构建产物失败（可忽略，不影响 APK）: {target}, {e}")

    log_success(f"构建产物清理完成，共清理 {cleaned} 项")

# 初始化功能
def init():
    """初始化 Capacitor Android 项目"""
    if not check_environment():
        return False
    
    log_step("初始化 Capacitor Android 项目")
    
    # 创建必要的目录
    os.makedirs(ANDROID_BUILD_DIR, exist_ok=True)
    
    # 读取配置
    config = read_args_yaml()
    
    # 创建 package.json
    package_json = {
        "name": "shizi-android",
        "version": config["version"].lstrip('v'),
        "description": "识字 Android 应用",
        "main": "index.html",
        "scripts": {
            "build": "echo 'Build completed'",
            "sync": "npx cap sync"
        },
        "dependencies": {
            "@capacitor/core": "^5.0.0",
            "@capacitor/android": "^5.0.0"
        },
        "devDependencies": {
            "typescript": "^5.0.0",
            "@capacitor/cli": "^5.0.0"
        }
    }
    
    package_json_path = os.path.join(ANDROID_BUILD_DIR, "package.json")
    with open(package_json_path, 'w', encoding='utf-8') as f:
        json.dump(package_json, f, indent=2, ensure_ascii=False)
    log_success(f"创建 package.json 文件")
    
    # 安装依赖
    log_info("安装 Capacitor 依赖...")
    code, stdout, stderr = run_command(["npm", "install"], cwd=ANDROID_BUILD_DIR)
    if code != 0:
        log_error("安装依赖失败")
        return False
    log_success("依赖安装成功")
    
    # 初始化 Capacitor
    log_info("初始化 Capacitor...")
    # 使用绝对路径
    cap_cmd = os.path.abspath(os.path.join(ANDROID_BUILD_DIR, "node_modules", ".bin", "cap.cmd"))
    if not os.path.exists(cap_cmd):
        log_error(f"cap 命令不存在: {cap_cmd}")
        return False
    log_info(f"使用 cap 命令: {cap_cmd}")
    
    # 初始化时直接传入应用名称和包名，避免落回默认值
    code, stdout, stderr = run_command([cap_cmd, "init", config["name"], config["pkg"]], cwd=ANDROID_BUILD_DIR)
    if code != 0:
        log_error("初始化 Capacitor 失败")
        return False
    log_success("Capacitor 初始化成功")
    
    # 添加 Android 平台
    log_info("添加 Android 平台...")
    code, stdout, stderr = run_command([cap_cmd, "add", "android"], cwd=ANDROID_BUILD_DIR)
    if code != 0:
        log_error("添加 Android 平台失败")
        return False
    log_success("Android 平台添加成功")

    # 强制把 args.yaml 信息写入构建工程，避免后续步骤覆盖
    apply_android_app_metadata(config)
    
    # 配置 Gradle 使用本地分发包
    configure_local_gradle()
    
    # 配置 SDK 版本
    configure_sdk_version()
    
    log_success("项目初始化完成")
    return True

# 配置本地 Gradle 分发包
def configure_local_gradle():
    """配置使用本地 Gradle 分发包"""
    # 检查是否有本地 Gradle 分发包
    local_gradle_path = "C:\\Users\\Mi\\Downloads\\gradle-8.14.3-all.zip"
    if os.path.exists(local_gradle_path):
        # 复制到 Gradle 包装器目录
        gradle_wrapper_dir = "C:\\Users\\Mi\\.gradle\\wrapper\\dists\\gradle-8.14.3-all"
        os.makedirs(gradle_wrapper_dir, exist_ok=True)
        
        # 生成随机目录名（使用固定的名称，因为我们只需要一个目录）
        random_dir = "bhlb1v25mvn5uk2d4746t5w8lf"
        target_dir = os.path.join(gradle_wrapper_dir, random_dir)
        os.makedirs(target_dir, exist_ok=True)
        
        target_path = os.path.join(target_dir, "gradle-8.14.3-all.zip")
        if not os.path.exists(target_path):
            log_info("复制本地 Gradle 分发包...")
            try:
                shutil.copy2(local_gradle_path, target_path)
                log_success("本地 Gradle 分发包复制成功")
            except Exception as e:
                log_error(f"复制 Gradle 分发包失败: {e}")
        else:
            log_info("本地 Gradle 分发包已存在")
        
        # 修改 gradle-wrapper.properties 文件，使用本地 Gradle 版本
        gradle_wrapper_properties = os.path.join(ANDROID_DIR, "gradle", "wrapper", "gradle-wrapper.properties")
        if os.path.exists(gradle_wrapper_properties):
            try:
                with open(gradle_wrapper_properties, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # 替换 Gradle 版本
                content = content.replace('gradle-8.0.2-all.zip', 'gradle-8.14.3-all.zip')
                
                with open(gradle_wrapper_properties, 'w', encoding='utf-8') as f:
                    f.write(content)
                log_success("Gradle 版本配置为 8.14.3")
            except Exception as e:
                log_error(f"配置 Gradle 版本失败: {e}")
    else:
        log_warning("本地 Gradle 分发包不存在，将从网络下载")

# 配置 SDK 版本
def configure_sdk_version():
    """配置 Android SDK 版本"""
    if not os.path.exists(ANDROID_DIR):
        return
    
    # 检查 SDK 路径
    sdk_path = "D:\\SDK\\platforms"
    if not os.path.exists(sdk_path):
        log_warning("SDK 路径不存在，使用默认配置")
        return
    
    # 检查 android-34
    if not os.path.exists(os.path.join(sdk_path, "android-34")):
        log_warning("android-34 不存在，使用默认配置")
        return
    
    # 修改 build.gradle
    build_gradle_path = os.path.join(ANDROID_DIR, "app", "build.gradle")
    if os.path.exists(build_gradle_path):
        try:
            with open(build_gradle_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 替换 compileSdk 和 targetSdk
            content = content.replace('compileSdk 33', 'compileSdk 34')
            content = content.replace('targetSdk 33', 'targetSdk 34')
            
            with open(build_gradle_path, 'w', encoding='utf-8') as f:
                f.write(content)
            log_success("SDK 版本配置为 34")
        except Exception as e:
            log_error(f"配置 SDK 版本失败: {e}")

# 同步功能
def sync():
    """同步 Web 代码到 Android 项目"""
    log_step("同步 Web 代码到 Android 项目")
    
    # 创建 www 目录
    www_dir = os.path.join(ANDROID_BUILD_DIR, "www")
    os.makedirs(www_dir, exist_ok=True)
    log_info(f"创建 www 目录: {www_dir}")

    # 统一只使用 www 作为 Web 资源根目录，清理历史重复文件
    cleanup_legacy_root_assets()
    
    # 复制 index.html 到 www 目录
    if os.path.exists("index.html"):
        shutil.copy2("index.html", os.path.join(www_dir, "index.html"))
        log_success("复制 index.html 成功")
    else:
        log_error("index.html 不存在")
        return False
    
    # 复制 js 目录到 www 目录
    if os.path.exists("js"):
        js_dest = os.path.join(www_dir, "js")
        if os.path.exists(js_dest):
            shutil.rmtree(js_dest)
        shutil.copytree("js", js_dest)
        log_success("复制 js 目录成功")
    else:
        log_error("js 目录不存在")
        return False
    
    # 复制 yaml 目录到 www 目录
    if os.path.exists("yaml"):
        yaml_dest = os.path.join(www_dir, "yaml")
        if os.path.exists(yaml_dest):
            shutil.rmtree(yaml_dest)
        shutil.copytree("yaml", yaml_dest)
        log_success("复制 yaml 目录成功")
    else:
        log_error("yaml 目录不存在")
        return False

    # 复制内置音频到 www/audio，并生成音频清单
    if os.path.exists(BUILTIN_AUDIO_SRC_DIR):
        if os.path.exists(BUILTIN_AUDIO_WWW_DIR):
            shutil.rmtree(BUILTIN_AUDIO_WWW_DIR)
        shutil.copytree(BUILTIN_AUDIO_SRC_DIR, BUILTIN_AUDIO_WWW_DIR)
        log_success(f"复制内置音频目录成功: {BUILTIN_AUDIO_SRC_DIR} -> {BUILTIN_AUDIO_WWW_DIR}")

        audio_manifest = build_audio_manifest(BUILTIN_AUDIO_WWW_DIR)
        with open(BUILTIN_AUDIO_MANIFEST, "w", encoding="utf-8") as f:
            json.dump(audio_manifest, f, ensure_ascii=False, indent=2)
        log_success(f"生成内置音频清单成功: {BUILTIN_AUDIO_MANIFEST} (共 {audio_manifest['count']} 个文件)")
    else:
        log_warning(f"内置音频目录不存在，跳过打包: {BUILTIN_AUDIO_SRC_DIR}")
    
    # 复制 args.yaml 指定图标到 www 目录
    config = read_args_yaml()
    source_icon = config.get("icon", "./icon.png")
    if os.path.exists(source_icon):
        shutil.copy2(source_icon, os.path.join(www_dir, "icon.png"))
        log_success(f"复制图标成功: {source_icon} -> www/icon.png")
    else:
        log_warning(f"图标文件不存在: {source_icon}")
    
    # 执行 Capacitor 同步
    config = read_args_yaml()
    apply_android_app_metadata(config)

    log_info("执行 Capacitor 同步...")
    code, stdout, stderr = run_command(["npx.cmd", "cap", "sync"], cwd=ANDROID_BUILD_DIR)
    if code != 0:
        log_error("Capacitor 同步失败")
        return False
    log_success("Capacitor 同步成功")

    # sync 后再次应用，防止 Android 项目中文件被默认值回写
    apply_android_app_metadata(config)
    
    # 配置 Android 权限
    configure_android_permissions()
    
    log_success("代码同步完成")
    return True

# 配置 Android 权限
def configure_android_permissions():
    """配置 Android 应用权限"""
    if not os.path.exists(ANDROID_DIR):
        return
    
    manifest_path = os.path.join(ANDROID_DIR, "app", "src", "main", "AndroidManifest.xml")
    if not os.path.exists(manifest_path):
        log_error("AndroidManifest.xml 不存在")
        return
    
    try:
        with open(manifest_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查是否已添加权限
        permissions = [
            "<uses-permission android:name=\"android.permission.INTERNET\" />",
            "<uses-permission android:name=\"android.permission.READ_EXTERNAL_STORAGE\" />",
            "<uses-permission android:name=\"android.permission.WRITE_EXTERNAL_STORAGE\" />",
            "<uses-permission android:name=\"android.permission.RECORD_AUDIO\" />",
            "<uses-permission android:name=\"android.permission.MODIFY_AUDIO_SETTINGS\" />",
            "<uses-permission android:name=\"android.permission.MANAGE_EXTERNAL_STORAGE\" />",
            "<uses-permission android:name=\"android.permission.ACCESS_NETWORK_STATE\" />",
            "<uses-permission android:name=\"android.permission.ACCESS_WIFI_STATE\" />",
        ]
        
        # 在 </manifest> 前添加权限
        for permission in permissions:
            if permission not in content:
                content = content.replace('</manifest>', f'    {permission}\n</manifest>')
        
        with open(manifest_path, 'w', encoding='utf-8') as f:
            f.write(content)
        log_success("Android 权限配置成功")
    except Exception as e:
        log_error(f"配置 Android 权限失败: {e}")

# 构建功能
def build():
    """构建 APK 并复制到项目根目录"""
    config = read_args_yaml()

    # 先同步代码
    if not sync():
        return False
    
    log_step("构建 APK")
    
    if not os.path.exists(GRADLE_WRAPPER):
        log_error("Gradle 包装器不存在，请先执行 init 命令")
        return False
    
    # 执行 Gradle 构建
    log_info("执行 Gradle 构建...")
    # 使用绝对路径
    gradlew_cmd = os.path.abspath(GRADLE_WRAPPER)
    log_info(f"使用 Gradle 命令: {gradlew_cmd}")
    code, stdout, stderr = run_command([gradlew_cmd, "assembleDebug"], cwd=ANDROID_DIR)
    if code != 0:
        log_error("Gradle 构建失败")
        return False
    log_success("Gradle 构建成功")
    
    # 查找 APK 文件
    apk_pattern = os.path.join(ANDROID_DIR, "app", "build", "outputs", "apk", "debug", "*.apk")
    apk_files = list(Path(ANDROID_DIR).glob("app/build/outputs/apk/debug/*.apk"))
    
    if not apk_files:
        log_error("未找到生成的 APK 文件")
        return False
    
    apk_path = str(apk_files[0])
    log_success(f"找到 APK 文件: {apk_path}")
    
    # 复制到输出目录（按版本命名）
    out_dir = config.get("out_dir", ".")
    os.makedirs(out_dir, exist_ok=True)
    version_label = str(config.get("version", "v0.0")).strip() or "v0.0"
    safe_version_label = re.sub(r'[\\/:*?"<>|]', "_", version_label)
    dest_apk = os.path.join(out_dir, f"shizi_{safe_version_label}.apk")
    shutil.copy2(apk_path, dest_apk)
    log_success(f"APK 文件已复制到: {dest_apk}")

    # 构建完成后清理 android_build 下可再生产物，避免目录膨胀
    cleanup_post_build_artifacts()
    
    log_success("构建完成")
    return True

# 清理功能
def clean():
    """清理构建文件"""
    log_step("清理构建文件")
    config = read_args_yaml()
    
    # 清理 APK 文件（兼容旧命名和新命名）
    out_dir = config.get("out_dir", ".")
    apk_candidates = [
        "shizi-app-debug.apk",
        os.path.join(out_dir, "shizi-app-debug.apk"),
    ]
    apk_candidates.extend(str(p) for p in Path(".").glob("shizi_*.apk"))
    apk_candidates.extend(str(p) for p in Path(out_dir).glob("shizi_*.apk"))

    removed = set()
    for apk_file in apk_candidates:
        if apk_file in removed:
            continue
        if os.path.exists(apk_file):
            os.remove(apk_file)
            removed.add(apk_file)
            log_success(f"清理 APK 文件: {apk_file}")
    
    # 清理 Android 构建目录
    if os.path.exists(ANDROID_DIR):
        build_dir = os.path.join(ANDROID_DIR, "app", "build")
        if os.path.exists(build_dir):
            shutil.rmtree(build_dir)
            log_success("清理 Android 构建目录")
    
    # 清理 node_modules (可选)
    node_modules = os.path.join(ANDROID_BUILD_DIR, "node_modules")
    if os.path.exists(node_modules):
        log_info("清理 node_modules 目录...")
        shutil.rmtree(node_modules)
        log_success("清理 node_modules 目录成功")
    
    log_success("清理完成")
    return True

# 主函数
def main():
    parser = argparse.ArgumentParser(description='Android APK 构建脚本')
    parser.add_argument('command', choices=['init', 'sync', 'build', 'clean'], help='执行的命令')
    args = parser.parse_args()
    
    try:
        if args.command == 'init':
            init()
        elif args.command == 'sync':
            sync()
        elif args.command == 'build':
            build()
        elif args.command == 'clean':
            clean()
    except KeyboardInterrupt:
        log_error("用户中断操作")
        sys.exit(1)
    except Exception as e:
        log_error(f"发生错误: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
