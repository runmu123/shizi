// 位置记忆：保存/加载当前位置
import { state } from './state.js';
import { POSITION_KEY } from './constants.js';

export function saveCurrentPosition() {
  const data = {
    level: state.currentLevel,
    unitIndex: state.currentUnitIndex,
    unitName: state.unitKeys[state.currentUnitIndex] || '',
    isTeachingMode: state.isTeachingMode,
    timestamp: Date.now(),
  };
  localStorage.setItem(POSITION_KEY, JSON.stringify(data));
}

export function loadSavedPosition() {
  try {
    const saved = localStorage.getItem(POSITION_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    console.warn('加载保存的位置失败:', e);
    return null;
  }
}
