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

### 4.1 核心应用模块

#### `main.js` —— 应用入口
- **职责**：前端应用的启动入口，负责初始化所有模块并触发应用启动流程
- **主要功能**：
  - 导入并初始化各功能模块（menu、learning、batch-record、batch-play）
  - 启动时后台预热内置音频缓存（`warmBuiltInAudioCache`），不阻塞页面初始化
  - 恢复上次保存的学习位置（等级、单元、教学模式状态）
  - 并行执行等级初始化和等级数据加载
  - 根据恢复的模式状态更新 UI

#### `app.js` —— 核心业务逻辑
- **职责**：处理应用的核心业务流程，包括等级加载、单元导航、搜索、事件绑定
- **主要功能**：
  - `initLevels()`：自动检测并初始化所有可用等级（L0、L1、L2...），动态生成等级选择按钮
  - `loadLevel(level, savedPos)`：加载指定等级的 YAML 数据，解析后缓存，填充单元选择下拉框
  - `searchChar(char)`：全库搜索指定汉字，跨所有等级数据查找
  - `switchTeachingMode(enable)`：切换教学/学习模式，更新按钮文字和 UI 状态
  - `setupEventListeners()`：绑定全局事件委托，处理播放/录音按钮点击（根据模式自动切换行为）
  - 批量播放控制（`learnBatchPlayback`）：支持单元内汉字的连续播放

#### `ui.js` —— UI 渲染工具
- **职责**：负责将数据渲染为 HTML，提供 HTML 工具函数
- **主要功能**：
  - `escapeHtml(str)`：HTML 转义，防止 XSS 攻击
  - `highlightChar(text, char)`：在文本中高亮显示目标汉字
  - `getBtnHtml(...)`：生成播放/录音按钮的 HTML，根据教学模式自动切换图标（播放/麦克风）
  - `renderUnit()`：渲染当前单元的所有汉字卡片，包含汉字、播放按钮、词组列表、例句
  - `renderSearchResult(...)`：渲染搜索结果（单个汉字卡片，显示所属等级和单元）

#### `state.js` —— 全局共享状态
- **职责**：管理应用的全局状态，提供缓存后缀机制
- **主要状态**：
  - `LEVELS`：可用等级列表
  - `currentLevel`：当前选中的等级
  - `currentData`：当前等级解析后的 YAML 数据
  - `levelDataCache`：各等级 YAML 数据缓存
  - `unitKeys`：当前等级的单元名称列表
  - `currentUnitIndex`：当前单元索引
  - `isTeachingMode`：是否处于教学模式
  - `isLoopingAudio`：是否正在循环播放音频
  - `writer`：HanziWriter 实例
  - `currentMode`：学习视图模式（'animate' | 'quiz'）
- **缓存机制**：`cacheSuffix` 用于页面刷新时绕过浏览器缓存

#### `position.js` —— 位置记忆
- **职责**：保存和恢复用户的学习位置
- **主要功能**：
  - `saveCurrentPosition()`：保存当前等级、单元索引、单元名称、教学模式状态到 localStorage
  - `loadSavedPosition()`：从 localStorage 读取上次保存的位置

### 4.2 学习相关模块

#### `learning.js` —— 学习视图
- **职责**：用户点击汉字后进入的全屏学习页面，集成 HanziWriter 实现笔顺演示和书写练习
- **主要功能**：
  - `enterLearning(char, level, unit)`：进入学习视图，初始化 HanziWriter，开始音频循环
  - `exitLearning()`：退出学习视图，停止音频，销毁 HanziWriter
  - `initWriter(char)`：创建 HanziWriter 实例，设置笔画颜色和动画参数
  - `switchMode(mode)`：切换演示模式（`animate`）和练习模式（`quiz`）
  - `animateStrokeByStroke()`：逐笔演示笔顺
  - `startQuizLogic()`：启动书写测验，用户手写笔画，逐笔判断对错，完成后保存进度到 Supabase
  - `startAudioLoop(...)`：循环播放当前汉字的音频
  - `updateLearningViewBtn()`：根据模式更新学习视图中播放/录音按钮的图标

### 4.3 菜单与弹窗模块

#### `menu.js` —— 菜单与弹窗
- **职责**：管理右上角菜单和所有弹窗功能
- **主要功能**：
  - 登录/注销：用户名登录（无密码），通过 Supabase `app_users` 表管理用户，新用户自动创建
  - 登录提醒：未登录时显示登录提醒横幅
  - 统计弹窗：显示待学习字总数、已配置语音数、最新录制语音
  - 学习进度：从 Supabase `user_progress` 表读取数据，按等级和单元分组展示已学汉字，支持点击跳转到对应单元
  - 下载语音：批量下载所有语音文件到浏览器 Cache API，显示下载进度
  - 清除缓存：清理已下载的语音缓存，显示清理的文件数和大小
  - 刷新页面：带进度条的页面刷新
  - 确认弹窗：通用确认弹窗组件

