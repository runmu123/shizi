# 项目上下文摘要

## 1. 项目定位

这是一个“识字学习应用”前端项目，Web 为主，同时通过 `build.py` 打包 Android APK。

核心能力：

- 按等级/单元组织内容
- 主页识字卡片学习
- 听音识字
- 看字识音
- 笔顺学习/书写练习
- 批量录音、批量播放
- 学习进度、录音进度
- 生字本/错题集
- Supabase 用户与数据存储

---

## 2. 核心文件

- `index.html`
  - 主页面唯一入口
  - 承载大量全局样式、页面结构、弹窗
- `js/main.js`
  - 启动入口
- `js/app.js`
  - 主流程控制、导航、练习逻辑、页面交互
- `js/ui.js`
  - 页面渲染层
- `js/menu.js`
  - 菜单、登录、下载、缓存、进度相关逻辑
- `js/learning.js`
  - 笔顺学习页逻辑
- `js/state.js`
  - 全局运行时状态
- `js/audio-manager.js`
  - 音频播放、录音、上传、缓存
- `build.py`
  - Android 构建与同步脚本
- `sql/`
  - 当前项目相关数据表解读文档

---

## 3. 当前页面结构

### 顶部

- 第一层旧导航栏已隐藏
- 当前只保留一条顶部工具栏 `.toolbar`
- 左侧标题动态显示：
  - `主页`
  - `其他`
  - `我的`
  - `听音识字`
  - `看字识音`
  - `笔顺学习`
  - `复习`
  - `练习`

### 底部导航

- `主页`
- `其他`
- `我的`

特殊规则：

- 在 `笔顺学习` / `听音识字` / `看字识音` 下
  - 底部“主页”会变成“回到主页”

---

## 4. 当前主要状态结构

定义在 `js/state.js`

### 页面级

- `state.appSection`
  - `home`
  - `other`
  - `profile`

- `state.profileView`
  - `main`
  - `notebookReview`
  - `notebookPractice`

### 主页单卡

- `state.homeCardIndex`
- `state.homeCardMotion`

### 生字本

- `state.notebook.items`
- `state.notebook.loading`
- `state.notebook.error`
- `state.notebook.loadedUser`
- `state.notebook.expandedSections.listen`
- `state.notebook.expandedSections.see`
- `state.notebook.reviewMode`
- `state.notebook.reviewGroupIndex`
- `state.notebook.reviewCardIndex`
- `state.notebook.reviewMotion`
- `state.notebook.practice`

### 学习进度卡片

- `state.profileProgress.expanded`
- `state.profileProgress.loading`
- `state.profileProgress.error`
- `state.profileProgress.loadedUser`
- `state.profileProgress.total`
- `state.profileProgress.grouped`

### 练习模式

- `state.mainViewMode`
  - `study`
  - `listen`
  - `see`

- `state.listenMode`
- `state.seeMode`

---

## 5. 当前已实现的关键功能

### 主页

- 纵向列表已改为单卡模式
- 支持：
  - 左右按钮切换
  - 键盘左右键切换
  - 触摸左右滑动
  - 点击单元字跳到对应卡片
- 卡片定位：
  - 在单元字排列下方
  - 在底部导航上方
  - 在该区域中居中
- 主页无滚动条占位问题处理方向：
  - 现在保留正常滚动逻辑
  - 已隐藏原生滚动条
  - 不显示 overlay 滚动条

### 听音识字 / 看字识音

- 内容区位于：
  - 进度卡片下方
  - 底部导航上方
- 播放按钮支持：
  - 点击播放
  - 再点停止
- 切到“其他/我的”时会立刻停音
- 单元朗读播放到新字时，主页卡片会自动切换到对应字

### 笔顺学习页

- 已移除：
  - 返回按钮
  - 拼音显示
- 内容整体上移
- quiz toast 已修复：
  - z-index 提升
  - 横向排版恢复
  - 相对头部定位，不再写死 `top`
- 完成书写后保存进度已改为：
  - `user_progress.upsert(...)`
  - 避免唯一键冲突

### 登录 / 我的页

