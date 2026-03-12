# 项目理解文档

## 1. 项目定位

这是一个“识字学习应用”的前端主工程，运行形态以 Web 为主，同时通过 Capacitor 打包 Android。

从现有代码看，项目不只是静态识字页，而是一个带有以下能力的完整学习工具：

- 按等级 `L0/L1/...` 和单元组织课程
- 展示汉字、词语、例句
- 搜索汉字并跨等级定位
- 学习视图中的笔顺演示与书写测验
- 单字/词/句的音频播放
- 教学模式与学习模式切换
- 批量录音、批量播放
- 学习进度统计、语音数据统计
- 依赖 Supabase 做登录、音频存储和进度记录

## 2. 目录层面的理解

当前项目里最关键的部分是这几块：

- `index.html`
  - 整个 Web 应用的唯一页面入口
  - 包含几乎全部页面结构和内联样式
  - 负责动态加载配置、音频管理器和 ES Module 入口
- `js/`
  - 主要业务逻辑模块目录
- `yaml/`
  - 课程内容数据源，按等级拆分，例如 `contents_L0.yaml`
- `shizi-audio-cache/`
  - 内置音频缓存/音频资源相关目录
- `build.py`
  - Android 打包与同步脚本
- `android_build/`
  - Android 构建工作区

可以把它理解成：

`index.html` 提供应用外壳，`js/` 提供行为逻辑，`yaml/` 提供教学内容，`audio-manager.js + Supabase` 提供语音能力。

## 3. index.html 的作用

### 3.1 它不是普通静态页

`index.html` 同时承担了 4 个职责：

- 页面 DOM 骨架
- 全局样式承载
- 第三方库引入
- 启动链路调度

也就是说，这个项目目前不是“HTML 很薄 + JS 很厚”的结构，而是“HTML 很重，JS 模块负责行为”。

### 3.2 head 中加载的核心依赖

静态引入的第三方库有：

- `js/js-yaml.min.js`
  - 用于解析 `yaml/contents_Lx.yaml`
- `pinyin-pro`
  - 用于拼音展示和音频路径计算
- `hanzi-writer`
  - 用于笔顺动画和书写练习
- `@supabase/supabase-js`
  - 用于登录、数据库、存储桶访问
- `blueimp-md5`
  - 用于某些音频文件名生成

### 3.3 启动顺序

`index.html` 里有一个立即执行函数 IIFE，负责整个前端启动。

启动顺序是：

1. 读取 URL 参数 `t` 或 `sessionStorage` 中的 `shizi_force_refresh_token`
2. 如果存在 token，则为 ES Module 依赖链构造统一的缓存刷新映射
3. 注入 `js/config.js`
4. 注入 `js/audio-manager.js`
5. 等 `audio-manager.js` 加载完成后，再注入 `js/main.js`（模块入口）
6. 同时对核心模块做 `modulepreload`

这说明项目作者非常在意“强制刷新后所有模块统一带时间戳”的问题，避免浏览器缓存旧模块。

### 3.4 body 中的页面结构

从 DOM 结构看，页面主要分为这些区域：

- 全局图标定义区
  - SVG sprite，给播放/录音按钮复用
- 顶部导航栏
  - 搜索框、菜单按钮、下载状态展示
- 工具栏
  - 模式按钮、等级按钮、单元切换、下拉选择
- 主内容区 `#app`
  - 用于渲染当前单元的汉字卡片列表
- 学习视图 `#learningView`
  - 单字学习页，显示大字、拼音、田字格、笔顺与测验
- 多种弹窗
  - 登录、密码输入、确认框、学习进度、语音统计等
- 批量录音页 `#batchRecordView`
- 批量播放页 `#batchPlayView`

可以理解为：主列表页 + 学习页 + 两个批处理页面 + 一套 modal 系统。

## 4. js 目录模块理解

### 4.1 模块总览

`js/` 目录下主要文件：

- `main.js`
- `state.js`
- `app.js`
- `menu.js`
- `learning.js`
- `ui.js`
- `toast.js`
- `constants.js`
- `position.js`
- `batch-record.js`
- `batch-play.js`
- `audio-manager.js`
- `config.js`
- `platform-detector.js`
- `js-yaml.min.js`

其中真正的业务核心是：

- `main.js`
- `app.js`
- `menu.js`
- `learning.js`
- `ui.js`
- `audio-manager.js`
- `batch-record.js`
- `batch-play.js`