#### `toast.js` —— Toast 通知组件
- **职责**：轻量级通知组件
- **主要功能**：
  - `showToast(message, type)`：全局通知，显示 3 秒，支持 success、error、info 类型
  - `showQuizToast(message, type)`：练习模式专用通知，显示 2 秒
  - 使用 `textContent` 设置消息文本，防止 XSS 注入

### 4.4 批量处理模块

#### `batch-record.js` —— 批量录音
- **职责**：支持教师批量录制一个单元内所有汉字、词组、例句的音频
- **主要功能**：
  - `enterBatchRecord()`：进入批量录音视图
  - `getBatchItems()`：获取当前单元的所有录音项（按字分组，包含字、词、句）
  - 录音状态管理：记录已完成的录音项，支持缓存未上传的录音
  - 一键上传：批量上传所有录制好的音频到 Supabase
  - 键盘快捷键支持：支持空格键开始/停止录音，方向键切换项目

#### `batch-play.js` —— 批量播放
- **职责**：支持学生连续播放一个单元内所有汉字、词组、例句的音频
- **主要功能**：
  - `enterBatchPlay()`：进入批量播放视图
  - `getBatchItems()`：获取当前单元的所有播放项（字、词、句）
  - 队列播放：自动按顺序播放所有音频，支持暂停/继续
  - 单个播放：点击任意项单独播放
  - 进度追踪：标记已播放完成的项
  - 播放状态管理：管理当前播放状态、队列索引

### 4.5 音频管理模块

#### `audio-manager.js` —— 音频管理器
- **职责**：处理录音、上传、播放音频，通过 Supabase Storage 存储音频文件
- **主要功能**：
  - `init()`：初始化 Supabase 客户端
  - `getUnitCode(unit)`：将单元名称转换为数字编号（如"第一单元" -> "1"）
  - `getPinyin(char)`：使用 pinyin-pro 将汉字转换为拼音
  - `getFilePath(...)`：生成音频文件的存储路径，格式：`{level}/Unit_{n}/{pinyin}/{filename}.mp3`
    - `char.mp3`：汉字发音
    - `word_{n}.mp3`：第 n 个词组发音
    - `sentence.mp3`：例句发音
  - `startRecording()`：请求麦克风权限，启动 MediaRecorder
  - `stopRecording()`：停止录音，返回音频 Blob
  - `uploadAudio(...)`：上传音频到 Supabase Storage，同时写入 `audio_records` 表
  - `playAudio(...)`：播放音频，优先从 Cache API 读取，否则从 Supabase 拉取并缓存
  - `stopCurrentAudio()`：停止当前播放
  - `getAudioStats()`：获取音频统计（已录制字数、最新录音信息）
  - `getAllAudioRecords()`：获取所有音频记录（用于批量下载）
  - `warmBuiltInAudioCache()`：启动时预热内置音频映射
  - 内置音频管理：建立远端 URL 到本地 asset URL 的映射

### 4.6 工具模块

#### `constants.js` —— 常量定义
- **定义**：
  - `USER_KEY = 'shizi_user'`：localStorage 中存储用户名的键
  - `POSITION_KEY = 'shizi_position'`：localStorage 中存储浏览位置的键
  - `AUDIO_CACHE_NAME = 'shizi-audio-cache'`：Cache API 中音频缓存的名称
  - `TEACH_PASSWORD = 'kaishen'`：进入教学模式的密码

#### `config.js` —— Supabase 配置
- **职责**：定义 Supabase 连接信息
- **配置项**：
  - `url`：Supabase 项目 URL
  - `key`：Supabase 匿名密钥（Anon Key）
  - `bucket`：存储桶名称（`shizi-audio`）
- **注意**：暴露为全局变量 `SUPABASE_CONFIG`

#### `platform-detector.js` —— 平台检测工具
- **职责**：检测应用运行的平台环境
- **主要功能**：
  - `isNativePlatform()`：检测是否为原生平台（Android）
  - `isWebPlatform()`：检测是否为 Web 平台
  - `isAndroid()`：检测是否为 Android 平台
  - `getPlatform()`：获取当前平台名称（'android' | 'web'）
- **用途**：用于区分 Web 和 Android 环境的特定处理

#### `js-yaml.min.js` —— YAML 解析库（第三方）
- **职责**：解析 YAML 格式的课程数据文件
- **暴露**：全局变量 `jsyaml`

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

