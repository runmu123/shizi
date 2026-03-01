# 识字 Android 构建指南

## 项目简介

识字是一个用于学习汉字笔顺和书写的单页 Web 应用，本指南介绍如何将其打包为 Android APK。

## 目录结构

```
android_build/
├── android/          # Android 原生项目（自动生成）
├── js/               # 同步的 JavaScript 代码
├── yaml/             # 同步的课程数据
├── .gitignore        # Git 忽略文件
├── capacitor.config.ts  # Capacitor 配置文件
├── package.json      # 依赖管理文件
└── README.md         # 本指南
```

## 环境要求

### 系统要求
- **操作系统**: Windows 11
- **Python**: 3.7 或更高版本
- **Node.js**: v22.14.0 或更高版本
- **Java**: JDK 17.0.12 或更高版本
- **Gradle**: 8.12 或更高版本
- **Android SDK**: 包含 android-33 和 android-34

### SDK 路径
- SDK 路径: `D:\SDK\platforms`
- 本地 Gradle 分发包: `C:\Users\Mi\Downloads\gradle-8.14.3-all.zip`

## 构建步骤

### 1. 初始化项目

首次构建前需要初始化 Capacitor Android 项目：

```bash
# 在项目根目录执行
python build.py init
```

此命令会：
- 检查系统环境
- 创建必要的目录结构
- 初始化 Capacitor 项目
- 安装依赖包
- 添加 Android 平台支持
- 配置应用信息

### 2. 同步代码

当 Web 代码有变更时，需要同步到 Android 项目：

```bash
# 在项目根目录执行
python build.py sync
```

此命令会：
- 复制 `index.html` 到 Android 项目
- 复制 `js/` 目录到 Android 项目
- 复制 `yaml/` 目录到 Android 项目
- 复制 `icon.png` 到 Android 项目
- 执行 Capacitor 同步命令
- 配置 Android 权限

### 3. 构建 APK

执行构建命令生成 APK 文件：

```bash
# 在项目根目录执行
python build.py build
```

此命令会：
- 自动同步代码
- 调用 Gradle 构建命令
- 生成 APK 文件
- 复制 APK 到项目根目录

生成的 APK 文件：`shizi-app-debug.apk`

### 4. 清理构建文件

需要清理构建文件时执行：

```bash
# 在项目根目录执行
python build.py clean
```

此命令会：
- 清理 APK 文件
- 清理 Android 构建目录
- 清理临时文件

## 常见问题

### 1. 环境检查失败

**问题**: 构建脚本提示环境检查失败

**解决方案**:
- 确保安装了所有必要的软件（Node.js, Java, Gradle）
- 检查环境变量是否正确配置
- 确保 Python 版本为 3.7 或更高

### 2. Gradle 构建失败

**问题**: Gradle 构建过程中出现错误

**解决方案**:
- 检查 Android SDK 是否正确安装
- 确保 SDK 路径配置正确
- 检查网络连接是否正常（首次构建需要下载依赖）
- 尝试执行 `python build.py clean` 后重新构建

### 3. APK 生成失败

**问题**: 构建完成但未生成 APK 文件

**解决方案**:
- 检查 Gradle 构建日志中的错误信息
- 确保 Android SDK 版本与配置一致
- 检查磁盘空间是否充足

### 4. 应用安装失败

**问题**: APK 安装到设备时失败

**解决方案**:
- 检查设备是否允许安装未知来源的应用
- 确保设备 Android 版本与应用兼容
- 尝试清理设备上的旧版本应用后重新安装

## 权限配置

Android 应用需要以下权限：
- `INTERNET`: 用于音频下载和网络访问
- `READ_EXTERNAL_STORAGE`: 用于读取存储的音频文件
- `WRITE_EXTERNAL_STORAGE`: 用于缓存音频文件
- `RECORD_AUDIO`: 用于教学模式录音
- `MANAGE_EXTERNAL_STORAGE`: 用于高级存储访问
- `ACCESS_NETWORK_STATE`: 用于检测网络状态
- `ACCESS_WIFI_STATE`: 用于检测 WiFi 状态

## 平台检测

应用在运行时会检测当前环境：
- **Web 环境**: 正常加载 Web 资源
- **Android 环境**: 优化音频播放和缓存策略

## 构建优化

- 使用本地 Gradle 分发包，避免网络下载
- 配置 SDK 版本为 34，确保兼容性
- 启用 Gradle 缓存，提高构建速度
- 优化 APK 输出文件名格式

## 调试技巧

1. **查看构建日志**:
   - 构建过程中的详细日志会显示在命令行中
   - 错误信息会以红色显示，便于识别

2. **检查 Android 项目**:
   - 构建完成后，`android_build/android/` 目录包含完整的 Android 项目
   - 可以使用 Android Studio 打开该目录进行调试

3. **测试应用**:
   - 构建生成的 APK 文件位于项目根目录
   - 可以通过 ADB 或文件管理器安装到设备

## 版本说明

- 应用版本: v3.0
- 应用包名: com.shizi
- 应用名称: 识字

## 联系方式

如有问题，请联系项目维护者。
