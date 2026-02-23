// 共享可变状态
const forceRefreshKey = 'shizi_force_refresh';
const shouldForceRefresh = sessionStorage.getItem(forceRefreshKey) === 'true';

if (shouldForceRefresh) {
  sessionStorage.removeItem(forceRefreshKey);
}

export const cacheSuffix = shouldForceRefresh ? `?t=${Date.now()}` : '';

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
