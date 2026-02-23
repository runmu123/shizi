// 入口文件
import { state } from './state.js';
import { loadSavedPosition } from './position.js';
import { initLevels, loadLevel, setupEventListeners } from './app.js';
import { setupMenuAndModals } from './menu.js';
import { setupLearningEvents } from './learning.js';

// ES 模块在 DOM 解析完成后执行（等同 defer），可直接操作 DOM
setupMenuAndModals();
setupLearningEvents();

(async () => {
  await initLevels();

  // 尝试恢复保存的位置
  const savedPos = loadSavedPosition();
  if (savedPos && savedPos.level && state.LEVELS.includes(savedPos.level)) {
    state.currentLevel = savedPos.level;
  }

  // 更新 UI 显示正确的级别
  document.getElementById('currentLevelBtn').textContent = state.currentLevel;
  document.getElementById('levelDropdown').querySelectorAll('.level-option').forEach(o => {
    o.classList.toggle('active', o.dataset.level === state.currentLevel);
  });

  await loadLevel(state.currentLevel, savedPos);
  setupEventListeners();
})();
