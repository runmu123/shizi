// 入口文件
import { state, cacheSuffix } from './state.js';
import { loadSavedPosition } from './position.js';
import { initLevels, loadLevel, setupEventListeners, switchTeachingMode } from './app.js';
import { setupMenuAndModals } from './menu.js';
import { setupLearningEvents } from './learning.js';

// 初始化全局音频管理器缓存后缀
if (window.audioManager) {
  audioManager.cacheSuffix = cacheSuffix;
}

// ES 模块在 DOM 解析完成后执行（等同 defer），可直接操作 DOM
setupMenuAndModals();
setupLearningEvents();

(async () => {
  const savedPos = loadSavedPosition();
  if (savedPos) {
    if (savedPos.level) state.currentLevel = savedPos.level;
    // 恢复教学模式状态
    if (savedPos.isTeachingMode !== undefined) {
      state.isTeachingMode = savedPos.isTeachingMode;
    }
  }

  // 并行执行：初始化等级列表 和 加载当前等级数据
  const initLevelsPromise = initLevels();

  await loadLevel(state.currentLevel, savedPos);
  
  // 如果是教学模式，需要更新按钮和 UI 状态
  if (state.isTeachingMode) {
    switchTeachingMode(true);
  }
  
  setupEventListeners();

  await initLevelsPromise;

  // 更新 UI 显示正确的级别
  document.getElementById('currentLevelBtn').textContent = state.currentLevel;
  document.getElementById('levelDropdown').querySelectorAll('.level-option').forEach(o => {
    o.classList.toggle('active', o.dataset.level === state.currentLevel);
  });
})();