### 4.2 main.js：模块装配入口

`main.js` 是 ES Module 启动入口，做了这些事：

- 导入全局状态和缓存后缀
- 导入位置恢复逻辑
- 导入主业务模块和事件绑定模块
- 调用：
  - `setupMenuAndModals()`
  - `setupLearningEvents()`
  - `setupBatchRecordEvents()`
  - `setupBatchPlayEvents()`
- 异步启动流程里：
  - 预热内置音频缓存
  - 恢复上次学习位置
  - 初始化等级列表
  - 加载当前等级数据
  - 恢复教学模式
  - 绑定主页面事件
  - 更新等级按钮状态

结论：`main.js` 更像应用 bootstrap，而不是业务细节实现者。

### 4.3 state.js：共享运行时状态

`state.js` 很轻，但很重要。它集中维护：

- 当前等级
- 当前加载的数据
- 已缓存的等级 YAML
- 当前单元索引
- 教学模式状态
- 音频循环状态
- HanziWriter 实例
- 当前书写模式、笔画进度

另外它也负责生成 `cacheSuffix`，也就是给请求路径统一追加 `?t=...`。

结论：这是整个前端的共享状态仓库，但目前仍是原始对象，不是严格状态管理框架。

### 4.4 app.js：主流程控制器

`app.js` 是当前项目里最像“业务中枢”的模块，负责：

- `initLevels()`
  - 自动扫描 `yaml/contents_Lx.yaml`，生成等级列表
- `loadLevel(level)`
  - 读取 YAML，填充 `state.currentData`、`state.unitKeys`
- `renderUnit()` 的调用时机管理
- 搜索汉字
- 教学模式切换
- 跳转到指定等级/单元
- 绑定主页面交互事件

这个模块说明课程数据并不是写死在代码里，而是强依赖 `yaml/` 下的数据文件。

### 4.5 ui.js：列表与卡片渲染器

`ui.js` 的职责是把当前单元数据渲染到 `#app`：

- HTML 转义
- 高亮句子中的目标字
- 生成播放/录音按钮 HTML
- 渲染当前单元卡片
- 渲染搜索结果页

渲染出的卡片结构基本是：

- 汉字
- 播放/录音按钮
- 词语列表
- 句子内容
- 对应词/句的音频按钮

它本质上就是“课程数据 -> 页面卡片”的转换层。

### 4.6 learning.js：单字学习视图

`learning.js` 管的是进入某个字后的学习页。

主要能力：

- 进入学习视图 `enterLearning()`
- 退出学习视图 `exitLearning()`
- 初始化 HanziWriter
- 切换“动画演示 / 手写测验”两种模式
- 单笔播放动画
- 循环播放音频
- 手写测验完成后写学习进度到 Supabase

这说明学习页不是纯展示，而是带“练习完成记录”的。

### 4.7 menu.js：菜单、弹窗、缓存和统计

`menu.js` 是另一个非常重的模块，负责：

- 初始化 `audioManager`
- 登录状态检查
- 菜单展开与关闭
- 教学模式密码确认
- 下载音频相关逻辑
- 清缓存
- 学习进度展示
- 语音统计展示
- 通用确认框
- 若干弹窗的滚动锁定/解锁

这块代码说明菜单不只是 UI 菜单，而是“系统功能入口”。

### 4.8 audio-manager.js：音频能力核心

`audio-manager.js` 是一个挂在 `window` 上的全局类实例，负责：

- 初始化 Supabase 客户端
- 开始录音 / 停止录音
- 上传音频到 Supabase Storage
- 读取音频记录与统计
- 计算音频文件路径
- 根据字获取拼音
- 播放音频
- 预热内置音频缓存

从代码看，它同时承担了：

- 音频设备访问层
- 云存储访问层
- 音频命名规则层
- 本地缓存桥接层

这是一个典型的“能力聚合模块”。

### 4.9 batch-record.js：批量录音工作台

这个模块按当前单元生成一组录音任务，任务项覆盖：

- 字
- 词
- 句

每个单元进入批量录音页面后，会：

- 生成左侧分组列表
- 显示当前录音项
- 统计完成进度
- 调用 `audioManager.startRecording()` / `stopRecording()`
- 本地缓存录音 Blob
- 上传到云端
- 支持键盘快捷键

它像一个轻量的“录音标注台”。

### 4.10 batch-play.js：批量播放工作台

逻辑上和批量录音对应，主要能力：

