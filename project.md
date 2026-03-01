# 识字项目文档（Project）

## 1. 项目概览

`shizi` 是一个以 Web 前端为核心的识字学习应用，通过 `Capacitor + Android` 打包成 APK。

当前项目状态（2026-03-01）：
- Web 主体代码：`index.html + js/*.js + yaml/*.yaml`
- Android 构建入口：`build.py`
- Android 工程目录：`android_build/`
- 最新 APK：`shizi_v3.0.apk`

---

## 2. 技术栈与运行形态

- 前端：原生 HTML/CSS/JS（ES Module）
- 数据格式：YAML（课程与内容）
- 音频与云端：Supabase（上传、记录、远端访问）
- Android 打包：Capacitor 5 + Gradle
- 构建脚本：Python（`build.py`）

运行模式：
- 浏览器模式：直接加载 Web 资源
- Android 模式：Web 资源同步到 `android_build/www`，由 Capacitor WebView 运行

---

## 3. 根目录结构（核心）

```text
shizi/
├─ index.html                  # 单页应用入口（含样式与脚本注入）
├─ js/                         # 前端模块（15 个）
├─ yaml/                       # 课程数据（5 个 yaml）
├─ shizi-audio-cache/          # 内置音频源目录（用于打包到 APK）
├─ android_build/              # Android 构建工作区
├─ args.yaml                   # 应用元信息与构建配置
├─ build.py                    # APK 构建主脚本
├─ icon.png                    # 应用图标源文件
└─ shizi_v3.0.apk              # 构建产物（版本命名）
```

统计：
- `js` 模块数：15
- `yaml` 数据文件：5
- 内置音频文件：1968
- 内置音频总大小：`80,190,563` bytes（约 76.5 MB）

---

## 4. 前端模块说明（`js/`）

- `main.js`：前端入口；初始化模块；启动时触发内置音频预热映射
- `app.js`：主业务流程（等级加载、单元导航、事件绑定、录音/播放按钮联动）
- `ui.js`：页面渲染与 HTML 辅助
- `state.js`：全局共享状态
- `position.js`：学习位置保存/恢复
- `learning.js`：学习视图、笔顺/练习逻辑
- `menu.js`：菜单、弹窗、统计、下载、缓存相关
- `batch-record.js`：批量录音
- `batch-play.js`：批量播放
- `audio-manager.js`：音频核心（录音、上传、播放、缓存、内置音频映射）
- `config.js`：Supabase 配置
- `constants.js`：常量
- `toast.js`：提示组件
- `platform-detector.js`：平台识别
- `js-yaml.min.js`：YAML 解析库（第三方）

---

## 5. 数据与资源

### 5.1 YAML 数据（`yaml/`）
- `contents_L0.yaml` ~ `contents_L3.yaml`：分级内容
- `hanzi_3500.yaml`：字库相关数据

### 5.2 内置音频（`shizi-audio-cache/`）
- 路径结构与 `audio-manager.js` 的 `getFilePath()` 规则一致
- 构建时会复制到 `android_build/www/audio/`
- 同时生成 `android_build/www/audio-manifest.json`

### 5.3 图标
- 源图：`icon.png`
- 构建时同步到 Android 各 `mipmap-*` 目录
- 为避免前景放大，构建脚本会删除 `mipmap-anydpi-v26` 下 adaptive 图标 XML，强制使用普通 `mipmap` 图标

---

## 6. 构建配置（`args.yaml`）

关键字段：
- `name`：应用名
- `pkg`：包名（如 `com.shizi`）
- `version`：版本（如 `v3.0`）
- `icon`：图标路径
- `out_dir`：APK 输出目录
- `enable_zoom`：双指缩放开关

`build.py` 会将这些信息写入：
- `android_build/capacitor.config.ts`
- `android_build/android/app/build.gradle`
- `android_build/android/app/src/main/res/values/strings.xml`
- `MainActivity` 包名等

---

## 7. APK 构建系统（`build.py`）

