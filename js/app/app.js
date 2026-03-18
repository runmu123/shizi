// 核心应用逻辑：初始化、级别加载、事件、导航
import { state } from './state.js';
import { TEACH_PASSWORD, USER_KEY } from './constants.js';
import { showToast, showPersistentToast } from '../utils/toast.js';
import { saveCurrentPosition } from './position.js';
import { renderUnit, renderSearchResult, escapeHtml, applyResponsiveLayout, updateAppShell } from '../ui/ui.js';
import { enterLearning, exitLearning, updateLearningViewBtn } from '../learning/learning.js';
import { enterBatchRecord } from '../batch/batch-record.js';
import { enterBatchPlay } from '../batch/batch-play.js';
import { normalizeWrongCharEntries, findWrongCharEntry } from '../utils/mistake-utils.js';
import { loadLevelData } from './level-data-loader.js';
import { setupHomeSectionEvents } from '../events/home-section-events.js';
import { setupPracticeInteractionEvents } from '../events/practice-interaction-events.js';
import { setupProfileNotebookEvents } from '../events/profile-notebook-events.js';
import { setupAudioInteractionEvents } from '../events/audio-interaction-events.js';
import { setupNavigationEvents } from '../events/navigation-events.js';
import { setupCompletionModalEvents } from '../events/completion-modal-events.js';
import { createPracticeEngine } from '../practice/practice-engine.js';
import { createPracticeStateSupport } from '../practice/practice-state-support.js';
import { createPracticePlaybackSupport } from '../practice/practice-playback-support.js';
import { createNotebookEngine } from '../profile/notebook-engine.js';
import { createNotebookSupport } from '../profile/notebook-support.js';
import { getNotebookGroupsByLevel as getNotebookGroupsByLevelShared } from '../profile/notebook-grouping.js';
import { createProfileDataSupport } from '../profile/profile-data-support.js';
import { createHomeSupport } from '../home/home-support.js';
import { createLearnBatchSupport } from '../home/learn-batch-support.js';
import {
  getPauseIconHtml,
  getPlayIconHtml,
  getSpeakerIconHtml,
  getEarIconHtml,
  getEyeIconHtml,
  getStudyIconHtml,
  setModeToggleBtnState,
  setSpeakerButtonPlaying,
  updateBtnIcon,
} from '../ui/ui-icon-support.js';

const practiceAudioUiState = {
  button: null,
  cleanup: null,
};

const notebookMutationState = {
  pending: new Set(),
};

const completionModalState = {
  kind: 'main',
  mode: 'listen',
};

function trackNotebookMutation(promise) {
  if (!promise || typeof promise.finally !== 'function') return promise;
  notebookMutationState.pending.add(promise);
  promise.finally(() => {
    notebookMutationState.pending.delete(promise);
  });
  return promise;
}

async function flushNotebookMutations() {
  const tasks = Array.from(notebookMutationState.pending);
  if (!tasks.length) return;
  await Promise.allSettled(tasks);
}

function waitForNextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

function getNotebookGroupsByLevel(mode) {
  return getNotebookGroupsByLevelShared(state.notebook.items, mode);
}

// ===== 级别初始化 =====
export async function initLevels() {
  const dropdown = document.getElementById('levelDropdown');
  dropdown.innerHTML = '';
  state.LEVELS = [];

  let i = 0;
  while (true) {
    const level = `L${i}`;
    try {
      const data = await loadLevelData(level);
      if (data) {
        state.LEVELS.push(level);
        const btn = document.createElement('button');
        btn.className = 'level-option';
        btn.dataset.level = level;
        btn.textContent = level;
        dropdown.appendChild(btn);
        i++;
      } else {
        if (i === 0) {
          i++;
          continue;
        }
        break;
      }
    } catch (e) {
      console.warn('检查级别失败:', level, e);
      break;
    }
    if (i > 20) break;
  }

  if (state.LEVELS.length === 0) {
    state.LEVELS = ['L1'];
    state.currentLevel = 'L1';
    dropdown.innerHTML = '<button class="level-option" data-level="L1">L1</button>';
  } else {
    if (!state.LEVELS.includes(state.currentLevel)) {
      state.currentLevel = state.LEVELS[0];
    }
  }

  const opts = dropdown.querySelectorAll('.level-option');
  opts.forEach(o => {
    o.classList.toggle('active', o.dataset.level === state.currentLevel);
  });
  document.getElementById('currentLevelBtn').textContent = state.currentLevel;
}

