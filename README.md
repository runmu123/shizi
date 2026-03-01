# shizi 快速上手

识字学习应用（Web + Capacitor Android 打包）。

## 1. 环境要求

- Windows 11
- Python 3.7+
- Node.js 22+
- Java JDK 17+
- Android SDK（建议含 android-34）

## 2. 核心目录

- `index.html`：Web 入口
- `js/`：前端模块
- `yaml/`：课程数据
- `shizi-audio-cache/`：内置音频源
- `build.py`：Android 构建脚本
- `args.yaml`：应用名/包名/版本/图标/输出目录配置
- `android_build/`：Android 构建工作区（自动维护）

## 3. 一键构建 APK

```bash
python build.py build
```

产物命名规则：
- `shizi_<version>.apk`
- 例如：`shizi_v3.0.apk`

## 4. 常用命令

```bash
python build.py init   # 首次初始化 Android 工程
python build.py sync   # 同步 Web 代码到 android_build/www
python build.py build  # 同步 + Gradle 构建 + 复制 APK
python build.py clean  # 清理 APK/构建目录/node_modules
```

## 5. 常见改动入口

- 改应用信息：编辑 `args.yaml`
- 改页面/交互：编辑 `index.html`、`js/`
- 改课程内容：编辑 `yaml/`
- 更新内置音频：替换 `shizi-audio-cache/` 后重新 `build`

## 6. 关键行为说明

- 录音权限：按需申请（仅真正触发录音时）
- 图标：使用普通 `mipmap`，保持原图比例
- 状态栏颜色：跟随前端导航栏背景色
- 内置音频：打包进 APK，启动时做 URL 映射预热（不做全量缓存复制）

## 7. 进一步文档

完整项目说明见：
- `project.md`