### 7.1 命令
- `python build.py init`：初始化 Capacitor Android 工程与依赖
- `python build.py sync`：同步 Web 资源到 `android_build/www`，并执行 `cap sync`
- `python build.py build`：`sync + Gradle assembleDebug + 复制 APK`
- `python build.py clean`：清理 APK、Android build 输出、`node_modules`

### 7.2 构建输出命名

当前规则：
- `shizi_<version>.apk`
- 例：`shizi_v3.0.apk`

### 7.3 构建关键流程

1. 读取并清洗 `args.yaml`
2. 同步 `index.html/js/yaml/icon` 到 `android_build/www`
3. 同步内置音频到 `www/audio` 并生成 `audio-manifest.json`
4. 写入 Android 元数据（包名、版本、应用名、状态栏等）
5. 执行 `npx cap sync`
6. `gradlew.bat assembleDebug`
7. 拷贝产物到根目录（版本命名）

---

## 8. `android_build` 结构与职责

```text
android_build/
├─ www/                         # Capacitor Web 资源根目录
│  ├─ index.html
│  ├─ js/
│  ├─ yaml/
│  ├─ audio/                    # 内置音频（构建复制）
│  └─ audio-manifest.json       # 内置音频清单
├─ android/                     # 原生 Android 工程（Gradle）
│  ├─ app/
│  │  ├─ src/main/              # Manifest、MainActivity、res 资源
│  │  └─ build/                 # 构建输出
│  ├─ gradle/
│  ├─ build.gradle
│  └─ gradlew.bat
├─ capacitor.config.ts          # Capacitor 配置（由 build.py 生成）
├─ package.json                 # Android 构建依赖
└─ README.md                    # Android 构建说明
```

说明：
- `android_build/README.md` 是说明文档，但部分历史描述（例如 APK 名称）可能落后于当前脚本实现，应以 `build.py` 为准。

---

## 9. 安卓特定实现（当前已落地）

### 9.1 录音权限
- 不在 App 启动时申请
- 仅在 WebView 发起麦克风权限请求时按需申请
- `MainActivity` 中实现 `WebChromeClient.onPermissionRequest` 与 `onRequestPermissionsResult` 联动

### 9.2 状态栏颜色
- 从前端样式 `--nav-bg` 推导
- 同步到 Capacitor StatusBar 配置和 Android 主题（`styles.xml`）

### 9.3 图标策略
- 使用普通 `mipmap` 图标，避免 adaptive 前景放大导致比例失真

### 9.4 内置音频策略
- 构建期：打包到 `www/audio`
- 启动期：读取 `audio-manifest.json` 建立“远端 URL -> 本地 asset URL”映射
- 播放期：缓存未命中时优先读内置音频，不做全量缓存复制（避免双份占用）

---

## 10. 常用维护操作

### 10.1 常用命令
```bash
python build.py clean
python build.py build
```

### 10.2 修改应用元信息
- 修改 `args.yaml` 后直接执行 `python build.py build`
- 包名/应用名/版本会自动写入 Android 工程

### 10.3 更新内置音频
- 更新 `shizi-audio-cache/` 内容
- 重新 `build` 后会自动刷新 `www/audio` 和 `audio-manifest.json`

---

## 11. 风险与注意事项

- APK 体积受内置音频影响较大（当前约 85MB）
- `clean` 会删除 `android_build/node_modules`，下次构建需要恢复依赖
- Android 本地 SDK/Gradle 路径目前包含机器相关硬编码（`build.py` 中可见）
- 依赖网络阶段（首次 npm/cap/gradle）可能受代理或权限影响

---

## 12. 关键文件清单（建议优先阅读）

- `build.py`：构建主逻辑与 Android 适配
- `args.yaml`：应用与构建参数
- `index.html`：页面结构与样式变量
- `js/main.js`：应用启动入口
- `js/audio-manager.js`：音频播放/录音/缓存核心
- `android_build/capacitor.config.ts`：Capacitor 实际配置
- `android_build/android/app/src/main/AndroidManifest.xml`：权限与组件声明

