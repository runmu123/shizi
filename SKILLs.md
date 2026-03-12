# 前端开发风格规范（SKILLs）

> 本文档抽象自现代 Web 开发实践，代表开发者的前端开发风格偏好和最佳实践。

---

## 📋 目录

- [架构风格](#架构风格)
- [代码组织](#代码组织)
- [UI 组件偏好](#ui 组件偏好)
- [状态管理](#状态管理)
- [样式规范](#样式规范)
- [异步处理](#异步处理)
- [安全规范](#安全规范)
- [性能优化](#性能优化)
- [错误处理](#错误处理)
- [命名约定](#命名约定)

---

## 🏗️ 架构风格

### 1. 模块化架构

**偏好**：单一职责的 ES Module 模块

```javascript
// ✅ 推荐：每个模块职责单一
// ui.js - 只负责 UI 渲染
export function renderList() { ... }
export function renderDetail() { ... }

// state.js - 只负责状态管理
export const state = { ... }

// app.js - 只负责业务逻辑
export async function loadData() { ... }
```

```javascript
// ❌ 避免：大文件混杂多个职责
// everything.js - 包含 UI、逻辑、状态等所有内容
```

### 2. 数据驱动设计

**偏好**：配置与代码分离，使用 YAML/JSON 管理数据

```yaml
# ✅ 推荐：数据配置文件
items:
  - id: 1
    name: 示例
    children:
      - 子项 1
      - 子项 2
```

```javascript
// 代码加载配置
import jsyaml from 'js-yaml';
const data = jsyaml.load(yamlText);
```

### 3. 工具类封装

**偏好**：静态工具类或纯函数

```javascript
// ✅ 推荐：静态工具类
class Utils {
  static isMobile() { ... }
  static isWeb() { ... }
  static getPlatform() { ... }
}

// 或纯函数工具
export function formatString(str) { ... }
export function highlightText(text, keyword) { ... }
```

---

## 📁 代码组织

### 1. 目录结构

```
project/
├── index.html          # 单页应用入口
├── js/
│   ├── main.js         # 应用入口
│   ├── app.js          # 核心业务逻辑
│   ├── ui.js           # UI 渲染工具
│   ├── state.js        # 全局状态
│   ├── constants.js    # 常量定义
│   ├── config.js       # 配置文件
│   ├── [feature].js    # 功能模块
│   └── [util].js       # 工具模块
├── data/               # 数据配置
├── css/                # 样式文件（如有）
└── assets/             # 静态资源
```

### 2. 模块导入顺序

```javascript
// ✅ 推荐：按类型分组导入
// 1. 核心模块
import { state } from './state.js';
import { showToast } from './toast.js';

// 2. 功能模块
import { renderList } from './ui.js';
import { enterDetail } from './detail.js';

// 3. 工具模块
import Utils from './utils.js';
```

### 3. 导出风格

**偏好**：具名导出为主，默认导出为辅

```javascript
// ✅ 推荐：具名导出（多个函数）
export function funcA() { ... }
export function funcB() { ... }
export const constant = 'value';

// ✅ 推荐：默认导出（单个类/工具）
export default class MyClass { ... }
export default Utils;
```

---

## 🎨 UI 组件偏好

### 1. 弹窗组件

#### Toast 通知（首选）

**偏好**：轻量级 Toast，自动消失

```javascript
// ✅ 推荐：使用 Toast
import { showToast } from './toast.js';

showToast('操作成功', 'success');
showToast('发生错误', 'error');
showToast('提示信息', 'info');
```

**Toast 类型**：
- `success` - 成功提示（绿色，带勾图标）
- `error` - 错误提示（红色，带叉图标）
- `info` - 普通提示（蓝色，带信息图标）

**特殊场景**：
```javascript
// 练习模式专用 Toast（显示 2 秒）
import { showQuizToast } from './toast.js';
showQuizToast('操作正确', 'success');
```

#### 确认弹窗

**偏好**：通用确认弹窗组件

```javascript
// ✅ 推荐：使用确认弹窗
function showConfirm(title, message, onConfirm) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmCallback = onConfirm;
  confirmModal.style.display = 'flex';
}
```

#### 模态弹窗

**偏好**：带滚动锁定和背景遮罩

```javascript
// ✅ 推荐：锁定滚动
function lockScroll() {
  scrollPosition = window.scrollY;
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollPosition}px`;
}

function unlockScroll() {
  document.body.style.overflow = '';
  document.body.style.position = '';
  window.scrollTo(0, scrollPosition);
}
```

### 2. 按钮组件

**偏好**：语义化类名 + 图标

```html
<!-- ✅ 推荐：带图标的按钮 -->
<button class="play-btn" title="播放">
  <svg><use href="#icon-play"></use></svg>
</button>

<button class="control-btn primary">
  主要操作
</button>
```

### 3. 卡片组件

**偏好**：圆角 + 阴影 + 悬停效果

```css
.card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s, box-shadow 0.2s;
}

.card:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}
```

---

## 🗄️ 状态管理

### 1. 集中式状态

**偏好**：单一状态源（类似 Vuex 简化版）

```javascript
// ✅ 推荐：state.js
export const state = {
  items: [],
  currentItem: null,
  dataCache: {},
  keys: [],
  currentIndex: 0,
  isEditMode: false,
  isPlaying: false,
  component: null,
  currentMode: 'view',
};
```

### 2. 状态持久化

**偏好**：LocalStorage + 云端双持久化

```javascript
// ✅ 本地持久化
export function saveCurrentPosition() {
  const data = {
    currentId: state.currentId,
    index: state.currentIndex,
    isEditMode: state.isEditMode,
    timestamp: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ✅ 云端持久化
await api.saveProgress({ 
  userId, 
  itemId, 
  completedAt: new Date() 
});
```

### 3. 状态变更通知

**偏好**：手动触发 UI 更新

```javascript
// ✅ 推荐：状态变更后手动渲染
state.currentIndex = newIndex;
renderList(); // 手动触发渲染
```

---

## 🎨 样式规范

### 1. CSS 变量

**偏好**：定义设计系统变量

```css
:root {
  /* 主题色 */
  --primary-color: #d97706;
  --primary-hover: #b45309;
  
  /* 背景色 */
  --bg-color: #fef3c7;
  --card-bg: #fff;
  
  /* 文字色 */
  --text-color: #1c1917;
  --highlight-color: #dc2626;
  
  /* 边框色 */
  --border-color: #fca5a5;
  --line-color: #fecaca;
}
```

### 2. 命名约定

**偏好**：语义化类名，BEM 简化版

```css
/* ✅ 推荐：语义化命名 */
.detail-view
.detail-view.active
.item-header
.item-with-btn
.play-btn
.control-btn
.control-btn.primary
.nav-btn
.nav-btn:disabled
```

### 3. 响应式设计

**偏好**：移动端优先，弹性布局

```css
/* ✅ 推荐：弹性布局 */
.text-btn-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  width: 100%;
}

/* 动态计算尺寸 */
.container {
  width: min(300px, calc(100vw - 60px));
  height: min(300px, calc(100vw - 60px));
}
```

### 4. 动画过渡

**偏好**：轻量过渡，200-300ms

```css
.btn {
  transition: all 0.2s;
}

.btn:hover {
  transform: scale(1.05);
  background: var(--primary-color);
}

.modal {
  transition: opacity 0.3s ease;
}
```

---

## ⚡ 异步处理

### 1. Async/Await

**偏好**：使用 async/await 而非 Promise 链

```javascript
// ✅ 推荐：async/await
export async function loadData() {
  try {
    const response = await fetch(`data/items.json`);
    const text = await response.text();
    const data = JSON.parse(text);
    return data;
  } catch (err) {
    console.error('加载失败:', err);
    throw err;
  }
}
```

### 2. 并行执行

**偏好**：Promise.all 并行执行独立任务

```javascript
// ✅ 推荐：并行执行
const initPromise = initModules();
await loadData(currentId, savedPos);
await initPromise;
```

### 3. 后台任务

**偏好**：不阻塞主线程的后台任务

```javascript
// ✅ 推荐：后台预热，不阻塞
module
  .warmCache()
  .catch((err) => {
    console.warn('后台任务失败:', err);
  });
```

---

## 🔒 安全规范

### 1. XSS 防护

**偏好**：所有用户输入必须转义

```javascript
// ✅ 必须：HTML 转义工具
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ✅ 必须：使用 textContent 而非 innerHTML
const span = document.createElement('span');
span.textContent = message; // 安全

// ❌ 禁止：直接拼接用户输入
element.innerHTML = `<div>${userInput}</div>`; // 危险！
```

### 2. 正则注入防护

**偏好**：使用 split/join 替代 regex

```javascript
// ✅ 推荐：split/join 替代 regex
export function highlightText(text, keyword) {
  const safeText = escapeHtml(text);
  const safeKeyword = escapeHtml(keyword);
  return safeText.split(safeKeyword).join(
    `<span class="highlight">${safeKeyword}</span>`
  );
}

// ❌ 避免：动态构建 regex
const regex = new RegExp(keyword, 'g'); // 可能注入
```

### 3. 敏感信息

**偏好**：常量集中管理，不硬编码

```javascript
// ✅ 推荐：constants.js
export const USER_KEY = 'current_user';
export const STORAGE_KEY = 'app_storage';
export const API_PASSWORD = 'default';

// ❌ 避免：代码中硬编码
localStorage.setItem('current_user', value);
```

---

## 🚀 性能优化

### 1. 缓存策略

**偏好**：缓存后缀 + 多级缓存

```javascript
// ✅ 缓存后缀机制
export const cacheSuffix = refreshToken 
  ? `?t=${encodeURIComponent(refreshToken)}` 
  : '';

fetch(`data/items.json${cacheSuffix}`);
```

```javascript
// ✅ 内存缓存
state.dataCache = {};

export async function loadData(id) {
  let data = state.dataCache[id];
  if (!data) {
    // 从网络加载并缓存
    data = await fetchJson(id);
    state.dataCache[id] = data;
  }
  return data;
}
```

### 2. 预加载

**偏好**：关键资源预加载

```html
<!-- ✅ 推荐：modulepreload -->
<link rel="modulepreload" href="js/main.js">
<link rel="modulepreload" href="js/state.js">
<link rel="modulepreload" href="js/app.js">
```

### 3. 懒加载

**偏好**：非关键资源懒加载

```javascript
// ✅ 推荐：后台预热，不阻塞
(async () => {
  // 先初始化页面
  setupUI();
  
  // 后台预热数据
  if (module.warmCache) {
    module.warmCache();
  }
})();
```

### 4. 事件委托

**偏好**：事件委托而非逐个绑定

```javascript
// ✅ 推荐：事件委托
document.addEventListener('click', (e) => {
  if (e.target.matches('.play-btn')) {
    handlePlay(e);
  } else if (e.target.matches('.item-link')) {
    handleItemClick(e);
  }
});

// ❌ 避免：逐个绑定
document.querySelectorAll('.play-btn').forEach(btn => {
  btn.addEventListener('click', handlePlay);
});
```

---

## ❌ 错误处理

### 1. Try-Catch 包裹

**偏好**：异步操作必须 try-catch

```javascript
// ✅ 推荐：完整的错误处理
export async function loadData(id) {
  try {
    const response = await fetch(`data/items/${id}.json`);
    if (!response.ok) {
      throw new Error(`HTTP 错误！状态码：${response.status}`);
    }
    const data = JSON.parse(text);
    if (!data) throw new Error('数据为空');
    return data;
  } catch (err) {
    console.error('加载数据失败:', err);
    showErrorUI(err);
  }
}
```

### 2. 友好错误提示

**偏好**：用户友好的错误信息

```javascript
// ✅ 推荐：友好的错误提示
showToast('加载失败：' + (err?.message || err), 'error');

// ❌ 避免：技术术语堆砌
showToast('Error: NetworkError when attempting to fetch', 'error');
```

### 3. 错误日志

**偏好**：详细错误日志便于调试

```javascript
// ✅ 推荐：详细日志
console.error('保存进度出错:', error);
console.error('错误详情:', error.message, error.hint);
```

---

## 🏷️ 命名约定

### 1. 变量命名

**偏好**：语义化命名，驼峰式

```javascript
// ✅ 推荐
const currentId = '1';
const itemKeys = [];
const isEditMode = false;
const dataCache = {};

// ❌ 避免
const id = '1';
const arr = [];
const flag = false;
```

### 2. 函数命名

**偏好**：动词 + 名词，清晰表达意图

```javascript
// ✅ 推荐
export function loadData() { ... }
export function renderList() { ... }
export function saveCurrentPosition() { ... }
export function switchEditMode() { ... }

// ❌ 避免
export function data() { ... }
export function list() { ... }
export function save() { ... }
```

### 3. 常量命名

**偏好**：全大写下划线分隔

```javascript
// ✅ 推荐
export const USER_KEY = 'current_user';
export const STORAGE_KEY = 'app_storage';
export const API_PASSWORD = 'default';

// ❌ 避免
export const userKey = 'current_user';
export const ApiPassword = 'default';
```

### 4. CSS 类名

**偏好**：小写短横线分隔

```css
/* ✅ 推荐 */
.detail-view
.item-header
.play-btn
.control-btn.primary

/* ❌ 避免 */
.detailView
.ItemHeader
.playBtn
```

---

## 🎯 开发原则总结

### 核心原则

1. **单一职责**：每个模块只做一件事
2. **配置分离**：数据与代码分离
3. **安全优先**：所有输入必须转义
4. **性能优化**：缓存 + 预加载
5. **用户友好**：错误提示清晰易懂
6. **代码复用**：封装可复用组件
7. **状态可预测**：集中式状态管理
8. **渐进增强**：后台任务不阻塞主流程

### 代码质量指标

- ✅ 无注释代码自解释
- ✅ 函数不超过 50 行
- ✅ 模块不超过 500 行
- ✅ 无全局变量污染
- ✅ 无硬编码字符串
- ✅ 100% XSS 防护
- ✅ 关键路径错误处理

---

## 📚 参考示例

### 完整组件示例

```javascript
// ✅ 推荐的组件结构
// js/toast.js
const ICONS = {
  success: '<svg>...</svg>',
  error: '<svg>...</svg>',
  info: '<svg>...</svg>',
};

function createToastElement(message, type) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  if (ICONS[type]) {
    const iconWrapper = document.createElement('span');
    iconWrapper.innerHTML = ICONS[type];
    toast.appendChild(iconWrapper);
  }
  
  const span = document.createElement('span');
  span.textContent = message; // 安全：防止 XSS
  toast.appendChild(span);
  
  return toast;
}

export function showToast(message, type = 'default') {
  const container = document.getElementById('toastContainer');
  container.innerHTML = '';
  
  const toast = createToastElement(message, type);
  container.appendChild(toast);
  
  setTimeout(() => toast.remove(), 3000);
}

export function showQuizToast(message, type = 'success') {
  // 特殊场景的 Toast
  const container = document.getElementById('quizToastContainer');
  const toast = createToastElement(message, type);
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}
```

---

## 📝 更新日志

- **2026-03-02**：初始版本，抽象自现代 Web 开发实践

---

**文档维护**：本文档应随项目发展持续更新，反映最新的开发风格偏好。