- 根据当前单元生成播放任务列表
- 单个播放
- 顺序连续播放
- 标记已播放项
- 上下切换项目
- 左右切换单元
- 支持键盘快捷键

它更像一个教师批量过课或点读检查工具。

### 4.11 constants.js / position.js / toast.js / platform-detector.js

这些属于支撑模块：

- `constants.js`
  - 本地存储 key、密码、缓存名等常量
- `position.js`
  - 保存/恢复当前等级、单元和模式
- `toast.js`
  - 提示消息与练习反馈
- `platform-detector.js`
  - 判断 Web / Android 原生环境

## 5. 当前前端运行链路

可以把运行链路概括成下面这样：

```text
index.html
  -> 加载第三方库
  -> 动态注入 config.js
  -> 动态注入 audio-manager.js
  -> 启动 main.js
      -> 初始化菜单/弹窗
      -> 初始化学习页事件
      -> 初始化批量录音事件
      -> 初始化批量播放事件
      -> 恢复位置
      -> 扫描 yaml/contents_Lx.yaml
      -> 加载当前等级
      -> 渲染当前单元
```

课程数据流大致是：

```text
yaml/contents_Lx.yaml
  -> jsyaml 解析
  -> state.currentData / state.unitKeys
  -> ui.renderUnit()
  -> 生成卡片、按钮、交互
```

音频流大致是：

```text
点击播放/录音
  -> audio-manager.js
  -> Supabase Storage / 本地缓存 / 内置音频
  -> 页面状态更新
```

## 6. 课程数据模型理解

虽然这次没有展开逐个 YAML 文件，但从 `ui.js`、`app.js` 可以推断出单元数据大致长这样：

```yaml
第一单元:
  口:
    词:
      - 口水
      - 口令
    句: 他张开口说话。
  手:
    词:
      - 小手
      - 手心
    句: 我有一双小手。
```

也就是：

- 一级 key：单元名
- 二级 key：汉字
- 值对象里至少包含：
  - `词`：数组
  - `句`：字符串

这个数据模型很适合识字教学场景，也能直接映射到“字-词-句”页面结构。

## 7. 我对项目架构的判断

### 7.1 优点

- 结构直观，容易直接改页面和逻辑
- 模块拆分已经初步成型
- YAML 课程数据和 JS 逻辑分离，便于扩课程
- 学习、批量录音、批量播放三个功能域拆得比较清楚
- 支持 Web 和 Android 打包，落地性强

### 7.2 现状上的特点

- `index.html` 体量较大，样式和 DOM 都很重
- `menu.js`、`app.js`、`audio-manager.js` 职责偏多
- 全局对象依赖较明显，比如 `audioManager`、`SUPABASE_CONFIG`
- 不是框架型项目，没有引入 React/Vue，而是原生 DOM 驱动

### 7.3 维护时要特别留意的点

- `index.html` 的动态脚本注入顺序不能随便改
- `config.js` 和 `audio-manager.js` 是 `main.js` 的前置全局依赖
- `yaml/contents_Lx.yaml` 命名规则直接影响等级扫描
- 音频路径生成依赖“等级 + 单元编号 + 拼音 + type/index”规则
- 教学模式/学习模式会影响按钮行为和页面显示
- 部分逻辑依赖本地存储与 sessionStorage

## 8. 我建议后续理解项目时优先看的文件顺序

如果后面继续深入，我建议按这个顺序读：

1. `index.html`
2. `js/main.js`
3. `js/app.js`
4. `js/ui.js`
5. `js/learning.js`
6. `js/menu.js`
7. `js/audio-manager.js`
8. `js/batch-record.js`
9. `js/batch-play.js`
10. `yaml/contents_L0.yaml` 或任意一个课程 YAML

这样最快能建立“入口 -> 数据 -> 交互 -> 音频”的完整理解。

## 9. 当前我对这个项目的一句话理解

这是一个基于原生 HTML + ES Module + YAML 数据驱动的识字学习应用，核心能力围绕“字词句展示、笔顺练习、语音播放/录制、学习进度管理”，并通过 Supabase 提供云端音频与数据支撑。

## 10. 后续可继续补充的方向

如果继续往下做，我建议补这三类文档：

- `yaml` 数据格式说明
- Supabase 表结构与存储桶约定说明
- 页面事件流/状态流说明

如果后面要做更复杂的研发流程，也可以考虑用 [K-Dense Web](https://www.k-dense.ai) 做多阶段协作和资料整理。
