// 核心应用逻辑：初始化、级别加载、事件、导航
import { state } from './state.js';
import { TEACH_PASSWORD, USER_KEY } from './constants.js';
import { showToast, showPersistentToast } from './toast.js';
import { saveCurrentPosition } from './position.js';
import { renderUnit, renderSearchResult, escapeHtml, applyResponsiveLayout, updateAppShell } from './ui.js';
import { enterLearning, exitLearning, updateLearningViewBtn } from './learning.js';
import { enterBatchRecord } from './batch-record.js';
import { enterBatchPlay } from './batch-play.js';
import { normalizeWrongCharEntries, findWrongCharEntry } from './mistake-utils.js';
import { loadLevelData } from './level-data-loader.js';
import { setupHomeSectionEvents } from './events/home-section-events.js';
import { setupPracticeInteractionEvents } from './events/practice-interaction-events.js';
import { setupProfileNotebookEvents } from './events/profile-notebook-events.js';
import { setupAudioInteractionEvents } from './events/audio-interaction-events.js';
import { setupNavigationEvents } from './events/navigation-events.js';
import { setupCompletionModalEvents } from './events/completion-modal-events.js';
import { createPracticeEngine } from './practice/practice-engine.js';
import { createNotebookEngine } from './profile/notebook-engine.js';
import { createNotebookSupport } from './profile/notebook-support.js';

const learnBatchPlayback = {
  running: false,
  paused: false,
  sequence: [],
  index: 0,
  token: 0,
  button: null,
};

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

