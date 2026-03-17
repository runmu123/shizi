// 核心应用逻辑：初始化、级别加载、事件、导航
import { state, cacheSuffix } from './state.js';
import { TEACH_PASSWORD, USER_KEY } from './constants.js';
import { showToast, showPersistentToast } from './toast.js';
import { saveCurrentPosition } from './position.js';
import { renderUnit, renderSearchResult, escapeHtml, applyResponsiveLayout, updateAppShell } from './ui.js';
import { enterLearning, exitLearning, updateLearningViewBtn } from './learning.js';
import { enterBatchRecord } from './batch-record.js';
import { enterBatchPlay } from './batch-play.js';

const learnBatchPlayback = {
  running: false,
  paused: false,
  sequence: [],
  index: 0,
  token: 0,
  button: null,
};

const seeDragState = {
  active: false,
  pointerId: null,
  ghostEl: null,
  sourceEl: null,
  currentTarget: null,
  suppressClickUntil: 0,
};

const practiceAudioUiState = {
  button: null,
  cleanup: null,
};

// ===== 级别初始化 =====
export async function initLevels() {
  const dropdown = document.getElementById('levelDropdown');
  dropdown.innerHTML = '';
  state.LEVELS = [];

  let i = 0;
  while (true) {
    const level = `L${i}`;
    try {
      const res = await fetch(`yaml/contents_${level}.yaml${cacheSuffix}`, { method: 'GET' });
      if (res.ok) {
        const text = await res.text();
        try {
          if (window.jsyaml) {
            state.levelDataCache[level] = jsyaml.load(text);
          }
        } catch (yamlErr) {
          console.warn('解析 YAML 失败:', level, yamlErr);
        }

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
    let data = state.levelDataCache[level];
    if (!data) {
      const response = await fetch(`yaml/contents_${level}.yaml${cacheSuffix}`);
      if (!response.ok) {
        throw new Error(`HTTP 错误! 状态码: ${response.status}`);
      }
      const text = await response.text();
      data = jsyaml.load(text);
      if (!data) throw new Error('YAML 数据为空或无效');
      state.levelDataCache[level] = data;
    }

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
    let data = state.levelDataCache[level];

    if (!data) {
      try {
        const response = await fetch(`yaml/contents_${level}.yaml${cacheSuffix}`);
        if (response.ok) {
          const text = await response.text();
          data = jsyaml.load(text);
          state.levelDataCache[level] = data;
        }
      } catch (e) {
        console.error(`获取 ${level} 数据出错:`, e);
      }
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
  const menuSwitchTeach = document.getElementById('menuSwitchTeach');
  const menuSwitchLearn = document.getElementById('menuSwitchLearn');
  const menuStats = document.getElementById('menuStats');

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
  if (menuSwitchTeach) {
    menuSwitchTeach.style.display = state.isTeachingMode ? 'none' : 'block';
  }
  if (menuSwitchLearn) {
    menuSwitchLearn.style.display = state.isTeachingMode ? 'block' : 'none';
  }
  if (menuStats) {
    menuStats.style.display = state.isTeachingMode ? 'block' : 'none';
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

function createEmptyListenState(unitName = '') {
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

function createEmptySeeState(unitName = '') {
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

function initializeListenSession(chars, unitName = getCurrentUnitName()) {
  const normalizedChars = Array.from(new Set((chars || []).filter(Boolean)));
  state.listenMode = createEmptyListenState(unitName);
  state.listenMode.sequence = shuffleArray(normalizedChars);
  state.listenMode.questions = state.listenMode.sequence.map((char) => ({
    char,
    options: buildListenOptions(char),
    selectedChar: '',
    answered: false,
    hadMistake: false,
    countedCorrect: null,
    wrongSelections: [],
  }));
  state.listenMode.options = state.listenMode.questions[0]?.options ? [...state.listenMode.questions[0].options] : [];
}

function initializeSeeSession(chars, unitName = getCurrentUnitName()) {
  const normalizedChars = Array.from(new Set((chars || []).filter(Boolean)));
  state.seeMode = createEmptySeeState(unitName);
  state.seeMode.sequence = shuffleArray(normalizedChars);
  state.seeMode.questions = state.seeMode.sequence.map((char) => ({
    char,
    options: buildListenOptions(char),
    selectedChar: '',
    answered: false,
    hadMistake: false,
    countedCorrect: null,
    wrongSelections: [],
    revealedOptions: [],
  }));
  state.seeMode.options = state.seeMode.questions[0]?.options ? [...state.seeMode.questions[0].options] : [];
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
  const unitName = getCurrentUnitName();
  const unitData = unitName ? state.currentData?.[unitName] : null;
  const unitChars = Object.keys(unitData || {});
  const shouldReset =
    forceReset ||
    state.listenMode.unitName !== unitName ||
    state.listenMode.sequence.length === 0;

  if (shouldReset) {
    initializeListenSession(unitChars, unitName);
  }

  const question = getListenQuestion();
  const currentChar = question?.char || '';
  state.listenMode.options = question ? [...question.options] : [];
  return currentChar;
}

function ensureSeeSession(forceReset = false) {
  const unitName = getCurrentUnitName();
  const unitData = unitName ? state.currentData?.[unitName] : null;
  const unitChars = Object.keys(unitData || {});
  const shouldReset =
    forceReset ||
    state.seeMode.unitName !== unitName ||
    state.seeMode.sequence.length === 0;

  if (shouldReset) {
    initializeSeeSession(unitChars, unitName);
  }

  const question = getSeeQuestion();
  const currentChar = question?.char || '';
  state.seeMode.options = question ? [...question.options] : [];
  return currentChar;
}

function getCurrentListenChar() {
  return state.listenMode.sequence[state.listenMode.currentIndex] || '';
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

function playCharAudio(char, { button = null, setPauseIcon = false } = {}) {
  if (!char || state.isTeachingMode || !window.audioManager) return;

  const unitName = findCharUnitInCurrentLevel(char);
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
    state.currentLevel,
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

function playSeeOptionAudio(char, btn = null) {
  if (state.mainViewMode !== 'see' || state.isTeachingMode || !char) return;
  if (btn?.classList.contains('revealed')) return;
  playCharAudio(char, { button: btn, setPauseIcon: true });
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

async function loadNotebookData(force = false) {
  const user = localStorage.getItem(USER_KEY) || '';
  if (!user) {
    state.notebook.items = [];
    state.notebook.loading = false;
    state.notebook.error = '';
    state.notebook.loadedUser = '';
    renderUnit();
    return;
  }

  if (!force && state.notebook.loadedUser === user && state.notebook.items.length > 0) {
    return;
  }

  state.notebook.loading = true;
  state.notebook.error = '';
  renderUnit();

  if (!window.audioManager?.supabase) {
    state.notebook.items = [];
    state.notebook.loading = false;
    state.notebook.error = '数据库未连接';
    state.notebook.loadedUser = user;
    renderUnit();
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
      wrong_chars: Array.isArray(item.wrong_chars)
        ? item.wrong_chars
        : (typeof item.wrong_chars === 'string' ? JSON.parse(item.wrong_chars || '[]') : []),
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
    renderUnit();
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
    renderUnit();
    return;
  }

  if (!force && state.profileProgress.loadedUser === user && Object.keys(state.profileProgress.grouped || {}).length > 0) {
    return;
  }

  state.profileProgress.loading = true;
  state.profileProgress.error = '';
  renderUnit();

  if (!window.audioManager?.supabase) {
    state.profileProgress.grouped = {};
    state.profileProgress.total = 0;
    state.profileProgress.loading = false;
    state.profileProgress.error = '数据库未连接';
    state.profileProgress.loadedUser = user;
    renderUnit();
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
    renderUnit();
  }
}

async function loadProfilePageData(force = false) {
  const dismissToast = showPersistentToast('正在查询数据中...', 'info');
  try {
    await Promise.all([
      loadNotebookData(force),
      loadProfileProgressData(force),
    ]);
  } finally {
    dismissToast();
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

function setNotebookSectionExpanded(mode, expanded) {
  state.notebook.expandedSections[mode] = expanded;
  renderUnit();
}

function setNotebookLevelExpanded(mode, level, expanded) {
  if (!state.notebook.expandedLevels[mode]) {
    state.notebook.expandedLevels[mode] = {};
  }
  state.notebook.expandedLevels[mode][level] = expanded;
  renderUnit();
}

function navigateNotebookReviewCard(offset) {
  const groups = getNotebookGroups(state.notebook.reviewMode);
  const group = groups[state.notebook.reviewGroupIndex] || [];
  const nextIndex = state.notebook.reviewCardIndex + offset;
  if (nextIndex < 0 || nextIndex >= group.length) return;
  state.notebook.reviewMotion = offset > 0 ? 'next' : 'prev';
  state.notebook.reviewCardIndex = nextIndex;
  renderUnit();
}

function navigateNotebookReviewGroup(offset) {
  const groups = getNotebookGroups(state.notebook.reviewMode);
  const nextGroup = state.notebook.reviewGroupIndex + offset;
  if (nextGroup < 0 || nextGroup >= groups.length) return;
  state.notebook.reviewGroupIndex = nextGroup;
  state.notebook.reviewCardIndex = 0;
  state.notebook.reviewMotion = 'none';
  renderUnit();
}

function openNotebookReview(mode, groupIndex) {
  state.profileView = 'notebookReview';
  state.notebook.reviewMode = mode;
  state.notebook.reviewGroupIndex = groupIndex;
  state.notebook.reviewCardIndex = 0;
  state.notebook.reviewMotion = 'none';
  renderUnit();
}

function getNotebookPracticeSourceItems(mode, groupIndex) {
  return getNotebookGroups(mode)[groupIndex] || [];
}

function initializeNotebookPracticeSession(mode, groupIndex) {
  const sourceItems = getNotebookPracticeSourceItems(mode, groupIndex);
  const chars = mode === 'see'
    ? Array.from(new Set(sourceItems.flatMap((item) => [item.char, ...(Array.isArray(item.wrong_chars) ? item.wrong_chars : [])]).filter(Boolean)))
    : Array.from(new Set(sourceItems.map((item) => item.char).filter(Boolean)));

  state.notebook.practice = {
    mode,
    groupIndex,
    title: `第${groupIndex + 1}组`,
    sourceItems,
    sequence: shuffleArray(chars),
    questions: chars.map((char) => ({
      char,
      options: buildListenOptions(char),
      selectedChar: '',
      answered: false,
      hadMistake: false,
      countedCorrect: null,
      wrongSelections: [],
      revealedOptions: [],
    })),
    currentIndex: 0,
    answeredChars: [],
    currentMistaken: false,
  };
}

function openNotebookPractice(mode, groupIndex) {
  initializeNotebookPracticeSession(mode, groupIndex);
  state.profileView = 'notebookPractice';
  renderUnit();
  if (mode === 'listen') {
    setTimeout(() => playNotebookPracticeAudio(), 80);
  }
}

function returnToNotebookList() {
  state.profileView = 'main';
  renderUnit();
}

function getNotebookPracticeQuestion() {
  return state.notebook.practice.questions[state.notebook.practice.currentIndex] || null;
}

function getNotebookPracticeCharContext(char) {
  const exact = state.notebook.practice.sourceItems.find((item) => item.char === char);
  if (exact) return exact;
  const related = state.notebook.practice.sourceItems.find((item) => Array.isArray(item.wrong_chars) && item.wrong_chars.includes(char));
  if (related) return related;
  return state.notebook.practice.sourceItems[0] || { level: state.currentLevel, unit: getCurrentUnitName(), char };
}

function playNotebookPracticeAudio() {
  if (state.profileView !== 'notebookPractice' || state.notebook.practice.mode !== 'listen' || state.isTeachingMode) return;
  const question = getNotebookPracticeQuestion();
  if (!question) return;
  const context = getNotebookPracticeCharContext(question.char);
  const btn = document.getElementById('notebookListenReplayBtn');
  if (!btn) return;

  if (btn.classList.contains('playing')) {
    stopActiveAudioPlayback();
    return;
  }

  const cleanup = () => {
    if (practiceAudioUiState.button === btn) {
      practiceAudioUiState.button = null;
      practiceAudioUiState.cleanup = null;
    }
    setSpeakerButtonPlaying(btn, false);
  };

  setSpeakerButtonPlaying(btn, true);
  practiceAudioUiState.button = btn;
  practiceAudioUiState.cleanup = cleanup;
  audioManager.stopCurrentAudio();
  audioManager.playAudio(context.level, context.unit, question.char, question.char, 'char', null, cleanup).catch((err) => {
    cleanup();
    showToast('播放失败: ' + err.message, 'error');
  });
}

function goToNextNotebookPracticeItem() {
  stopActiveAudioPlayback();
  const session = state.notebook.practice;
  if (session.currentIndex >= session.sequence.length - 1) {
    showToast('本组练习完成', 'success');
    returnToNotebookList();
    return;
  }
  session.currentIndex += 1;
  session.currentMistaken = false;
  renderUnit();
  if (session.mode === 'listen') {
    setTimeout(() => playNotebookPracticeAudio(), 80);
  }
}

function handleNotebookListenPracticeAnswer(selectedChar) {
  const session = state.notebook.practice;
  if (state.profileView !== 'notebookPractice' || session.mode !== 'listen') return;
  const question = getNotebookPracticeQuestion();
  const currentChar = question?.char || '';
  if (!question || !currentChar) return;

  if (selectedChar === currentChar) {
    if (!question.answered) {
      question.answered = true;
      if (!session.answeredChars.includes(currentChar)) {
        session.answeredChars.push(currentChar);
      }
      showToast('选择正确', 'success');
      setTimeout(() => goToNextNotebookPracticeItem(), 280);
    }
    return;
  }

  question.hadMistake = true;
  if (!question.wrongSelections.includes(selectedChar)) {
    question.wrongSelections.push(selectedChar);
  }
  showToast('错误！请重新选择', 'error');
  playCharAudio(selectedChar);
}

function handleNotebookSeePracticeAnswer(selectedChar) {
  const session = state.notebook.practice;
  if (state.profileView !== 'notebookPractice' || session.mode !== 'see') return;
  const question = getNotebookPracticeQuestion();
  const currentChar = question?.char || '';
  if (!question || !currentChar) return;

  if (selectedChar === currentChar) {
    if (!question.answered) {
      question.answered = true;
      if (!session.answeredChars.includes(currentChar)) {
        session.answeredChars.push(currentChar);
      }
      renderUnit();
      showToast('选择正确', 'success');
      setTimeout(() => goToNextNotebookPracticeItem(), 280);
    }
    return;
  }

  question.hadMistake = true;
  if (!question.wrongSelections.includes(selectedChar)) {
    question.wrongSelections.push(selectedChar);
  }
  if (!question.revealedOptions.includes(selectedChar)) {
    question.revealedOptions.push(selectedChar);
  }
  renderUnit();
  showToast('错误！请重新选择', 'error');
  playCharAudio(selectedChar);
}

function switchNotebookPracticeGroup(offset) {
  const groups = getNotebookGroups(state.notebook.practice.mode);
  const nextGroup = state.notebook.practice.groupIndex + offset;
  if (nextGroup < 0 || nextGroup >= groups.length) return;
  initializeNotebookPracticeSession(state.notebook.practice.mode, nextGroup);
  renderUnit();
  if (state.notebook.practice.mode === 'listen') {
    setTimeout(() => playNotebookPracticeAudio(), 80);
  }
}

function setProfileView(view) {
  state.profileView = view;
  renderUnit();
  saveCurrentPosition();
  if (view === 'notebook') {
    loadNotebookData();
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

    const nextWrongChars = Array.from(
      new Set([
        ...((data && Array.isArray(data.wrong_chars)) ? data.wrong_chars : []),
        ...(wrongChar ? [wrongChar] : []),
      ].filter(Boolean))
    );

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
  if (!level || !unit || !char) return;
  state.appSection = 'home';
  await navigateToUnit(level, unit);
  const chars = getCurrentUnitChars();
  const nextIndex = chars.indexOf(char);
  if (nextIndex !== -1) {
    state.homeCardIndex = nextIndex;
    state.homeCardMotion = 'none';
  }
  setMainViewMode('study', { resetListen: false, autoPlay: false });
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
    retryBtn.style.display = wrongQuestions.length > 0 ? 'inline-flex' : 'none';
    retryBtn.textContent = mode === 'see' ? '重新练' : '重新听';
  }

  if (nextBtn) {
    nextBtn.textContent = mode === 'see' ? '下一单元' : '下一单元';
  }

  modal.classList.add('active');
}

function retryWrongPracticeItems(mode = getActivePracticeMode()) {
  const session = getPracticeState(mode);
  if (!session) return;

  const wrongChars = Array.from(
    new Set(
      session.questions
        .filter((question) => question.countedCorrect === false)
        .flatMap((question) => [question.char, ...(question.wrongSelections || [])])
        .filter(Boolean)
    )
  );

  if (!wrongChars.length) {
    showToast(mode === 'see' ? '当前没有需要重新练的字' : '当前没有需要重新听的字', 'info');
    return;
  }

  if (mode === 'see') {
    initializeSeeSession(wrongChars, getCurrentUnitName());
  } else {
    initializeListenSession(wrongChars, getCurrentUnitName());
  }
  renderUnit();
  saveCurrentPosition();
  if (mode === 'listen') {
    scheduleListenModeAutoPlay();
  }
}

function goToNextListenItem() {
  stopActiveAudioPlayback();
  if (state.listenMode.currentIndex >= state.listenMode.sequence.length - 1) {
    renderUnit();
    showPracticeCompletionModal('listen');
    return;
  }

  state.listenMode.currentIndex += 1;
  state.listenMode.currentMistaken = false;
  ensureListenSession(false);
  state.listenMode.options = getListenQuestion()?.options ? [...getListenQuestion().options] : [];
  renderUnit();
  saveCurrentPosition();
  scheduleListenModeAutoPlay();
}

function goToNextSeeItem() {
  stopActiveAudioPlayback();
  if (state.seeMode.currentIndex >= state.seeMode.sequence.length - 1) {
    renderUnit();
    showPracticeCompletionModal('see');
    return;
  }

  state.seeMode.currentIndex += 1;
  state.seeMode.currentMistaken = false;
  ensureSeeSession(false);
  state.seeMode.options = getSeeQuestion()?.options ? [...getSeeQuestion().options] : [];
  renderUnit();
  saveCurrentPosition();
}

function handleListenModeAnswer(selectedChar) {
  if (state.mainViewMode !== 'listen' || state.isTeachingMode) return;

  const question = getListenQuestion();
  const currentChar = question?.char || '';
  if (!currentChar || !question) return;

  if (selectedChar === currentChar) {
    question.selectedChar = selectedChar;
    if (!question.answered) {
      question.answered = true;
      question.countedCorrect = question.hadMistake ? false : true;

      if (!question.hadMistake && !state.listenMode.firstTryCorrectChars.includes(currentChar)) {
        state.listenMode.firstTryCorrectChars.push(currentChar);
      }
      if (!state.listenMode.answeredChars.includes(currentChar)) {
        state.listenMode.answeredChars.push(currentChar);
      }

      showToast('选择正确', 'success');
      stopActiveAudioPlayback();
      setTimeout(() => {
        goToNextListenItem();
      }, 280);
    } else {
      showToast('已切回正确答案', 'success');
      setTimeout(() => {
        navigateListenHistory('next');
      }, 280);
    }
    return;
  }

  state.listenMode.currentMistaken = true;
  question.selectedChar = selectedChar;
  question.hadMistake = true;
  if (!question.wrongSelections.includes(selectedChar)) {
    question.wrongSelections.push(selectedChar);
  }

  if (question.countedCorrect === true || question.countedCorrect === null) {
    question.countedCorrect = false;
  }

  if (!state.listenMode.mistakeChars.includes(currentChar)) {
    state.listenMode.mistakeChars.push(currentChar);
  }
  updateUserMistakeRecord({
    char: currentChar,
    level: state.currentLevel,
    unit: getCurrentUnitName(),
    mistakeMode: 'listen',
    wrongChar: selectedChar,
  });
  showToast('错误！请重新选择', 'error');
  playSpecificListenCharAudio(selectedChar);
}

function navigateListenHistory(direction) {
  if (state.mainViewMode !== 'listen' || state.isTeachingMode) return;

  const maxNavigableIndex = Math.min(
    state.listenMode.answeredChars.length,
    Math.max(0, state.listenMode.sequence.length - 1),
  );
  if (maxNavigableIndex < 0) return;

  if (direction === 'prev') {
    if (state.listenMode.currentIndex <= 0) return;
    state.listenMode.currentIndex -= 1;
  } else if (direction === 'next') {
    if (state.listenMode.currentIndex >= maxNavigableIndex) return;
    state.listenMode.currentIndex += 1;
  } else {
    return;
  }

  state.listenMode.currentMistaken = !!getListenQuestion()?.hadMistake;
  state.listenMode.options = getListenQuestion()?.options ? [...getListenQuestion().options] : [];
  renderUnit();
  playListenModeAudio();
}

function navigateSeeHistory(direction) {
  if (state.mainViewMode !== 'see' || state.isTeachingMode) return;

  const maxNavigableIndex = Math.min(
    state.seeMode.answeredChars.length,
    Math.max(0, state.seeMode.sequence.length - 1),
  );
  if (maxNavigableIndex < 0) return;

  if (direction === 'prev') {
    if (state.seeMode.currentIndex <= 0) return;
    state.seeMode.currentIndex -= 1;
  } else if (direction === 'next') {
    if (state.seeMode.currentIndex >= maxNavigableIndex) return;
    state.seeMode.currentIndex += 1;
  } else {
    return;
  }

  state.seeMode.currentMistaken = !!getSeeQuestion()?.hadMistake;
  state.seeMode.options = getSeeQuestion()?.options ? [...getSeeQuestion().options] : [];
  renderUnit();
}

function handleSeeModeAnswer(selectedChar) {
  if (state.mainViewMode !== 'see' || state.isTeachingMode) return;

  const question = getSeeQuestion();
  const currentChar = question?.char || '';
  if (!currentChar || !question || !selectedChar) return;

  if (selectedChar === currentChar) {
    question.selectedChar = selectedChar;
    if (!question.answered) {
      question.answered = true;
      question.countedCorrect = question.hadMistake ? false : true;

      if (!question.hadMistake && !state.seeMode.firstTryCorrectChars.includes(currentChar)) {
        state.seeMode.firstTryCorrectChars.push(currentChar);
      }
      if (!state.seeMode.answeredChars.includes(currentChar)) {
        state.seeMode.answeredChars.push(currentChar);
      }

      renderUnit();
      showToast('选择正确', 'success');
      stopActiveAudioPlayback();
      setTimeout(() => {
        goToNextSeeItem();
      }, 280);
    } else {
      renderUnit();
      showToast('已切回正确答案', 'success');
      setTimeout(() => {
        navigateSeeHistory('next');
      }, 280);
    }
    return;
  }

  state.seeMode.currentMistaken = true;
  question.selectedChar = selectedChar;
  question.hadMistake = true;
  if (!question.wrongSelections.includes(selectedChar)) {
    question.wrongSelections.push(selectedChar);
  }
  if (!question.revealedOptions.includes(selectedChar)) {
    question.revealedOptions.push(selectedChar);
  }

  if (question.countedCorrect === true || question.countedCorrect === null) {
    question.countedCorrect = false;
  }

  if (!state.seeMode.mistakeChars.includes(currentChar)) {
    state.seeMode.mistakeChars.push(currentChar);
  }

  updateUserMistakeRecord({
    char: currentChar,
    level: state.currentLevel,
    unit: getCurrentUnitName(),
    mistakeMode: 'see',
    wrongChar: selectedChar,
  });
  renderUnit();
  showToast('错误！请重新选择', 'error');
  playCharAudio(selectedChar);
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

  const menuDropdown = document.getElementById('menuDropdown');
  const menuSwitchTeach = document.getElementById('menuSwitchTeach');
  const menuSwitchLearn = document.getElementById('menuSwitchLearn');
  const currentLevelBtn = document.getElementById('currentLevelBtn');
  const levelDropdown = document.getElementById('levelDropdown');
  const searchInput = document.getElementById('searchInput');
  const unitNavigator = document.querySelector('.unit-navigator');
  const prevBtn = document.getElementById('prevUnit');
  const nextBtn = document.getElementById('nextUnit');
  const unitSelect = document.getElementById('unitSelect');
  const appEl = document.getElementById('app');
  const earStudyBtn = document.getElementById('earStudyToggleBtnMain');
  const eyeStudyBtn = document.getElementById('eyeStudyToggleBtnMain');
  const bottomNav = document.querySelector('.bottom-nav');

  // 密码弹窗元素
  const passwordModal = document.getElementById('passwordModal');
  const passwordInput = document.getElementById('passwordInput');
  const passwordError = document.getElementById('passwordError');
  const listenCompletionModal = document.getElementById('listenCompletionModal');
  const closeListenCompletion = document.getElementById('closeListenCompletion');
  const retryListenBtn = document.getElementById('retryListenBtn');
  const nextListenUnitBtn = document.getElementById('nextListenUnitBtn');
  let listenTouchStartX = 0;
  let listenTouchStartY = 0;
  let homeTouchStartX = 0;
  let homeTouchStartY = 0;

  updateEarStudyButtonForMode();

  window.addEventListener('shizi-auth-changed', () => {
    invalidateNotebookCache();
    invalidateProfileProgressCache();
  });

  if (state.appSection === 'profile') {
    loadProfilePageData(true);
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

  const tryEnterTeachingMode = () => {
    const currentUser = localStorage.getItem(USER_KEY);
    if (currentUser === 'admin') {
      switchTeachingMode(true);
    } else {
      passwordModal.classList.add('active');
      lockScroll();
      passwordInput.value = '';
      passwordError.style.display = 'none';
      passwordInput.focus();
    }
  };

  if (menuSwitchTeach) {
    menuSwitchTeach.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menuDropdown) menuDropdown.classList.remove('show');
      if (!state.isTeachingMode) {
        tryEnterTeachingMode();
      }
    });
  }

  if (menuSwitchLearn) {
    menuSwitchLearn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menuDropdown) menuDropdown.classList.remove('show');
      if (state.isTeachingMode) {
        switchTeachingMode(false);
      }
    });
  }

  // ===== 密码弹窗 =====
  const handlePasswordSubmit = () => {
    const password = passwordInput.value.trim();
    if (password === TEACH_PASSWORD) {
      switchTeachingMode(true);
      passwordModal.classList.remove('active');
      unlockScroll();
    } else {
      passwordError.style.display = 'block';
      passwordInput.value = '';
      passwordInput.focus();
    }
  };

  document.getElementById('confirmPassword').addEventListener('click', handlePasswordSubmit);

  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handlePasswordSubmit();
  });

  document.getElementById('cancelPassword').addEventListener('click', () => {
    passwordModal.classList.remove('active');
    unlockScroll();
  });

  passwordModal.addEventListener('click', (e) => {
    if (e.target === passwordModal) {
      passwordModal.classList.remove('active');
      unlockScroll();
    }
  });

  // ===== 级别选择 =====
  currentLevelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    levelDropdown.classList.toggle('show');
    currentLevelBtn.classList.toggle('active');
  });

  levelDropdown.addEventListener('click', async (e) => {
    const opt = e.target.closest('.level-option');
    if (!opt) return;

    const level = opt.dataset.level;
    if (level !== state.currentLevel) {
      currentLevelBtn.textContent = level;
      const options = levelDropdown.querySelectorAll('.level-option');
      options.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      levelDropdown.classList.remove('show');
      currentLevelBtn.classList.remove('active');

      state.currentLevel = level;
      state.homeCardIndex = 0;
      state.homeCardMotion = 'none';
      stopLearnBatchPlayback(true);
      await loadLevel(level);
      saveCurrentPosition();
    } else {
      levelDropdown.classList.remove('show');
      currentLevelBtn.classList.remove('active');
    }
  });

  // ===== 搜索 =====
  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    stopLearnBatchPlayback(true);
    if (val && val.length === 1) {
      if (isPracticeMode()) {
        state.mainViewMode = 'study';
        updateEarStudyButtonForMode();
        saveCurrentPosition();
      }
      searchChar(val);
    } else if (val.length === 0) {
      unitNavigator.style.visibility = 'visible';
      refreshCurrentUnitView({
        resetListen: isPracticeMode(),
        autoPlayListen: false,
      });
    }
  });

  // ===== 导航按钮 =====
  const goPrevUnit = () => {
    if (state.currentUnitIndex > 0) {
      stopLearnBatchPlayback(true);
      state.currentUnitIndex--;
      state.homeCardIndex = 0;
      state.homeCardMotion = 'none';
      refreshCurrentUnitView({
        resetListen: isPracticeMode(),
        autoPlayListen: state.mainViewMode === 'listen' && !state.isTeachingMode,
      });
      saveCurrentPosition();
    }
  };

  const goNextUnit = () => {
    if (state.currentUnitIndex < state.unitKeys.length - 1) {
      stopLearnBatchPlayback(true);
      state.currentUnitIndex++;
      state.homeCardIndex = 0;
      state.homeCardMotion = 'none';
      refreshCurrentUnitView({
        resetListen: isPracticeMode(),
        autoPlayListen: state.mainViewMode === 'listen' && !state.isTeachingMode,
      });
      saveCurrentPosition();
    }
  };

  prevBtn.addEventListener('click', goPrevUnit);
  nextBtn.addEventListener('click', goNextUnit);

  unitSelect.addEventListener('change', (e) => {
    const idx = parseInt(e.target.value, 10);
    if (!isNaN(idx) && idx >= 0 && idx < state.unitKeys.length) {
      stopLearnBatchPlayback(true);
      state.currentUnitIndex = idx;
      state.homeCardIndex = 0;
      state.homeCardMotion = 'none';
      refreshCurrentUnitView({
        resetListen: isPracticeMode(),
        autoPlayListen: state.mainViewMode === 'listen' && !state.isTeachingMode,
      });
      saveCurrentPosition();
    }
  });

  // ===== 主页面键盘导航 =====
  document.addEventListener('keydown', (e) => {
    // 仅在主页面可见时生效，避免与学习/批量页面冲突
    if (document.getElementById('learningView').classList.contains('active')) return;
    if (document.getElementById('batchRecordView').classList.contains('active')) return;
    if (document.getElementById('batchPlayView').classList.contains('active')) return;
    if (document.getElementById('passwordModal').classList.contains('active')) return;
    if (document.getElementById('listenCompletionModal')?.classList.contains('active')) return;

    // 输入场景不拦截按键
    if (
      e.target.tagName === 'INPUT' ||
      e.target.tagName === 'TEXTAREA' ||
      e.target.tagName === 'SELECT' ||
      e.target.isContentEditable
    ) {
      return;
    }

    if (state.mainViewMode === 'listen' && !state.isTeachingMode) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateListenHistory('prev');
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateListenHistory('next');
        return;
      }
    }

    if (state.mainViewMode === 'see' && !state.isTeachingMode) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateSeeHistory('prev');
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateSeeHistory('next');
        return;
      }
    }

    if (state.appSection === 'home' && state.mainViewMode === 'study' && !state.isTeachingMode) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateHomeCardByOffset(-1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateHomeCardByOffset(1);
        return;
      }
    }

    if (state.appSection === 'profile' && state.profileView === 'notebookReview') {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateNotebookReviewCard(-1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateNotebookReviewCard(1);
        return;
      }
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goPrevUnit();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goNextUnit();
    }
  });

  // ===== 点击汉字进入学习模式 =====
  appEl.addEventListener('click', (e) => {
    const listenOptionBtn = e.target.closest('.listen-option-btn');
    if (listenOptionBtn) {
      e.stopPropagation();
      if (state.profileView === 'notebookPractice' && state.notebook.practice.mode === 'listen') {
        handleNotebookListenPracticeAnswer(listenOptionBtn.dataset.char || '');
        return;
      }
      handleListenModeAnswer(listenOptionBtn.dataset.char || '');
      return;
    }

    const seeOptionBtn = e.target.closest('.see-audio-option');
    if (seeOptionBtn) {
      e.stopPropagation();
      if (state.profileView === 'notebookPractice' && state.notebook.practice.mode === 'see') {
        if (Date.now() < seeDragState.suppressClickUntil) return;
        if (seeOptionBtn.classList.contains('revealed')) return;
        if (seeOptionBtn.classList.contains('playing')) {
          stopActiveAudioPlayback();
          return;
        }
        playSeeOptionAudio(seeOptionBtn.dataset.char || '', seeOptionBtn);
        return;
      }
      if (Date.now() < seeDragState.suppressClickUntil) return;
      if (seeOptionBtn.classList.contains('revealed')) return;
      if (seeOptionBtn.classList.contains('playing')) {
        stopActiveAudioPlayback();
        return;
      }
      playSeeOptionAudio(seeOptionBtn.dataset.char || '', seeOptionBtn);
      return;
    }

    const unitCharLink = e.target.closest('.unit-char-link');
    if (unitCharLink) {
      const targetChar = unitCharLink.dataset.char;
      if (targetChar && state.appSection === 'home' && state.mainViewMode === 'study') {
        const chars = getCurrentUnitChars();
        const nextIndex = chars.indexOf(targetChar);
        if (nextIndex !== -1) {
          navigateHomeCard(nextIndex, nextIndex > state.homeCardIndex ? 'next' : 'prev');
        }
      }
      return;
    }

    const homeCardNavBtn = e.target.closest('#homeCardPrevBtn, #homeCardNextBtn');
    if (homeCardNavBtn) {
      e.stopPropagation();
      navigateHomeCardByOffset(homeCardNavBtn.id === 'homeCardPrevBtn' ? -1 : 1);
      return;
    }

    const notebookReviewChar = e.target.closest('[data-notebook-review-char]');
    if (notebookReviewChar) {
      const nextIndex = parseInt(notebookReviewChar.dataset.notebookReviewChar || '0', 10);
      if (!Number.isNaN(nextIndex)) {
        state.notebook.reviewMotion = nextIndex > state.notebook.reviewCardIndex ? 'next' : 'prev';
        state.notebook.reviewCardIndex = nextIndex;
        renderUnit();
      }
      return;
    }

    const charBox = e.target.closest('.char-box');
    if (charBox) {
      const charText = charBox.querySelector('.char-text');
      const char = charText ? charText.textContent.trim() : '';
      if (char) {
        const container = charBox.closest('.char-header-container');
        const playBtn = container ? container.querySelector('.play-btn') : null;
        let level = state.currentLevel;
        let unit = state.unitKeys ? state.unitKeys[state.currentUnitIndex] : '';

        if (playBtn && playBtn.dataset.level) {
          level = playBtn.dataset.level;
          unit = playBtn.dataset.unit;
        }
        enterLearning(char, level, unit);
      }
    }
  });

  // ===== 全局音频播放/录音处理 =====
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.play-btn');
    if (!btn) return;
    if (['learnBatchPlayBtnMain', 'earStudyToggleBtnMain', 'eyeStudyToggleBtnMain', 'batchRecordBtnMain', 'batchPlayBtnMain'].includes(btn.id)) return;

    if (btn.classList.contains('processing') || btn.disabled) return;

    e.stopPropagation();

    const text = btn.dataset.text;
    const type = btn.dataset.type;
    const rootChar = btn.dataset.rootChar;
    const level = btn.dataset.level || state.currentLevel;
    const unit = btn.dataset.unit || (state.unitKeys ? state.unitKeys[state.currentUnitIndex] : '');
    const indexStr = btn.dataset.index;
    const index = indexStr ? parseInt(indexStr, 10) : null;

    if (!text || !level || !unit) {
      console.warn('缺少音频上下文:', { text, type, rootChar, level, unit });
      return;
    }

    if (state.isTeachingMode) {
      // 录音逻辑
      if (audioManager.isRecording) {
        btn.classList.add('recording-processing');
        btn.disabled = true;
        btn.innerHTML = '...';
        showToast('正在上传...', 'info');

        try {
          const blob = await audioManager.stopRecording();
          if (blob) {
            // 并行执行：本地回放 + 上传
            playRecordedBlob(blob).catch(err => {
              showToast('录音预览播放失败: ' + err.message, 'error');
            });
            await audioManager.uploadAudio(blob, level, unit, rootChar, text, type, index);
            showToast('上传成功！', 'success');
          } else {
            showToast('录音失败：未获取到音频数据', 'error');
          }
        } catch (err) {
          showToast('上传失败: ' + err.message, 'error');
        } finally {
          btn.classList.remove('recording-processing');
          btn.classList.remove('recording-active');
          btn.disabled = false;
          updateBtnIcon(btn, true);
        }
      } else {
        try {
          await audioManager.startRecording();
          btn.classList.add('recording-active');
          const isSmall = btn.dataset.isSmall === 'true';
          btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="${isSmall ? 'width:16px;height:16px' : ''}">
            <rect x="6" y="6" width="12" height="12" />
          </svg>`;
          showToast('开始录音', 'info');
        } catch (err) {
          showToast('无法启动录音: ' + err.message, 'error');
        }
      }
    } else {
      // 播放逻辑
      if (state.isLoopingAudio) {
        state.isLoopingAudio = false;
        audioManager.stopCurrentAudio();
        return;
      }

      if (btn.classList.contains('playing')) {
        audioManager.stopCurrentAudio();
        if (btn.id === 'listenReplayBtn') {
          setSpeakerButtonPlaying(btn, false);
        } else {
          updateBtnIcon(btn, false);
        }
        return;
      }

      setSpeakerButtonPlaying(btn, true);

      const onStop = () => {
        updateBtnIcon(btn, false);
        btn.disabled = false;
      };

      try {
        const success = await audioManager.playAudio(level, unit, rootChar, text, type, index, onStop);
        if (!success) {
          showToast('暂无录音', 'info');
          onStop();
        }
      } catch (err) {
        showToast('播放失败: ' + err.message, 'error');
        onStop();
      }
    }
  });

  // ===== 学习模式整单元朗读按钮 =====
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#learnBatchPlayBtnMain');
    if (!btn) return;
    e.stopPropagation();
    toggleLearnBatchPlayback(btn);
  });

  appEl.addEventListener('touchstart', (e) => {
    if (!isPracticeMode() || state.isTeachingMode) return;
    const panel = e.target.closest('.listen-mode-panel');
    if (!panel || e.touches.length !== 1) return;
    listenTouchStartX = e.touches[0].clientX;
    listenTouchStartY = e.touches[0].clientY;
  }, { passive: true });

  appEl.addEventListener('touchstart', (e) => {
    if (state.appSection !== 'home' || state.mainViewMode !== 'study' || state.isTeachingMode) return;
    const stage = e.target.closest('.home-card-stage');
    if (!stage || e.touches.length !== 1) return;
    homeTouchStartX = e.touches[0].clientX;
    homeTouchStartY = e.touches[0].clientY;
  }, { passive: true });

  appEl.addEventListener('touchend', (e) => {
    if (!isPracticeMode() || state.isTeachingMode) return;
    const panel = e.target.closest('.listen-mode-panel');
    if (!panel || e.changedTouches.length !== 1) return;

    const deltaX = e.changedTouches[0].clientX - listenTouchStartX;
    const deltaY = e.changedTouches[0].clientY - listenTouchStartY;

    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    if (deltaX > 0) {
      if (state.mainViewMode === 'see') {
        navigateSeeHistory('prev');
      } else {
        navigateListenHistory('prev');
      }
    } else {
      if (state.mainViewMode === 'see') {
        navigateSeeHistory('next');
      } else {
        navigateListenHistory('next');
      }
    }
  }, { passive: true });

  appEl.addEventListener('touchend', (e) => {
    if (state.appSection !== 'home' || state.mainViewMode !== 'study' || state.isTeachingMode) return;
    const stage = e.target.closest('.home-card-stage');
    if (!stage || e.changedTouches.length !== 1) return;

    const deltaX = e.changedTouches[0].clientX - homeTouchStartX;
    const deltaY = e.changedTouches[0].clientY - homeTouchStartY;
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    navigateHomeCardByOffset(deltaX > 0 ? -1 : 1);
  }, { passive: true });

  appEl.addEventListener('touchstart', (e) => {
    if (state.appSection !== 'profile' || state.profileView !== 'notebookReview') return;
    const stage = e.target.closest('.home-card-stage');
    if (!stage || e.touches.length !== 1) return;
    homeTouchStartX = e.touches[0].clientX;
    homeTouchStartY = e.touches[0].clientY;
  }, { passive: true });

  appEl.addEventListener('touchend', (e) => {
    if (state.appSection !== 'profile' || state.profileView !== 'notebookReview') return;
    const stage = e.target.closest('.home-card-stage');
    if (!stage || e.changedTouches.length !== 1) return;
    const deltaX = e.changedTouches[0].clientX - homeTouchStartX;
    const deltaY = e.changedTouches[0].clientY - homeTouchStartY;
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    navigateNotebookReviewCard(deltaX > 0 ? -1 : 1);
  }, { passive: true });

  const clearSeeDragState = () => {
    if (seeDragState.sourceEl) {
      seeDragState.sourceEl.classList.remove('dragging');
    }
    if (seeDragState.currentTarget) {
      seeDragState.currentTarget.classList.remove('drag-over');
    }
    if (seeDragState.ghostEl?.parentNode) {
      seeDragState.ghostEl.parentNode.removeChild(seeDragState.ghostEl);
    }
    seeDragState.active = false;
    seeDragState.pointerId = null;
    seeDragState.ghostEl = null;
    seeDragState.sourceEl = null;
    seeDragState.currentTarget = null;
  };

  const updateSeeDragTarget = (clientX, clientY) => {
    if (seeDragState.currentTarget) {
      seeDragState.currentTarget.classList.remove('drag-over');
      seeDragState.currentTarget = null;
    }

    const hovered = document.elementFromPoint(clientX, clientY)?.closest('.see-audio-option:not(.revealed)');
    if (hovered) {
      hovered.classList.add('drag-over');
      seeDragState.currentTarget = hovered;
    }
  };

  appEl.addEventListener('pointerdown', (e) => {
    const isSeePage =
      (!state.isTeachingMode && state.mainViewMode === 'see') ||
      (state.profileView === 'notebookPractice' && state.notebook.practice.mode === 'see');
    if (!isSeePage || state.isTeachingMode) return;
    const card = e.target.closest('.see-char-card');
    if (!card || e.button !== 0) return;

    e.preventDefault();
    clearSeeDragState();

    const rect = card.getBoundingClientRect();
    const ghostEl = card.cloneNode(true);
    ghostEl.style.position = 'fixed';
    ghostEl.style.left = `${rect.left}px`;
    ghostEl.style.top = `${rect.top}px`;
    ghostEl.style.width = `${rect.width}px`;
    ghostEl.style.height = `${rect.height}px`;
    ghostEl.style.pointerEvents = 'none';
    ghostEl.style.zIndex = '9999';
    ghostEl.style.margin = '0';
    ghostEl.classList.add('dragging');
    document.body.appendChild(ghostEl);

    seeDragState.active = true;
    seeDragState.pointerId = e.pointerId;
    seeDragState.ghostEl = ghostEl;
    seeDragState.sourceEl = card;
    card.classList.add('dragging');
    updateSeeDragTarget(e.clientX, e.clientY);
  });

  appEl.addEventListener('pointermove', (e) => {
    if (!seeDragState.active || seeDragState.pointerId !== e.pointerId) return;
    e.preventDefault();

    if (seeDragState.ghostEl) {
      const ghostRect = seeDragState.ghostEl.getBoundingClientRect();
      seeDragState.ghostEl.style.left = `${e.clientX - ghostRect.width / 2}px`;
      seeDragState.ghostEl.style.top = `${e.clientY - ghostRect.height / 2}px`;
    }

    updateSeeDragTarget(e.clientX, e.clientY);
  });

  const finishSeeDrag = (e) => {
    if (!seeDragState.active || seeDragState.pointerId !== e.pointerId) return;
    e.preventDefault();
    const target = seeDragState.currentTarget;
    clearSeeDragState();
    if (target) {
      seeDragState.suppressClickUntil = Date.now() + 320;
      if (state.profileView === 'notebookPractice' && state.notebook.practice.mode === 'see') {
        handleNotebookSeePracticeAnswer(target.dataset.char || '');
      } else {
        handleSeeModeAnswer(target.dataset.char || '');
      }
    }
  };

  appEl.addEventListener('pointerup', finishSeeDrag);
  appEl.addEventListener('pointercancel', finishSeeDrag);

  // ===== 学习模式 ear/study 按钮 =====
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#earStudyToggleBtnMain');
    if (!btn || state.isTeachingMode) return;
    e.stopPropagation();
    if (searchInput.value) {
      searchInput.value = '';
      unitNavigator.style.visibility = 'visible';
    }
    setMainViewMode(state.mainViewMode === 'listen' ? 'study' : 'listen', {
      resetListen: true,
      autoPlay: true,
    });
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#eyeStudyToggleBtnMain');
    if (!btn || state.isTeachingMode) return;
    e.stopPropagation();
    if (searchInput.value) {
      searchInput.value = '';
      unitNavigator.style.visibility = 'visible';
    }
    setMainViewMode(state.mainViewMode === 'see' ? 'study' : 'see', {
      resetListen: true,
      autoPlay: false,
    });
  });

  // ===== 听音识字播放按钮 =====
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#listenReplayBtn');
    if (!btn) return;
    e.stopPropagation();
    if (btn.classList.contains('playing')) {
      stopActiveAudioPlayback();
      return;
    }
    playListenModeAudio();
  });

  // ===== 批量录音按钮事件 =====
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#batchRecordBtnMain');
    if (btn) {
      e.stopPropagation();
      enterBatchRecord();
    }
  });

  // ===== 批量播放按钮事件 =====
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#batchPlayBtnMain');
    if (btn) {
      e.stopPropagation();
      enterBatchPlay();
    }
  });

  // ===== 点击外部关闭下拉菜单 =====
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.level-selector-wrapper')) {
      levelDropdown.classList.remove('show');
      currentLevelBtn.classList.remove('active');
    }
  });

  if (bottomNav) {
    bottomNav.addEventListener('click', (e) => {
      const item = e.target.closest('.bottom-nav-item');
      if (!item) return;
      e.stopPropagation();
      const section = item.dataset.section || 'home';
      const learningActive = document.getElementById('learningView')?.classList.contains('active');
      if (section === 'home') {
        if (learningActive) {
          exitLearning();
          state.appSection = 'home';
          saveCurrentPosition();
          updateAppShell();
          return;
        }
        returnToHomeStudy();
        return;
      }
      if (learningActive) {
        exitLearning();
      }
      setAppSection(section);
    });
  }

  appEl.addEventListener('click', (e) => {
    const actionCard = e.target.closest('.section-action-card');
    if (!actionCard) return;
    const action = actionCard.dataset.action;
    if (!action) return;

    if (action === 'listen') {
      setAppSection('home');
      setMainViewMode('listen', { resetListen: true, autoPlay: true });
      return;
    }

    if (action === 'see') {
      setAppSection('home');
      setMainViewMode('see', { resetListen: true, autoPlay: false });
      return;
    }

    if (action === 'download') {
      document.getElementById('menuDownload')?.click();
      return;
    }

    if (action === 'clear-cache') {
      document.getElementById('menuClearCache')?.click();
      return;
    }

    if (action === 'toggle-teaching') {
      const targetId = state.isTeachingMode ? 'menuSwitchLearn' : 'menuSwitchTeach';
      document.getElementById(targetId)?.click();
      setAppSection('home');
      return;
    }

    if (action === 'refresh') {
      document.getElementById('menuRefresh')?.click();
      return;
    }

    if (action === 'stats') {
      document.getElementById('menuStats')?.click();
      return;
    }

    if (action === 'login') {
      document.getElementById('menuLogin')?.click();
      return;
    }

    if (action === 'progress') {
      state.profileProgress.expanded = !state.profileProgress.expanded;
      renderUnit();
      if (state.profileProgress.expanded) {
        loadProfileProgressData();
      }
      return;
    }

    if (action === 'notebook') {
      setProfileView('notebook');
      return;
    }

    if (action === 'notebook-item') {
      return;
    }
  });

  appEl.addEventListener('click', (e) => {
    const progressHeader = e.target.closest('[data-profile-progress-header]');
    if (progressHeader) {
      progressHeader.classList.toggle('active');
      progressHeader.nextElementSibling?.classList.toggle('show');
      return;
    }

    const progressNavBtn = e.target.closest('[data-profile-progress-nav]');
    if (progressNavBtn) {
      const [level, unit] = (progressNavBtn.dataset.profileProgressNav || '').split('|');
      if (level && unit) {
        navigateToUnit(level, unit);
      }
      return;
    }

    const toggle = e.target.closest('[data-notebook-section]');
    if (!toggle) return;
    const mode = toggle.dataset.notebookSection;
    setNotebookSectionExpanded(mode, !state.notebook.expandedSections[mode]);
  });

  appEl.addEventListener('click', (e) => {
    const notebookLevelHeader = e.target.closest('[data-notebook-level-header]');
    if (!notebookLevelHeader) return;
    const [mode, level] = (notebookLevelHeader.dataset.notebookLevelHeader || '').split('|');
    if (!mode || !level) return;
    const current = !!state.notebook.expandedLevels?.[mode]?.[level];
    setNotebookLevelExpanded(mode, level, !current);
  });

  appEl.addEventListener('click', (e) => {
    const notebookActionBtn = e.target.closest('[data-notebook-action], [data-notebook-review-nav], [data-notebook-review-card], [data-notebook-practice-group]');
    if (!notebookActionBtn) return;
    e.stopPropagation();

    if (notebookActionBtn.dataset.notebookAction === 'review') {
      openNotebookReview(notebookActionBtn.dataset.mode || 'listen', parseInt(notebookActionBtn.dataset.groupIndex || '0', 10));
      return;
    }

    if (notebookActionBtn.dataset.notebookAction === 'practice') {
      openNotebookPractice(notebookActionBtn.dataset.mode || 'listen', parseInt(notebookActionBtn.dataset.groupIndex || '0', 10));
      return;
    }

    if (notebookActionBtn.dataset.notebookAction === 'back-to-notebook') {
      returnToNotebookList();
      return;
    }

    if (notebookActionBtn.dataset.notebookAction === 'jump') {
      jumpToNotebookOrigin(
        notebookActionBtn.dataset.level || '',
        notebookActionBtn.dataset.unit || '',
        notebookActionBtn.dataset.char || '',
      );
      return;
    }

    if (notebookActionBtn.dataset.notebookReviewNav) {
      navigateNotebookReviewGroup(notebookActionBtn.dataset.notebookReviewNav === 'next' ? 1 : -1);
      return;
    }

    if (notebookActionBtn.dataset.notebookReviewCard) {
      navigateNotebookReviewCard(notebookActionBtn.dataset.notebookReviewCard === 'next' ? 1 : -1);
      return;
    }

    if (notebookActionBtn.dataset.notebookPracticeGroup) {
      switchNotebookPracticeGroup(notebookActionBtn.dataset.notebookPracticeGroup === 'next' ? 1 : -1);
    }
  });

  appEl.addEventListener('click', (e) => {
    if (state.profileView !== 'notebookPractice') return;
    const replayBtn = e.target.closest('#notebookListenReplayBtn');
    if (replayBtn) {
      e.stopPropagation();
      playNotebookPracticeAudio();
    }
  });

  appEl.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-home-action]');
    if (!actionBtn) return;
    const action = actionBtn.dataset.homeAction;
    if (action === 'batch-play') {
      e.stopPropagation();
      enterBatchPlay();
      return;
    }
    if (action === 'batch-record') {
      e.stopPropagation();
      enterBatchRecord();
    }
  });

  if (closeListenCompletion) {
    closeListenCompletion.addEventListener('click', () => {
      if (listenCompletionModal) {
        listenCompletionModal.classList.remove('active');
      }
    });
  }

  if (listenCompletionModal) {
    listenCompletionModal.addEventListener('click', (e) => {
      if (e.target === listenCompletionModal) {
        listenCompletionModal.classList.remove('active');
      }
    });
  }

  if (nextListenUnitBtn) {
    nextListenUnitBtn.addEventListener('click', () => {
      if (listenCompletionModal) {
        listenCompletionModal.classList.remove('active');
      }

      if (state.currentUnitIndex >= state.unitKeys.length - 1) {
        showToast('已经是最后一个单元', 'info');
        return;
      }

      state.currentUnitIndex += 1;
      state.homeCardIndex = 0;
      state.homeCardMotion = 'none';
      if (state.mainViewMode === 'see') {
        state.seeMode = createEmptySeeState(getCurrentUnitName());
      } else {
        state.listenMode = createEmptyListenState(getCurrentUnitName());
      }
      refreshCurrentUnitView({ resetListen: true, autoPlayListen: true });
      saveCurrentPosition();
    });
  }

  if (retryListenBtn) {
    retryListenBtn.addEventListener('click', () => {
      if (listenCompletionModal) {
        listenCompletionModal.classList.remove('active');
      }
      retryWrongPracticeItems(getActivePracticeMode());
    });
  }
}
