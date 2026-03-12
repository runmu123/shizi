// 核心应用逻辑：初始化、级别加载、事件、导航
import { state, cacheSuffix } from './state.js';
import { TEACH_PASSWORD, USER_KEY } from './constants.js';
import { showToast } from './toast.js';
import { saveCurrentPosition } from './position.js';
import { renderUnit, renderSearchResult, escapeHtml } from './ui.js';
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
      resetListen: state.mainViewMode === 'listen',
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
    if (!state.isTeachingMode) {
      updateEarStudyButtonForMode();
    }
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
    refreshCurrentUnitView({
      resetListen: state.mainViewMode === 'listen',
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
  return `<svg style="width:20px;height:20px"><use href="#icon-play"></use></svg>`;
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

function getStudyIconHtml() {
  return `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h440l200 200v440q0 33-23.5 56.5T760-120H200Zm0-80h560v-400H600v-160H200v560Zm80-80h400v-80H280v80Zm0-320h200v-80H280v80Zm0 160h400v-80H280v80Zm-80-320v160-160 560-560Z"/></svg>`;
}

function setEarStudyBtnState(btn, isStudyMode) {
  if (!btn) return;
  btn.innerHTML = isStudyMode ? getStudyIconHtml() : getEarIconHtml();
  btn.title = isStudyMode ? 'study' : 'ear';
  btn.setAttribute('aria-pressed', isStudyMode ? 'true' : 'false');
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

function getListenQuestion(index = state.listenMode.currentIndex) {
  return state.listenMode.questions[index] || null;
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
    state.listenMode = createEmptyListenState(unitName);
    state.listenMode.sequence = shuffleArray(unitChars);
    state.listenMode.questions = state.listenMode.sequence.map((char) => ({
      char,
      options: buildListenOptions(char),
      selectedChar: '',
      answered: false,
      hadMistake: false,
      countedCorrect: null,
      wrongSelections: [],
    }));
  }

  const question = getListenQuestion();
  const currentChar = question?.char || '';
  state.listenMode.options = question ? [...question.options] : [];
  return currentChar;
}

function getCurrentListenChar() {
  return state.listenMode.sequence[state.listenMode.currentIndex] || '';
}

function playListenModeAudio() {
  if (state.mainViewMode !== 'listen' || state.isTeachingMode) return;

  const currentChar = getCurrentListenChar();
  const unitName = findCharUnitInCurrentLevel(currentChar);
  const btn = document.getElementById('listenReplayBtn');

  if (!currentChar || !unitName || !window.audioManager) return;

  if (btn) {
    setSpeakerButtonPlaying(btn, true);
    btn.disabled = true;
  }

  const cleanup = () => {
    if (!btn) return;
    setSpeakerButtonPlaying(btn, false);
    btn.disabled = false;
  };

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
  if (!char || state.isTeachingMode || !window.audioManager) return;

  const unitName = findCharUnitInCurrentLevel(char);
  audioManager.stopCurrentAudio();
  audioManager.playAudio(
    state.currentLevel,
    unitName,
    char,
    char,
    'char',
    null,
  ).catch((err) => {
    showToast('播放失败: ' + err.message, 'error');
  });
}

function scheduleListenModeAutoPlay() {
  if (state.mainViewMode !== 'listen' || state.isTeachingMode) return;
  setTimeout(() => {
    playListenModeAudio();
  }, 80);
}

function refreshCurrentUnitView({ resetListen = false, autoPlayListen = false } = {}) {
  if (window.audioManager && typeof audioManager.stopCurrentAudio === 'function') {
    audioManager.stopCurrentAudio();
  }

  if (state.mainViewMode === 'listen' && !state.isTeachingMode) {
    ensureListenSession(resetListen);
  }

  renderUnit();

  if (autoPlayListen && state.mainViewMode === 'listen' && !state.isTeachingMode) {
    scheduleListenModeAutoPlay();
  }
}

function updateEarStudyButtonForMode() {
  const earStudyBtn = document.getElementById('earStudyToggleBtnMain');
  setEarStudyBtnState(earStudyBtn, state.mainViewMode === 'listen');
}

function setMainViewMode(mode, { resetListen = true, autoPlay = true } = {}) {
  if (mode !== 'study' && mode !== 'listen') return;
  if (state.isTeachingMode && mode === 'listen') return;

  state.mainViewMode = mode;
  updateEarStudyButtonForMode();

  refreshCurrentUnitView({
    resetListen: mode === 'listen' ? resetListen : false,
    autoPlayListen: mode === 'listen' ? autoPlay : false,
  });
  saveCurrentPosition();
}

function showListenCompletionModal() {
  const modal = document.getElementById('listenCompletionModal');
  const correctList = document.getElementById('listenCorrectList');
  const wrongList = document.getElementById('listenWrongList');
  const summary = document.getElementById('listenCompletionSummary');
  if (!modal || !correctList || !wrongList || !summary) return;

  const correctQuestions = state.listenMode.questions.filter((question) => question.countedCorrect === true);
  const wrongQuestions = state.listenMode.questions.filter((question) => question.countedCorrect === false);

  summary.textContent = wrongQuestions.length === 0
    ? '全部正确！'
    : `本单元共 ${state.listenMode.sequence.length} 个字，选对 ${correctQuestions.length} 个，未选对 ${wrongQuestions.length} 个。`;

  correctList.innerHTML = correctQuestions.length > 0
    ? correctQuestions.map((question) => `<span class="listen-result-char success">${escapeHtml(question.char)}</span>`).join('')
    : '<span class="listen-result-empty">暂无</span>';

  wrongList.innerHTML = wrongQuestions.length > 0
    ? wrongQuestions.map((question) => {
        const wrongChars = question.wrongSelections.join(',');
        return `<div class="listen-result-row error">${escapeHtml(question.char)}(误认为：${escapeHtml(wrongChars)})</div>`;
      }).join('')
    : '<span class="listen-result-empty">无，表现很棒</span>';

  modal.classList.add('active');
}

function goToNextListenItem() {
  if (state.listenMode.currentIndex >= state.listenMode.sequence.length - 1) {
    renderUnit();
    showListenCompletionModal();
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

function applyLearnBatchHighlight(item) {
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
    applyLearnBatchHighlight(item);

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

  // 密码弹窗元素
  const passwordModal = document.getElementById('passwordModal');
  const passwordInput = document.getElementById('passwordInput');
  const passwordError = document.getElementById('passwordError');
  const listenCompletionModal = document.getElementById('listenCompletionModal');
  const closeListenCompletion = document.getElementById('closeListenCompletion');
  const closeListenCompletionFooter = document.getElementById('closeListenCompletionFooter');
  const nextListenUnitBtn = document.getElementById('nextListenUnitBtn');
  let listenTouchStartX = 0;
  let listenTouchStartY = 0;

  updateEarStudyButtonForMode();

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
      if (state.mainViewMode === 'listen') {
        state.mainViewMode = 'study';
        updateEarStudyButtonForMode();
        saveCurrentPosition();
      }
      searchChar(val);
    } else if (val.length === 0) {
      unitNavigator.style.visibility = 'visible';
      refreshCurrentUnitView({
        resetListen: state.mainViewMode === 'listen',
        autoPlayListen: false,
      });
    }
  });

  // ===== 导航按钮 =====
  const goPrevUnit = () => {
    if (state.currentUnitIndex > 0) {
      stopLearnBatchPlayback(true);
      state.currentUnitIndex--;
      refreshCurrentUnitView({
        resetListen: state.mainViewMode === 'listen',
        autoPlayListen: state.mainViewMode === 'listen' && !state.isTeachingMode,
      });
      saveCurrentPosition();
    }
  };

  const goNextUnit = () => {
    if (state.currentUnitIndex < state.unitKeys.length - 1) {
      stopLearnBatchPlayback(true);
      state.currentUnitIndex++;
      refreshCurrentUnitView({
        resetListen: state.mainViewMode === 'listen',
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
      refreshCurrentUnitView({
        resetListen: state.mainViewMode === 'listen',
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
      handleListenModeAnswer(listenOptionBtn.dataset.char || '');
      return;
    }

    const unitCharLink = e.target.closest('.unit-char-link');
    if (unitCharLink) {
      const targetChar = unitCharLink.dataset.char;
      const targetCard = targetChar ? appEl.querySelector(`.card[data-char="${targetChar}"]`) : null;
      if (targetCard) {
        const navbarHeight = document.querySelector('.navbar')?.offsetHeight || 0;
        const toolbarHeight = document.querySelector('.toolbar')?.offsetHeight || 0;
        const topOffset = navbarHeight + toolbarHeight + 12;
        const targetTop = targetCard.getBoundingClientRect().top + window.scrollY - topOffset;
        window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
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
    if (['learnBatchPlayBtnMain', 'earStudyToggleBtnMain', 'batchRecordBtnMain', 'batchPlayBtnMain'].includes(btn.id)) return;

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
    if (state.mainViewMode !== 'listen' || state.isTeachingMode) return;
    const panel = e.target.closest('.listen-mode-panel');
    if (!panel || e.touches.length !== 1) return;
    listenTouchStartX = e.touches[0].clientX;
    listenTouchStartY = e.touches[0].clientY;
  }, { passive: true });

  appEl.addEventListener('touchend', (e) => {
    if (state.mainViewMode !== 'listen' || state.isTeachingMode) return;
    const panel = e.target.closest('.listen-mode-panel');
    if (!panel || e.changedTouches.length !== 1) return;

    const deltaX = e.changedTouches[0].clientX - listenTouchStartX;
    const deltaY = e.changedTouches[0].clientY - listenTouchStartY;

    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    if (deltaX > 0) {
      navigateListenHistory('prev');
    } else {
      navigateListenHistory('next');
    }
  }, { passive: true });

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

  // ===== 听音识字播放按钮 =====
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#listenReplayBtn');
    if (!btn) return;
    e.stopPropagation();
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

  if (closeListenCompletion) {
    closeListenCompletion.addEventListener('click', () => {
      if (listenCompletionModal) {
        listenCompletionModal.classList.remove('active');
      }
    });
  }

  if (closeListenCompletionFooter) {
    closeListenCompletionFooter.addEventListener('click', () => {
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
      state.listenMode = createEmptyListenState(getCurrentUnitName());
      refreshCurrentUnitView({ resetListen: true, autoPlayListen: true });
      saveCurrentPosition();
    });
  }
}
