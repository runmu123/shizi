// 共享可变状态
const navigationEntry = performance.getEntriesByType('navigation')[0];
const isReload = (navigationEntry?.type === 'reload') ||
  (window.performance?.navigation?.type === 1);

export const cacheSuffix = isReload ? `?t=${Date.now()}` : '';

export const state = {
  LEVELS: [],
  currentLevel: 'L0',
  currentData: null,
  levelDataCache: {},
  unitKeys: [],
  currentUnitIndex: 0,
  isTeachingMode: false,
  isLoopingAudio: false,
  writer: null,
  currentMode: 'animate',
  currentStroke: 0,
  totalStrokes: 0,
};