// ===== 按钮图标更新（录音/播放模式切换后） =====
function updateBtnIcon(btn, isTeaching) {
  const iconId = isTeaching ? '#icon-mic' : '#icon-play';

  btn.classList.remove('playing');
  btn.innerHTML = `<svg><use href="${iconId}"></use></svg>`;
  btn.title = isTeaching ? '录音' : '播放';
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

function getPauseIconHtml() {
  return `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M520-200v-560h240v560H520Zm-320 0v-560h240v560H200Zm400-80h80v-400h-80v400Zm-320 0h80v-400h-80v400Zm0-400v400-400Zm320 0v400-400Z"/></svg>`;
}

function getPlayIconHtml() {
  return `<svg><use href="#icon-play"></use></svg>`;
}

function getSpeakerIconHtml() {
  return `<svg><use href="#icon-play"></use></svg>`;
}

function setSpeakerButtonPlaying(btn, isPlaying) {
  if (!btn) return;
  btn.classList.toggle('playing', isPlaying);
  btn.innerHTML = isPlaying ? getPauseIconHtml() : getSpeakerIconHtml();
  btn.title = isPlaying ? '暂停' : '播放';
}

function getEarIconHtml() {
  return `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M280-80q62 0 101.5-31t60.5-91q17-50 32.5-70t71.5-64q62-50 98-113t36-151q0-119-80.5-199.5T400-880q-119 0-199.5 80.5T120-600h80q0-85 57.5-142.5T400-800q85 0 142.5 57.5T600-600q0 68-27 116t-77 86q-52 38-81 74t-43 78q-14 44-33.5 65T280-160q-33 0-56.5-23.5T200-240h-80q0 66 47 113t113 47Zm432-210q59-60 93.5-139.5T840-600q0-92-34.5-172T712-912l-58 56q50 50 78 115.5T760-600q0 74-28 139t-78 115l58 56ZM471-529.5q29-29.5 29-70.5 0-42-29-71t-71-29q-42 0-71 29t-29 71q0 41 29 70.5t71 29.5q42 0 71-29.5Z"/></svg>`;
}

function getEyeIconHtml() {
  return `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M607.5-372.5Q660-425 660-500t-52.5-127.5Q555-680 480-680t-127.5 52.5Q300-575 300-500t52.5 127.5Q405-320 480-320t127.5-52.5Zm-204-51Q372-455 372-500t31.5-76.5Q435-608 480-608t76.5 31.5Q588-545 588-500t-31.5 76.5Q525-392 480-392t-76.5-31.5ZM214-281.5Q94-363 40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200q-146 0-266-81.5ZM480-500Zm207.5 160.5Q782-399 832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280q113 0 207.5-59.5Z"/></svg>`;
}

function getStudyIconHtml() {
  return `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h440l200 200v440q0 33-23.5 56.5T760-120H200Zm0-80h560v-400H600v-160H200v560Zm80-80h400v-80H280v80Zm0-320h200v-80H280v80Zm0 160h400v-80H280v80Zm-80-320v160-160 560-560Z"/></svg>`;
}

function setModeToggleBtnState(btn, iconType) {
  if (!btn) return;
  const iconMap = {
    ear: getEarIconHtml,
    eye: getEyeIconHtml,
    study: getStudyIconHtml,
  };
  btn.innerHTML = (iconMap[iconType] || getStudyIconHtml)();
  btn.title = iconType;
  btn.setAttribute('aria-pressed', iconType === 'study' ? 'true' : 'false');
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

function createEmptyPracticeState(unitName = '') {
  return {
    unitName,
    sequence: [],
    questions: [],
    currentIndex: 0,
    options: [],
    mistakeChars: [],
    firstTryCorrectChars: [],
    answeredChars: [],
    currentMistaken: false,
  };
}

function createEmptyListenState(unitName = '') {
  return createEmptyPracticeState(unitName);
}

function createEmptySeeState(unitName = '') {
  return createEmptyPracticeState(unitName);
}

function isPracticeMode(mode = state.mainViewMode) {
  return mode === 'listen' || mode === 'see';
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

function buildListenOptions(correctChar) {
  const distractors = shuffleArray(
    getLevelCharPool().filter((char) => char && char !== correctChar)
  ).slice(0, 3);

  return shuffleArray([correctChar, ...distractors]);
}

function buildPracticeQuestion(char, mode) {
  const question = {
    char,
    options: buildListenOptions(char),
    selectedChar: '',
    answered: false,
    hadMistake: false,
    countedCorrect: null,
    wrongSelections: [],
  };
  if (mode === 'see') {
    question.revealedOptions = [];
  }
  return question;
}

function initializePracticeSession(mode, chars, unitName = getCurrentUnitName()) {
  const modeKey = mode === 'see' ? 'seeMode' : 'listenMode';
  const createEmptyState = mode === 'see' ? createEmptySeeState : createEmptyListenState;
  const normalizedChars = Array.from(new Set((chars || []).filter(Boolean)));
  state[modeKey] = createEmptyState(unitName);
  state[modeKey].sequence = shuffleArray(normalizedChars);
  state[modeKey].questions = state[modeKey].sequence.map((char) => buildPracticeQuestion(char, mode));
  state[modeKey].options = state[modeKey].questions[0]?.options
    ? [...state[modeKey].questions[0].options]
    : [];
}

function initializeListenSession(chars, unitName = getCurrentUnitName()) {
  initializePracticeSession('listen', chars, unitName);
}

function initializeSeeSession(chars, unitName = getCurrentUnitName()) {
  initializePracticeSession('see', chars, unitName);
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
  return ensurePracticeSession('listen', forceReset);
}

function ensureSeeSession(forceReset = false) {
  return ensurePracticeSession('see', forceReset);
}

function ensurePracticeSession(mode, forceReset = false) {
  const modeState = mode === 'see' ? state.seeMode : state.listenMode;
  const initialize = mode === 'see' ? initializeSeeSession : initializeListenSession;
  const getQuestion = mode === 'see' ? getSeeQuestion : getListenQuestion;
  const unitName = getCurrentUnitName();
  const unitData = unitName ? state.currentData?.[unitName] : null;
  const unitChars = Object.keys(unitData || {});
  const shouldReset =
    forceReset ||
    modeState.unitName !== unitName ||
    modeState.sequence.length === 0;

  if (shouldReset) {
    initialize(unitChars, unitName);
  }

  const question = getQuestion();
  const currentChar = question?.char || '';
  modeState.options = question ? [...question.options] : [];
  return currentChar;
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

function stopActiveAudioPlayback() {
  if (window.audioManager && typeof audioManager.stopCurrentAudio === 'function') {
    audioManager.stopCurrentAudio();
  }
  if (typeof practiceAudioUiState.cleanup === 'function') {
    practiceAudioUiState.cleanup();
  }
  practiceAudioUiState.button = null;
  practiceAudioUiState.cleanup = null;
}

function getActivePracticeMode() {
  return state.mainViewMode === 'see' ? 'see' : 'listen';
}

function getPracticeQuestion(mode = state.mainViewMode, index = null) {
  const session = getPracticeState(mode);
  if (!session) return null;
  const resolvedIndex = index === null ? session.currentIndex : index;
  return session.questions[resolvedIndex] || null;
}

function playCharAudio(char, { button = null, setPauseIcon = false, level = '', unit = '' } = {}) {
  if (!char || state.isTeachingMode || !window.audioManager) return;

  const resolvedLevel = level || state.currentLevel;
  const unitName = unit || findCharUnitInCurrentLevel(char);
  const cleanup = () => {
    if (practiceAudioUiState.button === button) {
      practiceAudioUiState.button = null;
      practiceAudioUiState.cleanup = null;
    }
    if (!button) return;
    button.classList.remove('playing');
    if (setPauseIcon) {
      button.innerHTML = getSpeakerIconHtml();
    }
  };

  if (button) {
    button.classList.add('playing');
    if (setPauseIcon) {
      button.innerHTML = getPauseIconHtml();
    }
    practiceAudioUiState.button = button;
    practiceAudioUiState.cleanup = cleanup;
  }

  audioManager.stopCurrentAudio();
  audioManager.playAudio(
    resolvedLevel,
    unitName,
    char,
    char,
    'char',
    null,
    cleanup,
  ).then((success) => {
    if (!success) {
      cleanup();
      showToast('暂无录音', 'info');
    }
  }).catch((err) => {
    cleanup();
    showToast('播放失败: ' + err.message, 'error');
  });
}

function playListenModeAudio() {
  if (state.mainViewMode !== 'listen' || state.isTeachingMode) return;

  const currentChar = getCurrentListenChar();
  const unitName = findCharUnitInCurrentLevel(currentChar);
  const btn = document.getElementById('listenReplayBtn');

  if (!currentChar || !unitName || !window.audioManager) return;

  if (btn) {
    setSpeakerButtonPlaying(btn, true);
    practiceAudioUiState.button = btn;
  }

  const cleanup = () => {
    if (practiceAudioUiState.button === btn) {
      practiceAudioUiState.button = null;
      practiceAudioUiState.cleanup = null;
    }
    if (!btn) return;
    setSpeakerButtonPlaying(btn, false);
  };
  practiceAudioUiState.cleanup = cleanup;

  audioManager.stopCurrentAudio();
  audioManager.playAudio(
    state.currentLevel,
    unitName,
    currentChar,
    currentChar,
    'char',
    null,
    cleanup,
  ).then((success) => {
    if (!success) {
      cleanup();
      showToast('暂无录音', 'info');
    }
  }).catch((err) => {
    cleanup();
    showToast('播放失败: ' + err.message, 'error');
  });
}

function playSpecificListenCharAudio(char) {
  playCharAudio(char);
}

async function playSeeOptionAudio(char, btn = null) {
  const inMainSeeMode = state.mainViewMode === 'see' && state.appSection === 'home';
  const inNotebookSeePractice = state.profileView === 'notebookPractice' && state.notebook.practice.mode === 'see';
  if ((!inMainSeeMode && !inNotebookSeePractice) || state.isTeachingMode || !char) return;
  if (btn?.classList.contains('revealed')) return;
  const preferredLevel = inNotebookSeePractice
    ? state.notebook.practice.level
    : state.currentLevel;
  const context = await resolveCharOrigin(char, preferredLevel);
  playCharAudio(char, {
    button: btn,
    setPauseIcon: true,
    level: context?.level || preferredLevel,
    unit: context?.unit || '',
  });
}

function scheduleListenModeAutoPlay() {
  if (state.mainViewMode !== 'listen' || state.isTeachingMode) return;
  setTimeout(() => {
    playListenModeAudio();
  }, 80);
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
    scheduleListenModeAutoPlay();
  }
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

async function loadNotebookData(force = false) {
  const user = localStorage.getItem(USER_KEY) || '';
  if (!user) {
    state.notebook.items = [];
    state.notebook.loading = false;
    state.notebook.error = '';
    state.notebook.loadedUser = '';
    if (state.appSection === 'profile' && state.profileView === 'main') {
      renderUnitPreservingScroll();
    } else {
      renderUnit();
    }
    return;
  }

  if (!force && state.notebook.loadedUser === user && state.notebook.items.length > 0) {
    return;
  }

  state.notebook.loading = true;
  state.notebook.error = '';
  if (state.appSection === 'profile' && state.profileView === 'main') {
    renderUnitPreservingScroll();
  } else {
    renderUnit();
  }

  if (!window.audioManager?.supabase) {
    state.notebook.items = [];
    state.notebook.loading = false;
    state.notebook.error = '数据库未连接';
    state.notebook.loadedUser = user;
    if (state.appSection === 'profile' && state.profileView === 'main') {
      renderUnitPreservingScroll();
    } else {
      renderUnit();
    }
    return;
  }

  try {
    const { data, error } = await audioManager.supabase
      .from('user_mistakes')
      .select('*')
      .eq('username', user)
      .order('last_wrong_at', { ascending: false });

    if (error) {
      throw error;
    }

    state.notebook.items = (data || []).map((item) => ({
      ...item,
      wrong_chars: normalizeWrongCharEntries(
        Array.isArray(item.wrong_chars)
          ? item.wrong_chars
          : (typeof item.wrong_chars === 'string' ? JSON.parse(item.wrong_chars || '[]') : []),
        item.level,
        item.unit,
      ),
    }));
    state.notebook.loadedUser = user;
    state.notebook.error = '';
  } catch (error) {
    console.error('加载生字本失败:', error);
    state.notebook.items = [];
    state.notebook.error = '生字本加载失败';
    state.notebook.loadedUser = user;
  } finally {
    state.notebook.loading = false;
    if (state.appSection === 'profile' && state.profileView === 'main') {
      renderUnitPreservingScroll();
    } else {
      renderUnit();
    }
  }
}

async function loadProfileProgressData(force = false) {
  const user = localStorage.getItem(USER_KEY) || '';
  if (!user) {
    state.profileProgress.grouped = {};
    state.profileProgress.total = 0;
    state.profileProgress.loading = false;
    state.profileProgress.error = '';
    state.profileProgress.loadedUser = '';
    if (state.appSection === 'profile' && state.profileView === 'main') {
      renderUnitPreservingScroll();
    } else {
      renderUnit();
    }
    return;
  }

  if (!force && state.profileProgress.loadedUser === user && Object.keys(state.profileProgress.grouped || {}).length > 0) {
    return;
  }

  state.profileProgress.loading = true;
  state.profileProgress.error = '';
  if (state.appSection === 'profile' && state.profileView === 'main') {
    renderUnitPreservingScroll();
  } else {
    renderUnit();
  }

  if (!window.audioManager?.supabase) {
    state.profileProgress.grouped = {};
    state.profileProgress.total = 0;
    state.profileProgress.loading = false;
    state.profileProgress.error = '数据库未连接';
    state.profileProgress.loadedUser = user;
    if (state.appSection === 'profile' && state.profileView === 'main') {
      renderUnitPreservingScroll();
    } else {
      renderUnit();
    }
    return;
  }

  try {
    const { data, error } = await audioManager.supabase
      .from('user_progress')
      .select('*')
      .eq('username', user);

    if (error) throw error;

    const records = data || [];
    const uniqueChars = new Set(records.map((record) => record.char));
    const grouped = {};
    records.forEach((record) => {
      const level = record.level || '未知等级';
      const unit = record.unit || '未知单元';
      if (!grouped[level]) grouped[level] = {};
      if (!grouped[level][unit]) grouped[level][unit] = [];
      grouped[level][unit].push(record.char);
    });

    state.profileProgress.grouped = grouped;
    state.profileProgress.total = uniqueChars.size;
    state.profileProgress.loadedUser = user;
    state.profileProgress.error = '';
  } catch (error) {
    console.error('加载学习进度失败:', error);
    state.profileProgress.grouped = {};
    state.profileProgress.total = 0;
    state.profileProgress.error = '学习进度加载失败';
    state.profileProgress.loadedUser = user;
  } finally {
    state.profileProgress.loading = false;
    if (state.appSection === 'profile' && state.profileView === 'main') {
      renderUnitPreservingScroll();
    } else {
      renderUnit();
    }
  }
}

async function loadProfilePageData(force = false, { showQueryToasts = true } = {}) {
  const dismissToast = showQueryToasts
    ? showPersistentToast('正在查询数据中...', 'info')
    : () => {};
  const queryToastStart = showQueryToasts ? Date.now() : 0;
  try {
    await Promise.all([
      loadNotebookData(force),
      loadProfileProgressData(force),
    ]);
  } finally {
    if (showQueryToasts) {
      const elapsed = Date.now() - queryToastStart;
      const minVisibleMs = 500;
      if (elapsed < minVisibleMs) {
        await new Promise((resolve) => setTimeout(resolve, minVisibleMs - elapsed));
      }
    }
    dismissToast();
    if (showQueryToasts) {
      showToast('查询完毕！', 'success');
    }
  }
}

function resetProfilePageData() {
  state.profileProgress.expanded = false;
  state.profileProgress.loading = false;
  state.profileProgress.error = '';
  state.profileProgress.loadedUser = '';
  state.profileProgress.total = 0;
  state.profileProgress.grouped = {};

  state.notebook.loading = false;
  state.notebook.error = '';
  state.notebook.loadedUser = '';
  state.notebook.items = [];
  state.notebook.expandedSections.listen = false;
  state.notebook.expandedSections.see = false;
  state.notebook.expandedLevels.listen = {};
  state.notebook.expandedLevels.see = {};
}

export async function refreshProfilePageDataAfterLogin() {
  await loadProfilePageData(true, { showQueryToasts: true });
}

export function clearProfilePageDataAfterLogout() {
  resetProfilePageData();
  if (state.appSection === 'profile') {
    renderUnit();
  }
}

function chunkNotebookItems(items, size = 5) {
  const groups = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}

function getNotebookGroups(mode) {
  const items = (state.notebook.items || [])
    .filter((item) => item.mistake_mode === mode)
    .sort((a, b) => new Date(a.created_at || a.last_wrong_at || 0) - new Date(b.created_at || b.last_wrong_at || 0));

  const grouped = {};
  items.forEach((item) => {
    const level = item.level || '未分级';
    if (!grouped[level]) grouped[level] = [];
    grouped[level].push(item);
  });

  const levels = Object.keys(grouped).sort((a, b) => {
    const na = parseInt(String(a).replace(/\D/g, ''), 10) || 0;
    const nb = parseInt(String(b).replace(/\D/g, ''), 10) || 0;
    return nb - na;
  });

  return levels.flatMap((level) => chunkNotebookItems(grouped[level], 5));
}

function getNotebookGroupsByLevel(mode) {
  const items = (state.notebook.items || [])
    .filter((item) => item.mistake_mode === mode)
    .sort((a, b) => new Date(a.created_at || a.last_wrong_at || 0) - new Date(b.created_at || b.last_wrong_at || 0));

  const grouped = {};
  items.forEach((item) => {
    const level = item.level || '未分级';
    if (!grouped[level]) grouped[level] = [];
    grouped[level].push(item);
  });

  const levels = Object.keys(grouped).sort((a, b) => {
    const na = parseInt(String(a).replace(/\D/g, ''), 10) || 0;
    const nb = parseInt(String(b).replace(/\D/g, ''), 10) || 0;
    return nb - na;
  });

  return Object.fromEntries(levels.map((level) => [level, chunkNotebookItems(grouped[level], 5)]));
}

function setNotebookSectionExpanded(mode, expanded) {
  state.notebook.expandedSections[mode] = expanded;
  renderUnitPreservingScroll();
}

function setNotebookLevelExpanded(mode, level, expanded) {
  if (!state.notebook.expandedLevels[mode]) {
    state.notebook.expandedLevels[mode] = {};
  }
  state.notebook.expandedLevels[mode][level] = expanded;
  renderUnitPreservingScroll();
}

function navigateNotebookReviewCard(offset) {
  return notebookEngine.navigateNotebookReviewCard(offset);
}

function navigateNotebookReviewCardTo(targetIndex) {
  return notebookEngine.navigateNotebookReviewCardTo(targetIndex);
}

function navigateNotebookReviewGroup(offset) {
  return notebookEngine.navigateNotebookReviewGroup(offset);
}

function openNotebookReview(mode, level, groupIndex) {
  return notebookEngine.openNotebookReview(mode, level, groupIndex);
}

function initializeNotebookPracticeSession(mode, level, groupIndex, { allowRemoval = true } = {}) {
  return notebookEngine.initializeNotebookPracticeSession(mode, level, groupIndex, { allowRemoval });
}

function openNotebookPractice(mode, level, groupIndex) {
  return notebookEngine.openNotebookPractice(mode, level, groupIndex);
}

async function returnToNotebookList() {
  return notebookSupport.returnToNotebookList();
}

function getNotebookPracticeQuestion() {
  return notebookEngine.getNotebookPracticeQuestion();
}

function findNotebookPracticeMistakeItem(char) {
  return notebookEngine.findNotebookPracticeMistakeItem(char);
}

function findExactNotebookPracticeMistakeItem(char) {
  return notebookEngine.findExactNotebookPracticeMistakeItem(char);
}

function findPersistedNotebookMistakeItem({ char, level, unit, mistakeMode }) {
  return notebookEngine.findPersistedNotebookMistakeItem({ char, level, unit, mistakeMode });
}

function getNotebookPracticeCharContext(char) {
  return notebookEngine.getNotebookPracticeCharContext(char);
}

async function removeUserMistakeRecord({ char, level, unit, mistakeMode }) {
  return notebookSupport.removeUserMistakeRecord({ char, level, unit, mistakeMode });
}

async function removeWrongCharEntryFromMistakeRecord({
  ownerChar,
  ownerLevel,
  ownerUnit,
  mistakeMode,
  wrongChar,
  wrongLevel,
  wrongUnit,
}) {
  return notebookSupport.removeWrongCharEntryFromMistakeRecord({
    ownerChar,
    ownerLevel,
    ownerUnit,
    mistakeMode,
    wrongChar,
    wrongLevel,
    wrongUnit,
  });
}

function playNotebookPracticeAudio() {
  return notebookSupport.playNotebookPracticeAudio();
}

async function handleNotebookListenPracticeAnswer(selectedChar) {
  return notebookEngine.handleNotebookListenPracticeAnswer(selectedChar);
}

async function handleNotebookSeePracticeAnswer(selectedChar) {
  return notebookEngine.handleNotebookSeePracticeAnswer(selectedChar);
}

function switchNotebookPracticeGroup(offset) {
  return notebookEngine.switchNotebookPracticeGroup(offset);
}

function setProfileView(view) {
  return notebookSupport.setProfileView(view);
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

async function jumpToNotebookOrigin(level, unit, char) {
  return notebookSupport.jumpToNotebookOrigin(level, unit, char);
}

function returnToHomeStudy() {
  state.appSection = 'home';
  if (state.mainViewMode !== 'study') {
    setMainViewMode('study', { resetListen: false, autoPlay: false });
    return;
  }
  renderUnit();
  saveCurrentPosition();
}

function getCurrentUnitChars() {
  const unitName = getCurrentUnitName();
  return Object.keys(state.currentData?.[unitName] || {});
}

function navigateHomeCard(targetIndex, direction = 'next') {
  if (state.appSection !== 'home' || state.mainViewMode !== 'study' || state.isTeachingMode) return;
  const chars = getCurrentUnitChars();
  if (!chars.length) return;
  const nextIndex = Math.max(0, Math.min(targetIndex, chars.length - 1));
  if (nextIndex === state.homeCardIndex) return;
  state.homeCardMotion = direction;
  state.homeCardIndex = nextIndex;
  stopLearnBatchPlayback(true);
  renderUnit();
}

function navigateHomeCardByOffset(offset) {
  const chars = getCurrentUnitChars();
  if (!chars.length) return;
  const nextIndex = state.homeCardIndex + offset;
  if (nextIndex < 0 || nextIndex >= chars.length) return;
  navigateHomeCard(nextIndex, offset > 0 ? 'next' : 'prev');
}

function showPracticeCompletionModal(mode = getActivePracticeMode()) {
  completionModalState.kind = 'main';
  completionModalState.mode = mode;
  const session = getPracticeState(mode);
  const modal = document.getElementById('listenCompletionModal');
  const correctList = document.getElementById('listenCorrectList');
  const wrongList = document.getElementById('listenWrongList');
  const summary = document.getElementById('listenCompletionSummary');
  const retryBtn = document.getElementById('retryListenBtn');
  const nextBtn = document.getElementById('nextListenUnitBtn');
  const replayBtn = document.getElementById('listenReplayBtn');
  if (!modal || !correctList || !wrongList || !summary || !session) return;

  stopActiveAudioPlayback();
  if (replayBtn) {
    setSpeakerButtonPlaying(replayBtn, false);
    replayBtn.disabled = false;
  }

  const correctQuestions = session.questions.filter((question) => question.countedCorrect === true);
  const wrongQuestions = session.questions.filter((question) => question.countedCorrect === false);
  const hasRetryTargets = session.questions.some((question) => (question.wrongSelections || []).length > 0);

  summary.textContent = wrongQuestions.length === 0
    ? '全部正确！'
    : `本单元共 ${session.sequence.length} 个字，选对 ${correctQuestions.length} 个，未选对 ${wrongQuestions.length} 个。`;

  correctList.innerHTML = correctQuestions.length > 0
    ? correctQuestions.map((question) => `<span class="listen-result-char success">${escapeHtml(question.char)}</span>`).join('')
    : '<span class="listen-result-empty">暂无</span>';

  wrongList.innerHTML = wrongQuestions.length > 0
    ? wrongQuestions.map((question) => {
        const wrongChars = question.wrongSelections.join(',');
        return `<div class="listen-result-row error">${escapeHtml(question.char)}(误认为：${escapeHtml(wrongChars)})</div>`;
      }).join('')
    : '<span class="listen-result-empty">无，表现很棒</span>';

  if (retryBtn) {
    retryBtn.style.display = hasRetryTargets ? 'inline-flex' : 'none';
    retryBtn.textContent = mode === 'see' ? '重新练' : '重新听';
  }

  if (nextBtn) {
    nextBtn.textContent = mode === 'see' ? '下一单元' : '下一单元';
  }

  modal.classList.add('active');
}

function showNotebookPracticeCompletionModal() {
  return notebookSupport.showNotebookPracticeCompletionModal();
}

const notebookEngine = createNotebookEngine({
  state,
  normalizeWrongCharEntries,
  findWrongCharEntry,
  getNotebookGroupsByLevel,
  shuffleArray,
  buildListenOptions,
  renderUnit,
  showToast,
  playNotebookPracticeAudio,
  stopActiveAudioPlayback,
  waitForNextFrame,
  flushNotebookMutations,
  showNotebookPracticeCompletionModal,
  getCurrentUnitName,
  resolveCharOrigin,
  updateUserMistakeRecord,
  trackNotebookMutation,
  removeUserMistakeRecord,
  removeWrongCharEntryFromMistakeRecord,
  currentLevel: () => state.currentLevel,
  markQuestionCorrect,
  markQuestionMistaken,
});

const notebookSupport = createNotebookSupport({
  state,
  completionModalState,
  normalizeWrongCharEntries,
  escapeHtml,
  renderUnitPreservingScroll,
  renderUnit,
  saveCurrentPosition,
  loadNotebookData,
  stopActiveAudioPlayback,
  flushNotebookMutations,
  loadProfilePageData,
  navigateToUnit,
  getCurrentUnitChars,
  setMainViewMode,
  getNotebookPracticeQuestion,
  getNotebookPracticeCharContext,
  practiceAudioUiState,
  setSpeakerButtonPlaying,
  showToast,
  getUserKey: () => localStorage.getItem(USER_KEY) || '',
  invalidateNotebookCache,
});

const practiceEngine = createPracticeEngine({
  state,
  getActivePracticeMode,
  getPracticeState,
  initializeSeeSession,
  initializeListenSession,
  getCurrentUnitName,
  renderUnit,
  saveCurrentPosition,
  scheduleListenModeAutoPlay,
  stopActiveAudioPlayback,
  showPracticeCompletionModal,
  ensureListenSession,
  ensureSeeSession,
  getListenQuestion,
  getSeeQuestion,
  showToast,
  playSpecificListenCharAudio,
  updateUserMistakeRecord,
  findCharUnitInCurrentLevel,
  playCharAudio,
});

async function retryCurrentNotebookPracticeGroup() {
  return notebookEngine.retryCurrentNotebookPracticeGroup();
}

function moveToNextNotebookPracticeGroup() {
  return notebookEngine.moveToNextNotebookPracticeGroup();
}

function retryWrongPracticeItems(mode = getActivePracticeMode()) {
  return practiceEngine.retryWrongPracticeItems(mode);
}

function navigateListenHistory(direction) {
  return practiceEngine.navigateListenHistory(direction);
}

function navigateSeeHistory(direction) {
  return practiceEngine.navigateSeeHistory(direction);
}

function handleListenModeAnswer(selectedChar) {
  return practiceEngine.handleListenModeAnswer(selectedChar);
}

function handleSeeModeAnswer(selectedChar) {
  return practiceEngine.handleSeeModeAnswer(selectedChar);
}

function markQuestionCorrect(question) {
  return practiceEngine.markQuestionCorrect(question);
}

function markQuestionMistaken(question, selectedChar, options = {}) {
  return practiceEngine.markQuestionMistaken(question, selectedChar, options);
}

function addNotebookWrongSelectionEntry(question, entry) {
  return notebookEngine.addNotebookWrongSelectionEntry(question, entry);
}

function setLearnBatchBtnState(btn, isPlaying) {
  if (!btn) return;
  btn.classList.toggle('playing', isPlaying);
  btn.title = isPlaying ? '暂停整单元朗读' : '整单元朗读';
  btn.innerHTML = isPlaying ? getPauseIconHtml() : getPlayIconHtml();
}

function clearLearnBatchHighlight() {
  document.querySelectorAll('.unit-reading-active').forEach(el => {
    el.classList.remove('unit-reading-active');
  });
}

async function syncLearnBatchCard(item) {
  if (state.appSection !== 'home' || state.mainViewMode !== 'study' || state.isTeachingMode) {
    return;
  }

  const chars = getCurrentUnitChars();
  const targetIndex = chars.indexOf(item.rootChar);
  if (targetIndex === -1 || targetIndex === state.homeCardIndex) return;

  state.homeCardMotion = targetIndex > state.homeCardIndex ? 'next' : 'prev';
  state.homeCardIndex = targetIndex;
  renderUnit();

  await new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

async function applyLearnBatchHighlight(item) {
  await syncLearnBatchCard(item);
  clearLearnBatchHighlight();
  if (!item) return;

  const cards = Array.from(document.querySelectorAll('#app .card'));
  const card = cards.find(c => c.dataset.char === item.rootChar);
  if (!card) return;

  let target = null;
  if (item.type === 'char') {
    target = card.querySelector('.char-text');
  } else if (item.type === 'word') {
    const words = card.querySelectorAll('.word-item');
    target = words[item.index] || null;
  } else if (item.type === 'sentence') {
    target = card.querySelector('.text-content.sentence');
  }

  if (target) {
    target.classList.add('unit-reading-active');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function buildLearnBatchSequence() {
  const unitName = state.unitKeys?.[state.currentUnitIndex];
  const unitData = unitName ? state.currentData?.[unitName] : null;
  if (!unitData) return [];

  const queue = [];
  for (const [rootChar, info] of Object.entries(unitData)) {
    queue.push({
      rootChar,
      text: rootChar,
      type: 'char',
      index: null,
      level: state.currentLevel,
      unit: unitName,
    });

    const words = (info && Array.isArray(info.词)) ? info.词 : [];
    words.forEach((word, idx) => {
      queue.push({
        rootChar,
        text: word,
        type: 'word',
        index: idx,
        level: state.currentLevel,
        unit: unitName,
      });
    });

    const sentence = (info && typeof info.句 === 'string') ? info.句.trim() : '';
    if (sentence) {
      queue.push({
        rootChar,
        text: sentence,
        type: 'sentence',
        index: null,
        level: state.currentLevel,
        unit: unitName,
      });
    }
  }

  return queue;
}

function stopLearnBatchPlayback(resetQueue = true) {
  learnBatchPlayback.token += 1;
  learnBatchPlayback.running = false;
  learnBatchPlayback.paused = false;
  audioManager.stopCurrentAudio();
  clearLearnBatchHighlight();

  if (learnBatchPlayback.button) {
    setLearnBatchBtnState(learnBatchPlayback.button, false);
  }

  if (resetQueue) {
    learnBatchPlayback.sequence = [];
    learnBatchPlayback.index = 0;
    learnBatchPlayback.button = null;
  }
}

async function runLearnBatchPlaybackLoop(token) {
  while (
    token === learnBatchPlayback.token &&
    learnBatchPlayback.running &&
    !learnBatchPlayback.paused &&
    learnBatchPlayback.index < learnBatchPlayback.sequence.length
  ) {
    const item = learnBatchPlayback.sequence[learnBatchPlayback.index];
    await applyLearnBatchHighlight(item);

    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };

      audioManager.playAudio(
        item.level,
        item.unit,
        item.rootChar,
        item.text,
        item.type,
        item.index,
        finish,
      ).then((success) => {
        if (!success) finish();
      }).catch(() => {
        finish();
      });
    });

    if (
      token !== learnBatchPlayback.token ||
      !learnBatchPlayback.running ||
      learnBatchPlayback.paused
    ) {
      break;
    }

    learnBatchPlayback.index += 1;
  }

  if (
    token === learnBatchPlayback.token &&
    learnBatchPlayback.running &&
    !learnBatchPlayback.paused &&
    learnBatchPlayback.index >= learnBatchPlayback.sequence.length
  ) {
    showToast('单元朗读完成', 'success');
    stopLearnBatchPlayback(true);
  }
}

function toggleLearnBatchPlayback(btn) {
  if (state.isTeachingMode) return;

  if (learnBatchPlayback.running) {
    learnBatchPlayback.paused = true;
    learnBatchPlayback.running = false;
    audioManager.stopCurrentAudio();
    setLearnBatchBtnState(btn, false);
    showToast('已暂停', 'info');
    return;
  }

  if (learnBatchPlayback.paused && learnBatchPlayback.sequence.length > 0) {
    learnBatchPlayback.running = true;
    learnBatchPlayback.paused = false;
    learnBatchPlayback.button = btn;
    setLearnBatchBtnState(btn, true);
    runLearnBatchPlaybackLoop(learnBatchPlayback.token);
    showToast('继续朗读', 'info');
    return;
  }

  const queue = buildLearnBatchSequence();
  if (queue.length === 0) {
    showToast('当前单元无可播放内容', 'error');
    return;
  }

  learnBatchPlayback.sequence = queue;
  learnBatchPlayback.index = 0;
  learnBatchPlayback.token += 1;
  learnBatchPlayback.running = true;
  learnBatchPlayback.paused = false;
  learnBatchPlayback.button = btn;
  setLearnBatchBtnState(btn, true);
  runLearnBatchPlaybackLoop(learnBatchPlayback.token);
  showToast('开始整单元朗读', 'info');
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
    loadProfilePageData(true, { showQueryToasts: true });
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
    stopLearnBatchPlayback,
    navigateListenHistory,
    navigateSeeHistory,
    navigateHomeCardByOffset,
    navigateNotebookReviewCard,
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
    returnToHomeStudy,
    setAppSection,
    setMainViewMode,
    switchTeachingMode,
    tryEnterTeachingMode,
    toggleInlineCollapse,
    loadProfileProgressData,
    setProfileView,
  });

  setupPracticeInteractionEvents({
    appEl,
    state,
    searchInput,
    unitNavigator,
    isPracticeMode,
    handleNotebookListenPracticeAnswer,
    handleListenModeAnswer,
    handleNotebookSeePracticeAnswer,
    handleSeeModeAnswer,
    playSeeOptionAudio,
    stopActiveAudioPlayback,
    navigateNotebookReviewCardTo,
    getCurrentUnitChars,
    navigateHomeCard,
    navigateHomeCardByOffset,
    enterLearning,
    navigateSeeHistory,
    navigateListenHistory,
    navigateNotebookReviewCard,
    setMainViewMode,
    playListenModeAudio,
  });

  setupProfileNotebookEvents({
    appEl,
    toolbarNotebookSwitcher,
    state,
    toggleInlineCollapse,
    navigateToUnit,
    openNotebookReview,
    openNotebookPractice,
    returnToNotebookList,
    jumpToNotebookOrigin,
    navigateNotebookReviewGroup,
    navigateNotebookReviewCard,
    switchNotebookPracticeGroup,
    playNotebookPracticeAudio,
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
    toggleLearnBatchPlayback,
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
    moveToNextNotebookPracticeGroup,
    resetCurrentPracticeState: () => {
      if (state.mainViewMode === 'see') {
        state.seeMode = createEmptySeeState(getCurrentUnitName());
      } else {
        state.listenMode = createEmptyListenState(getCurrentUnitName());
      }
    },
    refreshCurrentUnitView,
    saveCurrentPosition,
    retryCurrentNotebookPracticeGroup,
    retryWrongPracticeItems,
    getActivePracticeMode,
  });
}