- 头像背景色：`#25b7cb`
- 登录卡片状态支持实时刷新：
  - 登录
  - 注销
  - 切换账号

### 查询学习进度

- 不再通过弹窗展示
- 现在是“我的”页中的下拉卡片
- 右侧显示总数 + 下拉箭头
- 点击后原地展开
- 展开内容仍沿用原来的分组规则和样式体系
- 进入“我的”时会自动查询，并显示 toast：
  - `正在查询数据中...`

### 生字本 / 错题集

- “我的”页现在结构：
  1. 登录信息卡
  2. 查询学习进度卡
  3. 听音识字错题集
  4. 看字识音错题集

- 两个错题集：
  - 默认收起
  - 支持展开/收起动画
  - 每组最多 5 个字
  - 右侧显示总数
  - 支持：
    - `复习`
    - `练习`

- 复习页
  - 组切换
  - 返回
  - 卡片左右切换
  - 内容显示“误认为”
  - 每个误认字右侧有喇叭按钮

- 练习页
  - 听音错题 -> 听音识字练习
  - 看字错题 -> 看字识音练习
  - 看字识音练习会包含：
    - 原错字
    - 误认字

- 错误写入：
  - `listen` 出错时写 `user_mistakes`
  - `see` 出错时写 `user_mistakes`

---

## 6. 数据表相关

当前已知 Supabase 表：

- `app_users`
- `audio_records`
- `user_progress`
- `user_mistakes`

### `user_progress`

- 实际表里有 `id`
- 代码中目前没直接用 `id`
- 笔顺学习完成时会按：
  - `username,char,level,unit`
  做幂等 `upsert`

### `user_mistakes`

当前已使用字段：

- `username`
- `char`
- `level`
- `unit`
- `mistake_mode`
- `mistake_count`
- `wrong_chars`
- `last_wrong_at`
- `created_at`

唯一键：

- `username,char,level,unit,mistake_mode`

### 文档目录

`sql/` 下已存在：

- `README.md`
- `app_users.md`
- `audio_records.md`
- `user_progress.md`
- `user_mistakes.md`

---

## 7. Android 构建状态

### 构建脚本

- 使用 `python build.py build`

### 状态栏颜色

- 已修复 Android 状态栏颜色与顶部工具栏不一致问题
- `build.py` 现在优先读取 `.toolbar` 颜色
- 当前写入 Android 的颜色为：
  - `#f7e9cd`

### 产物

- 最新 APK：
  - `shizi_v4.0.apk`

---

## 8. 最近稳定结论

### 滚动条方案

- 用户最终决定：
  - 不做 overlay 自定义滚动条
  - 只保留“可滚动，但不显示滚动条”的现代化方案

### 查询学习进度显示格式

- 现在要求只显示数字
- 例如：
  - `第8单元` -> `8`
  - `第1组` -> `1`

当前实际表现：

- 学习进度行类似：
  - `8:`
  - `1:`
- 错题集分组类似：
  - `1：识，字`

---

## 9. 接手时要注意的点

1. 不要破坏：
   - `state.profileView`
   - `state.notebook.*`
   - `state.profileProgress.*`

2. 如果改“我的”页：
   - 现在它不是简单列表页
   - 已经包含登录、学习进度、生字本错题集三块逻辑

3. 如果改练习页：
   - `listen` / `see` / `notebookPractice` 三套交互代理共享部分选择器
   - 小心事件代理顺序

4. 如果改 Android 状态栏：
   - 优先看 `build.py`
   - 不要只改 `android_build` 产物，否则下次构建会覆盖

5. 如果继续做“查询学习进度”：
   - 旧弹窗逻辑还在 `menu.js`
   - 但“我的”页入口已经改成卡片内联展开
   - 优先延续当前卡片方案，不要回退到弹窗

---

## 10. 下一轮最可能继续做的事

如果继续开发，最自然的后续方向是：

1. 统一“查询学习进度”和错题集的数字显示细节
2. 继续打磨生字本复习/练习页面视觉
3. 细化“我的”页卡片间距与展开动画
4. 补更多 `user_mistakes` 相关行为，比如已复习标记或专项复习闭环