// ===== 级别加载 =====
export async function loadLevel(level, savedPos = null) {
  const appEl = document.getElementById('app');
  const unitSelect = document.getElementById('unitSelect');
  appEl.innerHTML = '<div class="loading">正在加载数据...</div>';

  try {
    const data = await loadLevelData(level, { throwOnError: true });

    state.currentData = data;
    state.unitKeys = Object.keys(data);

    // 尝试恢复保存的单元索引
    state.currentUnitIndex = 0;
    if (savedPos && savedPos.level === level) {
      if (savedPos.unitName) {
        const idxByName = state.unitKeys.indexOf(savedPos.unitName);
        if (idxByName !== -1) {
          state.currentUnitIndex = idxByName;
        }
      } else if (savedPos.unitIndex !== undefined && savedPos.unitIndex < state.unitKeys.length) {
        state.currentUnitIndex = savedPos.unitIndex;
      }
    }

    // 填充单元选择下拉框
    unitSelect.innerHTML = '';
    state.unitKeys.forEach((key, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = key;
      unitSelect.appendChild(option);
    });

    refreshCurrentUnitView({
      resetListen: isPracticeMode(),
      autoPlayListen: state.mainViewMode === 'listen' && !state.isTeachingMode,
    });
  } catch (err) {
    console.error('加载数据失败:', err);
    appEl.innerHTML = `
      <div class="error-msg">
        <h3>加载失败</h3>
        <p>无法加载 ${escapeHtml(level)} 的数据文件。</p>
        <p>请确保文件 yaml/contents_${escapeHtml(level)}.yaml 存在。</p>
        <p>错误信息: ${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

// ===== 搜索 =====
async function searchChar(char) {
  const appEl = document.getElementById('app');
  const unitNavigator = document.querySelector('.unit-navigator');
  appEl.innerHTML = '<div class="loading">正在全库搜索...</div>';
  unitNavigator.style.visibility = 'hidden';

  let foundInfo = null;
  let foundLevel = '';
  let foundUnit = '';

  for (const level of state.LEVELS) {
    let data = null;
    try {
      data = await loadLevelData(level);
    } catch (e) {
      console.error(`获取 ${level} 数据出错:`, e);
    }

    if (data) {
      for (const [unit, chars] of Object.entries(data)) {
        if (chars && chars[char]) {
          foundInfo = chars[char];
          foundLevel = level;
          foundUnit = unit;
          break;
        }
      }
    }

    if (foundInfo) break;
  }

  if (foundInfo) {
    renderSearchResult(char, foundInfo, foundLevel, foundUnit);
  } else {
    appEl.innerHTML = `
      <div class="modal-msg">
        <p>未在任何等级找到汉字「${escapeHtml(char)}」</p>
      </div>
    `;
  }
}

// ===== 模式切换 =====
export function switchTeachingMode(enable) {
  stopLearnBatchPlayback(true);
  state.isTeachingMode = enable;
  if (enable) {
    state.mainViewMode = 'study';
  }

  const batchPlayBtn = document.getElementById('batchPlayBtnMain');
  const batchRecordBtn = document.getElementById('batchRecordBtnMain');
  const learnBatchBtn = document.getElementById('learnBatchPlayBtnMain');
  const earStudyBtn = document.getElementById('earStudyToggleBtnMain');
  const eyeStudyBtn = document.getElementById('eyeStudyToggleBtnMain');

  // 控制批量按钮的显示/隐藏
  if (batchPlayBtn) {
    batchPlayBtn.style.display = state.isTeachingMode ? 'inline-flex' : 'none';
  }
  if (batchRecordBtn) {
    batchRecordBtn.style.display = state.isTeachingMode ? 'inline-flex' : 'none';
  }
  if (learnBatchBtn) {
    learnBatchBtn.style.display = state.isTeachingMode ? 'none' : 'inline-flex';
  }
  if (earStudyBtn) {
    earStudyBtn.style.display = state.isTeachingMode ? 'none' : 'inline-flex';
  }
  if (eyeStudyBtn) {
    eyeStudyBtn.style.display = state.isTeachingMode ? 'none' : 'inline-flex';
  }
  if (!state.isTeachingMode) {
    updateEarStudyButtonForMode();
  }
  // 重新渲染
  renderUnit();

  // 更新学习视图按钮
  if (document.getElementById('learningView').classList.contains('active')) {
    updateLearningViewBtn();
  }

  // 保存当前位置和模式
  saveCurrentPosition();
}

// ===== 导航到指定单元 =====
export async function navigateToUnit(level, unitName) {
  document.getElementById('progressModal').classList.remove('active');

  if (document.getElementById('learningView').classList.contains('active')) {
    exitLearning();
  }

  if (state.currentLevel !== level) {
    state.currentLevel = level;
    document.getElementById('currentLevelBtn').textContent = level;
    document.querySelectorAll('.level-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.level === level);
    });

    await loadLevel(level);
  }

  const index = state.unitKeys.indexOf(unitName);
  if (index !== -1) {
    state.currentUnitIndex = index;
    state.homeCardIndex = 0;
    state.homeCardMotion = 'none';
    refreshCurrentUnitView({
      resetListen: isPracticeMode(),
      autoPlayListen: state.mainViewMode === 'listen' && !state.isTeachingMode,
    });
    saveCurrentPosition();
    showToast(`已跳转到 ${level} ${unitName}`, 'success');
  } else {
    showToast(`未找到单元: ${unitName}`, 'error');
  }
}

// 播放刚录制完成的本地音频，便于老师即时检查
function playRecordedBlob(blob) {
  return new Promise((resolve, reject) => {
    if (!blob || blob.size === 0) {
      resolve(false);
      return;
    }

    const previewUrl = URL.createObjectURL(blob);
    const previewAudio = new Audio(previewUrl);

    const cleanup = () => URL.revokeObjectURL(previewUrl);

    previewAudio.onended = () => {
      cleanup();
      resolve(true);
    };
    previewAudio.onerror = (err) => {
      cleanup();
      reject(err);
    };
    previewAudio.play().catch((err) => {
      cleanup();
      reject(err);
    });
  });
}

function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getCurrentUnitName() {
  return state.unitKeys?.[state.currentUnitIndex] || '';
}

function isPracticeMode(mode = state.mainViewMode) {
  return mode === 'listen' || mode === 'see';
}

function createEmptyListenState(unitName = '') {
  return practiceStateSupport.createEmptyListenState(unitName);
}

function createEmptySeeState(unitName = '') {
  return practiceStateSupport.createEmptySeeState(unitName);
}

function initializeListenSession(chars, unitName = getCurrentUnitName()) {
  return practiceStateSupport.initializeListenSession(chars, unitName);
}

function initializeSeeSession(chars, unitName = getCurrentUnitName()) {
  return practiceStateSupport.initializeSeeSession(chars, unitName);
}

function buildListenOptions(correctChar) {
  return practiceStateSupport.buildListenOptions(correctChar);
}

function getPracticeState(mode = state.mainViewMode) {
  if (mode === 'listen') return state.listenMode;
  if (mode === 'see') return state.seeMode;
  return null;
}

function getLevelCharPool() {
  if (!state.currentData) return [];
  const pool = new Set();
  Object.values(state.currentData).forEach((unitData) => {
    Object.keys(unitData || {}).forEach((char) => pool.add(char));
  });
  return Array.from(pool);
}

function getListenQuestion(index = state.listenMode.currentIndex) {
  return state.listenMode.questions[index] || null;
}

function getSeeQuestion(index = state.seeMode.currentIndex) {
  return state.seeMode.questions[index] || null;
}

function findCharUnitInCurrentLevel(char) {
  if (!state.currentData || !char) return getCurrentUnitName();

  for (const [unitName, unitData] of Object.entries(state.currentData)) {
    if (unitData && Object.prototype.hasOwnProperty.call(unitData, char)) {
      return unitName;
    }
  }

  return getCurrentUnitName();
}

function ensureListenSession(forceReset = false) {
  return practiceStateSupport.ensurePracticeSession('listen', () => getListenQuestion(), forceReset);
}

function ensureSeeSession(forceReset = false) {
  return practiceStateSupport.ensurePracticeSession('see', () => getSeeQuestion(), forceReset);
}

function getCurrentListenChar() {
  return state.listenMode.sequence[state.listenMode.currentIndex] || '';
}

async function ensureLevelDataAvailable(level) {
  if (!level) return null;
  if (level === state.currentLevel && state.currentData) return state.currentData;
  try {
    return await loadLevelData(level, { fetchOptions: { cache: 'no-store' } });
  } catch (error) {
    console.warn('加载等级数据失败:', level, error);
    return null;
  }
}

async function resolveCharOrigin(char, preferredLevel = '') {
  if (!char) return { level: preferredLevel || state.currentLevel, unit: getCurrentUnitName() };

  const levels = Array.from(new Set([preferredLevel, ...(state.LEVELS || [])].filter(Boolean)));
  for (const level of levels) {
    const levelData = await ensureLevelDataAvailable(level);
    if (!levelData) continue;
    for (const [unitName, unitData] of Object.entries(levelData)) {
      if (unitData && Object.prototype.hasOwnProperty.call(unitData, char)) {
        return { level, unit: unitName };
      }
    }
  }

  return {
    level: preferredLevel || state.currentLevel,
    unit: getCurrentUnitName(),
  };
}

function getCurrentSeeChar() {
  return state.seeMode.sequence[state.seeMode.currentIndex] || '';
}

function refreshCurrentUnitView({ resetListen = false, autoPlayListen = false } = {}) {
  stopActiveAudioPlayback();

  if (state.mainViewMode === 'listen' && !state.isTeachingMode) {
    ensureListenSession(resetListen);
  } else if (state.mainViewMode === 'see' && !state.isTeachingMode) {
    ensureSeeSession(resetListen);
  }

  renderUnit();

  if (autoPlayListen && state.mainViewMode === 'listen' && !state.isTeachingMode) {
    practicePlaybackSupport.scheduleListenModeAutoPlay();
  }
}

function stopActiveAudioPlayback() {
  return practicePlaybackSupport.stopActiveAudioPlayback();
}

function getActivePracticeMode() {
  return practicePlaybackSupport.getActivePracticeMode();
}

function getPracticeQuestion(mode = state.mainViewMode, index = null) {
  return practicePlaybackSupport.getPracticeQuestion(mode, index);
}

function playCharAudio(char, options = {}) {
  return practicePlaybackSupport.playCharAudio(char, options);
}

function playListenModeAudio() {
  return practicePlaybackSupport.playListenModeAudio();
}

function playSpecificListenCharAudio(char) {
  return practicePlaybackSupport.playSpecificListenCharAudio(char);
}

async function playSeeOptionAudio(char, btn = null) {
  return practicePlaybackSupport.playSeeOptionAudio(char, btn);
}

function updateEarStudyButtonForMode() {
  const earStudyBtn = document.getElementById('earStudyToggleBtnMain');
  const eyeStudyBtn = document.getElementById('eyeStudyToggleBtnMain');

  if (state.mainViewMode === 'listen') {
    setModeToggleBtnState(earStudyBtn, 'study');
    setModeToggleBtnState(eyeStudyBtn, 'eye');
    return;
  }

  if (state.mainViewMode === 'see') {
    setModeToggleBtnState(earStudyBtn, 'ear');
    setModeToggleBtnState(eyeStudyBtn, 'study');
    return;
  }

  setModeToggleBtnState(earStudyBtn, 'ear');
  setModeToggleBtnState(eyeStudyBtn, 'eye');
}

function setMainViewMode(mode, { resetListen = true, autoPlay = true } = {}) {
  if (!['study', 'listen', 'see'].includes(mode)) return;
  if (state.isTeachingMode && mode !== 'study') return;

  state.mainViewMode = mode;
  updateEarStudyButtonForMode();

  refreshCurrentUnitView({
    resetListen: isPracticeMode(mode) ? resetListen : false,
    autoPlayListen: mode === 'listen' ? autoPlay : false,
  });
  saveCurrentPosition();
}

function setAppSection(section) {
  if (!['home', 'other', 'profile'].includes(section)) return;
  if (section !== 'home') {
    stopActiveAudioPlayback();
    stopLearnBatchPlayback(true);
  }
  if (section === 'profile') {
    state.profileView = 'main';
  }
  state.appSection = section;
  renderUnit();
  if (section === 'profile') {
    loadProfilePageData();
  }
  saveCurrentPosition();
}

function invalidateNotebookCache() {
  state.notebook.loadedUser = '';
}

function invalidateProfileProgressCache() {
  state.profileProgress.loadedUser = '';
}

function renderUnitPreservingScroll() {
  const currentScrollY = window.scrollY;
  renderUnit();
  requestAnimationFrame(() => {
    window.scrollTo(0, currentScrollY);
  });
}

const profileDataSupport = createProfileDataSupport({
  state,
  normalizeWrongCharEntries,
  renderUnit,
  renderUnitPreservingScroll,
  showPersistentToast,
  showToast,
  getUserKey: () => localStorage.getItem(USER_KEY) || '',
});

export async function refreshProfilePageDataAfterLogin() {
  await profileDataSupport.loadProfilePageData(true, { showQueryToasts: true });
}

export function clearProfilePageDataAfterLogout() {
  profileDataSupport.resetProfilePageData();
  if (state.appSection === 'profile') {
    renderUnit();
  }
}

async function updateUserMistakeRecord({ char, level, unit, mistakeMode, wrongChar }) {
  const username = localStorage.getItem(USER_KEY) || '';
  if (!username || !window.audioManager?.supabase || !char || !mistakeMode) return;

  try {
    const { data, error } = await audioManager.supabase
      .from('user_mistakes')
      .select('*')
      .eq('username', username)
      .eq('char', char)
      .eq('level', level)
      .eq('unit', unit)
      .eq('mistake_mode', mistakeMode)
      .maybeSingle();

    if (error) throw error;

    const nextWrongChars = normalizeWrongCharEntries([
      ...((data && Array.isArray(data.wrong_chars)) ? data.wrong_chars : []),
      ...(wrongChar ? [wrongChar] : []),
    ], level, unit);

    const payload = {
      username,
      char,
      level,
      unit,
      mistake_mode: mistakeMode,
      mistake_count: (data?.mistake_count || 0) + 1,
      wrong_chars: nextWrongChars,
      last_wrong_at: new Date().toISOString(),
    };

    const { error: upsertError } = await audioManager.supabase
      .from('user_mistakes')
      .upsert(payload, { onConflict: 'username,char,level,unit,mistake_mode' });

    if (upsertError) throw upsertError;
    invalidateNotebookCache();
  } catch (error) {
    console.error('写入生字本失败:', error);
  }
}

const notebookSupport = createNotebookSupport({
  state,
  completionModalState,
  normalizeWrongCharEntries,
  escapeHtml,
  renderUnitPreservingScroll,
  renderUnit,
  saveCurrentPosition,
  loadNotebookData: (force = false) => profileDataSupport.loadNotebookData(force),
  stopActiveAudioPlayback,
  flushNotebookMutations,
  loadProfilePageData: (force = false, options = {}) => profileDataSupport.loadProfilePageData(force, options),
  navigateToUnit,
  getCurrentUnitChars: () => homeSupport.getCurrentUnitChars(),
  setMainViewMode,
  getNotebookPracticeQuestion: () => notebookEngine.getNotebookPracticeQuestion(),
  getNotebookPracticeCharContext: (char) => notebookEngine.getNotebookPracticeCharContext(char),
  practiceAudioUiState,
  setSpeakerButtonPlaying,
  showToast,
  getUserKey: () => localStorage.getItem(USER_KEY) || '',
  invalidateNotebookCache,
});

const practiceStateSupport = createPracticeStateSupport({
  state,
  shuffleArray,
  getCurrentUnitName,
  getLevelCharPool,
});

const practicePlaybackSupport = createPracticePlaybackSupport({
  state,
  practiceAudioUiState,
  getPracticeState,
  findCharUnitInCurrentLevel,
  getCurrentListenChar,
  resolveCharOrigin,
  getSpeakerIconHtml,
  getPauseIconHtml,
  setSpeakerButtonPlaying,
  showToast,
});

const practiceEngine = createPracticeEngine({
  state,
  getActivePracticeMode: () => practicePlaybackSupport.getActivePracticeMode(),
  getPracticeState,
  initializeSeeSession: (...args) => practiceStateSupport.initializeSeeSession(...args),
  initializeListenSession: (...args) => practiceStateSupport.initializeListenSession(...args),
  getCurrentUnitName,
  renderUnit,
  saveCurrentPosition,
  scheduleListenModeAutoPlay: () => practicePlaybackSupport.scheduleListenModeAutoPlay(),
  stopActiveAudioPlayback: () => practicePlaybackSupport.stopActiveAudioPlayback(),
  showPracticeCompletionModal: (mode) => homeSupport.showPracticeCompletionModal(mode),
  ensureListenSession,
  ensureSeeSession,
  getListenQuestion,
  getSeeQuestion,
  showToast,
  playSpecificListenCharAudio: (char) => practicePlaybackSupport.playSpecificListenCharAudio(char),
  updateUserMistakeRecord,
  findCharUnitInCurrentLevel,
  playCharAudio: (char, options) => practicePlaybackSupport.playCharAudio(char, options),
});

const homeSupport = createHomeSupport({
  state,
  getCurrentUnitName,
  renderUnit,
  saveCurrentPosition,
  setMainViewMode,
  stopLearnBatchPlayback: (resetQueue = true) => learnBatchSupport.stopLearnBatchPlayback(resetQueue),
  getActivePracticeMode,
  getPracticeState,
  stopActiveAudioPlayback,
  setSpeakerButtonPlaying,
  escapeHtml,
});

const notebookEngine = createNotebookEngine({
  state,
  normalizeWrongCharEntries,
  findWrongCharEntry,
  getNotebookGroupsByLevel,
  shuffleArray,
  buildListenOptions,
  renderUnit,
  showToast,
  playNotebookPracticeAudio: () => notebookSupport.playNotebookPracticeAudio(),
  stopActiveAudioPlayback,
  waitForNextFrame,
  flushNotebookMutations,
  showNotebookPracticeCompletionModal: () => notebookSupport.showNotebookPracticeCompletionModal(),
  getCurrentUnitName,
  resolveCharOrigin,
  updateUserMistakeRecord,
  trackNotebookMutation,
  removeUserMistakeRecord: (args) => notebookSupport.removeUserMistakeRecord(args),
  removeWrongCharEntryFromMistakeRecord: (args) => notebookSupport.removeWrongCharEntryFromMistakeRecord(args),
  currentLevel: () => state.currentLevel,
  markQuestionCorrect: (question) => practiceEngine.markQuestionCorrect(question),
  markQuestionMistaken: (question, selectedChar, options) => practiceEngine.markQuestionMistaken(question, selectedChar, options),
});

const learnBatchSupport = createLearnBatchSupport({
  state,
  getPauseIconHtml,
  getPlayIconHtml,
  getCurrentUnitChars: () => homeSupport.getCurrentUnitChars(),
  renderUnit,
  showToast,
  audioManager,
});

function markQuestionCorrect(question) {
  return practiceEngine.markQuestionCorrect(question);
}

function markQuestionMistaken(question, selectedChar, options = {}) {
  return practiceEngine.markQuestionMistaken(question, selectedChar, options);
}

function stopLearnBatchPlayback(resetQueue = true) {
  return learnBatchSupport.stopLearnBatchPlayback(resetQueue);
}

// ===== 事件绑定 =====
export function setupEventListeners() {
  let resizeFrame = 0;
  let scrollPosition = 0;
  const toolbarNotebookSwitcher = document.getElementById('toolbarNotebookSwitcher');

  function toggleInlineCollapse(toggleEl, expanded) {
    const arrow = toggleEl.querySelector('.notebook-section-arrow');
    const panel = toggleEl.nextElementSibling;
    if (!panel) return;

    arrow?.classList.toggle('expanded', expanded);

    if (panel._collapseCleanup) {
      panel.removeEventListener('transitionend', panel._collapseCleanup);
      panel._collapseCleanup = null;
    }

    if (expanded) {
      panel.classList.add('expanded');
      panel.style.height = '0px';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          panel.style.height = `${panel.scrollHeight}px`;
        });
      });

      const cleanup = (event) => {
        if (event.propertyName !== 'height') return;
        panel.style.height = '';
        panel.removeEventListener('transitionend', cleanup);
        panel._collapseCleanup = null;
      };
      panel._collapseCleanup = cleanup;
      panel.addEventListener('transitionend', cleanup);
      return;
    }

    panel.style.height = `${panel.scrollHeight}px`;
    requestAnimationFrame(() => {
      panel.classList.remove('expanded');
      requestAnimationFrame(() => {
        panel.style.height = '0px';
      });
    });

    const cleanup = (event) => {
      if (event.propertyName !== 'height') return;
      panel.style.height = '';
      panel.removeEventListener('transitionend', cleanup);
      panel._collapseCleanup = null;
    };
    panel._collapseCleanup = cleanup;
    panel.addEventListener('transitionend', cleanup);
  }

  function lockScroll() {
    scrollPosition = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollPosition}px`;
    document.body.style.width = '100%';
  }

  function unlockScroll() {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollPosition);
  }

  const currentLevelBtn = document.getElementById('currentLevelBtn');
  const levelDropdown = document.getElementById('levelDropdown');
  const searchInput = document.getElementById('searchInput');
  const unitNavigator = document.querySelector('.unit-navigator');
  const prevBtn = document.getElementById('prevUnit');
  const nextBtn = document.getElementById('nextUnit');
  const unitSelect = document.getElementById('unitSelect');
  const appEl = document.getElementById('app');
  const bottomNav = document.querySelector('.bottom-nav');

  // 密码弹窗元素
  const passwordModal = document.getElementById('passwordModal');
  const passwordInput = document.getElementById('passwordInput');
  const passwordError = document.getElementById('passwordError');
  const listenCompletionModal = document.getElementById('listenCompletionModal');
  const closeListenCompletion = document.getElementById('closeListenCompletion');
  const retryListenBtn = document.getElementById('retryListenBtn');
  const nextListenUnitBtn = document.getElementById('nextListenUnitBtn');

  updateEarStudyButtonForMode();

  window.addEventListener('shizi-auth-changed', () => {
    invalidateNotebookCache();
    invalidateProfileProgressCache();
  });

  if (state.appSection === 'profile') {
    profileDataSupport.loadProfilePageData(true, { showQueryToasts: true });
  }

  window.addEventListener('resize', () => {
    if (resizeFrame) {
      cancelAnimationFrame(resizeFrame);
    }
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      applyResponsiveLayout();
    });
  });

  const navigationControls = setupNavigationEvents({
    state,
    currentLevelBtn,
    levelDropdown,
    searchInput,
    unitNavigator,
    prevBtn,
    nextBtn,
    unitSelect,
    passwordModal,
    passwordInput,
    passwordError,
    listenCompletionModal,
    lockScroll,
    unlockScroll,
    switchTeachingMode,
    saveCurrentPosition,
    loadLevel,
    searchChar,
    isPracticeMode,
    updateEarStudyButtonForMode,
    refreshCurrentUnitView,
    stopLearnBatchPlayback: (resetQueue = true) => learnBatchSupport.stopLearnBatchPlayback(resetQueue),
    navigateListenHistory: (direction) => practiceEngine.navigateListenHistory(direction),
    navigateSeeHistory: (direction) => practiceEngine.navigateSeeHistory(direction),
    navigateHomeCardByOffset: (offset) => homeSupport.navigateHomeCardByOffset(offset),
    navigateNotebookReviewCard: (offset) => notebookEngine.navigateNotebookReviewCard(offset),
    TEACH_PASSWORD,
  });
  const { tryEnterTeachingMode } = navigationControls;

  setupHomeSectionEvents({
    appEl,
    bottomNav,
    state,
    saveCurrentPosition,
    updateAppShell,
    exitLearning,
    returnToHomeStudy: () => homeSupport.returnToHomeStudy(),
    setAppSection,
    setMainViewMode,
    switchTeachingMode,
    tryEnterTeachingMode,
    toggleInlineCollapse,
    loadProfileProgressData: (force = false) => profileDataSupport.loadProfileProgressData(force),
    setProfileView: (view) => notebookSupport.setProfileView(view),
  });

  setupPracticeInteractionEvents({
    appEl,
    state,
    searchInput,
    unitNavigator,
    isPracticeMode,
    handleNotebookListenPracticeAnswer: (selectedChar) => notebookEngine.handleNotebookListenPracticeAnswer(selectedChar),
    handleListenModeAnswer: (selectedChar) => practiceEngine.handleListenModeAnswer(selectedChar),
    handleNotebookSeePracticeAnswer: (selectedChar) => notebookEngine.handleNotebookSeePracticeAnswer(selectedChar),
    handleSeeModeAnswer: (selectedChar) => practiceEngine.handleSeeModeAnswer(selectedChar),
    playSeeOptionAudio,
    stopActiveAudioPlayback,
    navigateNotebookReviewCardTo: (targetIndex) => notebookEngine.navigateNotebookReviewCardTo(targetIndex),
    getCurrentUnitChars: () => homeSupport.getCurrentUnitChars(),
    navigateHomeCard: (targetIndex, direction) => homeSupport.navigateHomeCard(targetIndex, direction),
    navigateHomeCardByOffset: (offset) => homeSupport.navigateHomeCardByOffset(offset),
    enterLearning,
    navigateSeeHistory: (direction) => practiceEngine.navigateSeeHistory(direction),
    navigateListenHistory: (direction) => practiceEngine.navigateListenHistory(direction),
    navigateNotebookReviewCard: (offset) => notebookEngine.navigateNotebookReviewCard(offset),
    setMainViewMode,
    playListenModeAudio,
  });

  setupProfileNotebookEvents({
    appEl,
    toolbarNotebookSwitcher,
    state,
    toggleInlineCollapse,
    navigateToUnit,
    openNotebookReview: (mode, level, groupIndex) => notebookEngine.openNotebookReview(mode, level, groupIndex),
    openNotebookPractice: (mode, level, groupIndex) => notebookEngine.openNotebookPractice(mode, level, groupIndex),
    returnToNotebookList: () => notebookSupport.returnToNotebookList(),
    jumpToNotebookOrigin: (level, unit, char) => notebookSupport.jumpToNotebookOrigin(level, unit, char),
    navigateNotebookReviewGroup: (offset) => notebookEngine.navigateNotebookReviewGroup(offset),
    navigateNotebookReviewCard: (offset) => notebookEngine.navigateNotebookReviewCard(offset),
    switchNotebookPracticeGroup: (offset) => notebookEngine.switchNotebookPracticeGroup(offset),
    playNotebookPracticeAudio: () => notebookSupport.playNotebookPracticeAudio(),
  });

  setupAudioInteractionEvents({
    appEl,
    state,
    currentLevelBtn,
    levelDropdown,
    showToast,
    playRecordedBlob,
    updateBtnIcon,
    setSpeakerButtonPlaying,
    toggleLearnBatchPlayback: (btn) => learnBatchSupport.toggleLearnBatchPlayback(btn),
    enterBatchRecord,
    enterBatchPlay,
  });

  setupCompletionModalEvents({
    listenCompletionModal,
    closeListenCompletion,
    nextListenUnitBtn,
    retryListenBtn,
    completionModalState,
    state,
    showToast,
    moveToNextNotebookPracticeGroup: () => notebookEngine.moveToNextNotebookPracticeGroup(),
    resetCurrentPracticeState: () => {
      if (state.mainViewMode === 'see') {
        state.seeMode = createEmptySeeState(getCurrentUnitName());
      } else {
        state.listenMode = createEmptyListenState(getCurrentUnitName());
      }
    },
    refreshCurrentUnitView,
    saveCurrentPosition,
    retryCurrentNotebookPracticeGroup: () => notebookEngine.retryCurrentNotebookPracticeGroup(),
    retryWrongPracticeItems: (mode) => practiceEngine.retryWrongPracticeItems(mode),
    getActivePracticeMode,
  });
}
