// UI 渲染：卡片、搜索结果、听音识字视图、HTML 工具函数
import { state } from './state.js';
import { USER_KEY } from './constants.js';

const UNIT_CHAR_BASE_REM = 1.9;
const UNIT_CHAR_MIN_REM = 0.75;
const LISTEN_DESKTOP_OPTION_HEIGHT = 132;
const LISTEN_MOBILE_OPTION_HEIGHT = 108;
const LISTEN_DESKTOP_OPTION_MIN_HEIGHT = 84;
const LISTEN_MOBILE_OPTION_MIN_HEIGHT = 74;
const LISTEN_DESKTOP_OPTION_GAP = 18;
const LISTEN_MOBILE_OPTION_GAP = 14;
const LISTEN_OPTION_MIN_GAP = 8;

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function highlightChar(text, char) {
  if (!text || !char) return escapeHtml(text || '');
  const safeText = escapeHtml(text);
  const safeChar = escapeHtml(char);
  return safeText.split(safeChar).join(`<span class="highlight">${safeChar}</span>`);
}

const SECTION_ICONS = {
  home: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M560-564v-68q33-14 67.5-21t72.5-7q26 0 51 4t49 10v64q-24-9-48.5-13.5T700-600q-38 0-73 9.5T560-564Zm0 220v-68q33-14 67.5-21t72.5-7q26 0 51 4t49 10v64q-24-9-48.5-13.5T700-380q-38 0-73 9t-67 27Zm0-110v-68q33-14 67.5-21t72.5-7q26 0 51 4t49 10v64q-24-9-48.5-13.5T700-490q-38 0-73 9.5T560-454ZM260-320q47 0 91.5 10.5T440-278v-394q-41-24-87-36t-93-12q-36 0-71.5 7T120-692v396q35-12 69.5-18t70.5-6Zm260 42q44-21 88.5-31.5T700-320q36 0 70.5 6t69.5 18v-396q-33-14-68.5-21t-71.5-7q-47 0-93 12t-87 36v394Zm-40 118q-48-38-104-59t-116-21q-42 0-82.5 11T100-198q-21 11-40.5-1T40-234v-482q0-11 5.5-21T62-752q46-24 96-36t102-12q58 0 113.5 15T480-740q51-30 106.5-45T700-800q52 0 102 12t96 36q11 5 16.5 15t5.5 21v482q0 23-19.5 35t-40.5 1q-37-20-77.5-31T700-240q-60 0-116 21t-104 59ZM280-494Z"/></svg>`,
  other: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M631-219q9-9 9-21t-9-21q-9-9-21-9t-21 9q-9 9-9 21t9 21q9 9 21 9t21-9Zm110 0q9-9 9-21t-9-21q-9-9-21-9t-21 9q-9 9-9 21t9 21q9 9 21 9t21-9Zm110 0q9-9 9-21t-9-21q-9-9-21-9t-21 9q-9 9-9 21t9 21q9 9 21 9t21-9Zm-651 99q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v268q-19-9-39-15.5t-41-9.5v-243H200v560h242q3 22 9.5 42t15.5 38H200Zm0-120v40-560 243-3 280Zm80-40h163q3-21 9.5-41t14.5-39H280v80Zm0-160h244q32-30 71.5-50t84.5-27v-3H280v80Zm0-160h400v-80H280v80ZM720-40q-83 0-141.5-58.5T520-240q0-83 58.5-141.5T720-440q83 0 141.5 58.5T920-240q0 83-58.5 141.5T720-40Z"/></svg>`,
  profile: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M367-527q-47-47-47-113t47-113q47-47 113-47t113 47q47 47 47 113t-47 113q-47 47-113 47t-113-47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Zm80-80h480v-32q0-11-5.5-20T700-306q-54-27-109-40.5T480-360q-56 0-111 13.5T260-306q-9 5-14.5 14t-5.5 20v32Zm296.5-343.5Q560-607 560-640t-23.5-56.5Q513-720 480-720t-56.5 23.5Q400-673 400-640t23.5 56.5Q447-560 480-560t56.5-23.5ZM480-640Zm0 400Z"/></svg>`,
  notebook: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M240-200h280v-80H240v80Zm0-160h480v-80H240v80Zm0-160h480v-80H240v80Zm-40 440q-33 0-56.5-23.5T120-160v-640q0-33 23.5-56.5T200-880h560q33 0 56.5 23.5T840-800v640q0 33-23.5 56.5T760-80H200Zm0-80h560v-640H200v640Zm0-640v640-640Z"/></svg>`,
  listen: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M280-80q62 0 101.5-31t60.5-91q17-50 32.5-70t71.5-64q62-50 98-113t36-151q0-119-80.5-199.5T400-880q-119 0-199.5 80.5T120-600h80q0-85 57.5-142.5T400-800q85 0 142.5 57.5T600-600q0 68-27 116t-77 86q-52 38-81 74t-43 78q-14 44-33.5 65T280-160q-33 0-56.5-23.5T200-240h-80q0 66 47 113t113 47Zm432-210q59-60 93.5-139.5T840-600q0-92-34.5-172T712-912l-58 56q50 50 78 115.5T760-600q0 74-28 139t-78 115l58 56ZM471-529.5q29-29.5 29-70.5 0-42-29-71t-71-29q-42 0-71 29t-29 71q0 41 29 70.5t71 29.5q42 0 71-29.5Z"/></svg>`,
  see: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M607.5-372.5Q660-425 660-500t-52.5-127.5Q555-680 480-680t-127.5 52.5Q300-575 300-500t52.5 127.5Q405-320 480-320t127.5-52.5Zm-204-51Q372-455 372-500t31.5-76.5Q435-608 480-608t76.5 31.5Q588-545 588-500t-31.5 76.5Q525-392 480-392t-76.5-31.5ZM214-281.5Q94-363 40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200q-146 0-266-81.5ZM480-500Zm207.5 160.5Q782-399 832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280q113 0 207.5-59.5Z"/></svg>`,
  download: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="m480-320 160-160-56-56-64 64v-168h-80v168l-64-64-56 56 160 160Zm0 240q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg>`,
  clear: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M600-240v-80h160v80H600Zm0-320v-80h280v80H600Zm0 160v-80h240v80H600ZM120-640H80v-80h160v-60h160v60h160v80h-40v360q0 33-23.5 56.5T440-200H200q-33 0-56.5-23.5T120-280v-360Zm80 0v360h240v-360H200Zm0 0v360-360Z"/></svg>`,
  teaching: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M280-120 80-320l200-200 57 56-104 104h607v80H233l104 104-57 56Zm400-320-57-56 104-104H120v-80h607L623-784l57-56 200 200-200 200Z"/></svg>`,
  refresh: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>`,
  stats: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M400-320q100 0 170-70t70-170q0-100-70-170t-170-70q-100 0-170 70t-70 170q0 100 70 170t170 70Zm-40-120v-280h80v280h-80Zm-140 0v-200h80v200h-80Zm280 0v-160h80v160h-80ZM824-80 597-307q-41 32-91 49.5T400-240q-134 0-227-93T80-560q0-134 93-227t227-93q134 0 227 93t93 227q0 56-17.5 106T653-363l227 227-56 56Z"/></svg>`,
  progress: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M200-800v241-1 400-640 200-200Zm80 400h140q9-23 22-43t30-37H280v80Zm0 160h127q-5-20-6.5-40t.5-40H280v80ZM200-80q-33 0-56.5-23.5T120-160v-640q0-33 23.5-56.5T200-880h320l240 240v100q-19-8-39-12.5t-41-6.5v-41H480v-200H200v640h241q16 24 36 44.5T521-80H200Zm531-149q29-29 29-71t-29-71q-29-29-71-29t-71 29q-29 29-29 71t29 71q29 29 71 29t71-29ZM864-40 756-148q-21 14-45.5 21t-50.5 7q-75 0-127.5-52.5T480-300q0-75 52.5-127.5T660-480q75 0 127.5 52.5T840-300q0 26-7 50.5T812-204L920-96l-56 56Z"/></svg>`,
};

function getOtherPageItems() {
  const items = [
    { action: 'listen', label: '听音识字', icon: SECTION_ICONS.listen },
    { action: 'see', label: '看字识音', icon: SECTION_ICONS.see },
    { action: 'download', label: '下载语音数据', icon: SECTION_ICONS.download },
    { action: 'clear-cache', label: '清理语音缓存', icon: SECTION_ICONS.clear },
    {
      action: 'toggle-teaching',
      label: state.isTeachingMode ? '切换学习模式' : '切换教学模式',
      icon: SECTION_ICONS.teaching,
    },
  ];

  if (state.isTeachingMode) {
    items.push({ action: 'stats', label: '显示录音进度', icon: SECTION_ICONS.stats });
  }

  items.push({ action: 'refresh', label: '刷新页面', icon: SECTION_ICONS.refresh });
  return items;
}

const HOME_NAV_ICON = SECTION_ICONS.home;
const BACK_HOME_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M280-200v-80h284q63 0 109.5-40T720-420q0-60-46.5-100T564-560H312l104 104-56 56-200-200 200-200 56 56-104 104h252q97 0 166.5 63T800-420q0 94-69.5 157T564-200H280Z"/></svg>`;

export function getBtnHtml(text, type, rootChar, level, unit, isSmall = false, index = null) {
  const iconId = state.isTeachingMode ? '#icon-mic' : '#icon-play';
  const icon = `<svg><use href="${iconId}"></use></svg>`;

  const title = state.isTeachingMode ? '录音' : '播放';
  const btnStyle = isSmall ? 'padding: 2px; margin-left: 2px;' : '';

  return `<button class="play-btn" title="${title}" style="${btnStyle}" data-text="${escapeHtml(text || '')}" data-type="${type}" data-root-char="${escapeHtml(rootChar || '')}" data-level="${escapeHtml(level || '')}" data-unit="${escapeHtml(unit || '')}" data-is-small="${isSmall}" data-index="${index !== null ? index : ''}">${icon}</button>`;
}

function getListenSpeakerIconHtml() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>`;
}

function getUnitReadButtonHtml(unitName) {
  if (state.isTeachingMode || state.mainViewMode !== 'study') return '';
  return `
    <div class="unit-title-actions">
      <button class="play-btn" title="整单元朗读" id="learnBatchPlayBtnMain" data-unit="${escapeHtml(unitName)}">
        <svg><use href="#icon-play"></use></svg>
      </button>
    </div>
  `;
}

function getUnitBatchButtonHtml(type) {
  if (!state.isTeachingMode || state.mainViewMode !== 'study') return '';
  const title = type === 'play' ? '批量播放' : '批量录音';
  const iconId = type === 'play' ? '#icon-play' : '#icon-mic';
  return `
    <button class="play-btn unit-batch-btn ${type}" type="button" data-home-action="batch-${type}" title="${title}">
      <svg><use href="${iconId}"></use></svg>
    </button>
  `;
}

function getUnitTitleHtml(unitName, extraClass = '') {
  const classes = ['unit-title'];
  if (extraClass) classes.push(extraClass);
  return `
    <div class="${classes.join(' ')}">
      <div class="unit-title-side left">
        ${getUnitBatchButtonHtml('play')}
      </div>
      <div class="unit-title-center">
        <span class="unit-title-text">${escapeHtml(unitName)}</span>
        ${getUnitReadButtonHtml(unitName)}
      </div>
      <div class="unit-title-side right">
        ${getUnitBatchButtonHtml('record')}
      </div>
    </div>
  `;
}

function buildStudyCardHtml(char, info, unitName) {
  const words = (info && info.词) ? info.词 : [];
  const sentence = (info && info.句) ? info.句 : '';

  const wordsHtml = Array.isArray(words)
    ? words.map((word, idx) =>
        `<span class="word-item">${escapeHtml(word)}${getBtnHtml(word, 'word', char, state.currentLevel, unitName, true, idx)}</span>`
      ).join(' ')
    : '';

  const sentenceHtml = highlightChar(sentence, char);

  return `
    <div class="card home-card ${state.homeCardMotion !== 'none' ? `card-motion-${state.homeCardMotion}` : ''}" data-char="${escapeHtml(char)}">
      <div class="char-header-container">
        <div class="char-with-btn">
          <div class="char-box">
            <div class="char-text">${escapeHtml(char)}</div>
          </div>
          ${getBtnHtml(char, 'char', char, state.currentLevel, unitName, false)}
        </div>
      </div>
      <div class="content-box">
        <div class="row">
          <div class="tag">词</div>
          <div class="text-btn-row">
            <div class="text-content words">${wordsHtml}</div>
          </div>
        </div>
        <div class="row">
          <div class="tag">句</div>
          <div class="text-btn-row">
            <div class="text-content sentence">${sentenceHtml}</div>
            ${getBtnHtml(sentence, 'sentence', char, state.currentLevel, unitName, false)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderHomeStudyMode(appEl, unitName, unitChars) {
  const allChars = Object.keys(unitChars || {});
  const safeIndex = Math.min(Math.max(state.homeCardIndex, 0), Math.max(0, allChars.length - 1));
  state.homeCardIndex = safeIndex;
  const currentChar = allChars[safeIndex] || '';
  const currentInfo = currentChar ? unitChars[currentChar] : null;

  appEl.classList.add('home-stage-layout');
  appEl.innerHTML = `
    ${getUnitTitleHtml(unitName)}
    <div class="unit-char-strip">
      ${allChars.map((char, index) => `<span class="unit-char-link${index === safeIndex ? ' active' : ''}" data-char="${escapeHtml(char)}">${escapeHtml(char)}</span>`).join('，')}
    </div>
    <div class="home-stage-shell">
      <button class="home-card-nav prev" type="button" id="homeCardPrevBtn" ${safeIndex === 0 ? 'disabled' : ''} aria-label="上一个字">‹</button>
      <div class="home-card-stage" data-char="${escapeHtml(currentChar)}">
        ${currentChar ? buildStudyCardHtml(currentChar, currentInfo, unitName) : '<div class="loading">本单元暂无内容</div>'}
      </div>
      <button class="home-card-nav next" type="button" id="homeCardNextBtn" ${safeIndex >= allChars.length - 1 ? 'disabled' : ''} aria-label="下一个字">›</button>
    </div>
  `;
  requestAnimationFrame(() => applyResponsiveLayout());
}

function renderOtherSection(appEl) {
  appEl.classList.remove('listen-layout');
  appEl.classList.add('app-section-layout');
  appEl.style.removeProperty('--listen-option-height');
  appEl.style.removeProperty('--listen-option-gap');
  const items = getOtherPageItems();
  appEl.innerHTML = `
    <section class="section-page">
      <div class="section-card-list">
        ${items.map(item => `
          <button class="section-action-card" type="button" data-action="${item.action}">
            <span class="section-action-icon">${item.icon}</span>
            <span class="section-action-label">${item.label}</span>
            <span class="section-action-arrow">›</span>
          </button>
        `).join('')}
      </div>
    </section>
  `;
}

function splitIntoGroups(items, size = 5) {
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
  return splitIntoGroups(items, 5);
}

function getNotebookChevronIcon(expanded) {
  return expanded
    ? `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="m356-160-56-56 180-180 180 180-56 56-124-124-124 124Zm124-404L300-744l56-56 124 124 124-124 56 56-180 180Z"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M480-120 300-300l58-58 122 122 122-122 58 58-180 180ZM358-598l-58-58 180-180 180 180-58 58-122-122-122 122Z"/></svg>`;
}

function getProgressChevronIcon(expanded) {
  return expanded
    ? `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="m356-160-56-56 180-180 180 180-56 56-124-124-124 124Zm124-404L300-744l56-56 124 124 124-124 56 56-180 180Z"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M480-120 300-300l58-58 122 122 122-122 58 58-180 180ZM358-598l-58-58 180-180 180 180-58 58-122-122-122 122Z"/></svg>`;
}

function sortProgressLevels(levels) {
  return [...levels].sort((a, b) => {
    const na = parseInt(String(a).replace(/\D/g, ''), 10) || 0;
    const nb = parseInt(String(b).replace(/\D/g, ''), 10) || 0;
    return nb - na;
  });
}

function sortProgressUnits(units) {
  const getCnNum = (str) => {
    const numMatch = String(str).match(/\d+/);
    if (numMatch) return parseInt(numMatch[0], 10);
    const m = String(str).match(/第(.+)单元/);
    if (!m) return 0;
    const s = m[1];
    const map = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
    const units = { '十': 10, '百': 100, '千': 1000 };
    let result = 0;
    let temp = 0;
    let hasNum = false;
    for (let i = 0; i < s.length; i++) {
      const char = s[i];
      if (map[char] !== undefined) {
        temp = map[char];
        hasNum = true;
      } else if (units[char]) {
        if (char === '十' && temp === 0 && result === 0) temp = 1;
        result += temp * units[char];
        temp = 0;
        hasNum = true;
      }
    }
    result += temp;
    return hasNum ? result : 0;
  };
  return [...units].sort((a, b) => getCnNum(b) - getCnNum(a));
}

function formatProgressUnitName(unit) {
  const getCnNum = (str) => {
    const numMatch = String(str).match(/\d+/);
    if (numMatch) return parseInt(numMatch[0], 10);
    const m = String(str).match(/第(.+)单元/);
    if (!m) return 0;
    const s = m[1];
    const map = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
    const units = { '十': 10, '百': 100, '千': 1000 };
    let result = 0;
    let temp = 0;
    let hasNum = false;
    for (let i = 0; i < s.length; i++) {
      const char = s[i];
      if (map[char] !== undefined) {
        temp = map[char];
        hasNum = true;
      } else if (units[char]) {
        if (char === '十' && temp === 0 && result === 0) temp = 1;
        result += temp * units[char];
        temp = 0;
        hasNum = true;
      }
    }
    result += temp;
    return hasNum ? result : 0;
  };
  const num = getCnNum(unit);
  return num === 0 ? String(unit) : String(num);
}

function formatProgressUnitDisplay(unit) {
  const normalized = formatProgressUnitName(unit);
  if (/^\d+$/.test(normalized)) {
    return normalized.padStart(3, ' ');
  }
  return normalized;
}

function renderProfileProgressContent() {
  const grouped = state.profileProgress.grouped || {};
  const levels = sortProgressLevels(Object.keys(grouped));
  if (!levels.length) return '';

  return levels.map((level, index) => {
    const expanded = index === 0;
    const units = sortProgressUnits(Object.keys(grouped[level] || {}));
    return `
      <div class="progress-level-item">
        <div class="progress-level-header${expanded ? ' active' : ''}" data-profile-progress-header="${escapeHtml(level)}">
          <span>${escapeHtml(level)}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
        <div class="progress-level-content${expanded ? ' show' : ''}">
          <div class="progress-level-scroll">
            ${units.map((unit) => `
              <div class="progress-unit-row">
                <div class="progress-unit-info">
                  <span class="progress-unit-name">
                    <span class="progress-unit-number">${escapeHtml(formatProgressUnitDisplay(unit))}</span><span class="progress-unit-colon"> :</span>
                  </span>
                  <span class="progress-char-list">
                    ${(grouped[level][unit] || []).map((char) => `<span class="progress-char learned">${escapeHtml(char)}</span>`).join('，')}
                  </span>
                </div>
                <button class="progress-nav-btn" type="button" data-profile-progress-nav="${escapeHtml(level)}|${escapeHtml(unit)}" title="前往该单元">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderNotebookCollectionSection(mode, label) {
  const groups = getNotebookGroups(mode);
  const expanded = !!state.notebook.expandedSections?.[mode];
  const total = groups.reduce((sum, group) => sum + group.length, 0);

  return `
    <div class="notebook-section-card">
      <button class="section-action-card notebook-section-toggle" type="button" data-notebook-section="${mode}">
        <span class="section-action-icon">${mode === 'listen' ? SECTION_ICONS.listen : SECTION_ICONS.see}</span>
        <span class="section-action-label">${label}</span>
        <span class="section-action-count">${total}</span>
        <span class="notebook-section-arrow${expanded ? ' expanded' : ''}">${getNotebookChevronIcon(expanded)}</span>
      </button>
      <div class="notebook-collapse${expanded ? ' expanded' : ''}">
        <div class="notebook-group-list">
          ${groups.map((group, index) => `
            <div class="notebook-group-row">
              <div class="notebook-group-text">${index + 1}：${group.map((item) => escapeHtml(item.char)).join('，')}</div>
              <div class="notebook-group-actions">
                <button class="modal-btn confirm" type="button" data-notebook-action="review" data-mode="${mode}" data-group-index="${index}">复习</button>
                <button class="modal-btn retry" type="button" data-notebook-action="practice" data-mode="${mode}" data-group-index="${index}">练习</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function buildReviewMistakeRows(item) {
  const wrongChars = Array.isArray(item.wrong_chars) ? item.wrong_chars : [];
  if (!wrongChars.length) {
    return '<div class="mistake-empty">暂无</div>';
  }

  return `
    <div class="mistake-grid">
      ${wrongChars.map((wrongChar) => `
        <div class="mistake-word-item">
          <span class="mistake-word-text">${escapeHtml(wrongChar)}</span>
          ${getBtnHtml(wrongChar, 'char', wrongChar, item.level, item.unit, true)}
        </div>
      `).join('')}
    </div>
  `;
}

function renderNotebookReviewSection(appEl) {
  const groups = getNotebookGroups(state.notebook.reviewMode);
  const safeGroupIndex = Math.min(Math.max(state.notebook.reviewGroupIndex, 0), Math.max(0, groups.length - 1));
  state.notebook.reviewGroupIndex = safeGroupIndex;
  const group = groups[safeGroupIndex] || [];
  const safeCardIndex = Math.min(Math.max(state.notebook.reviewCardIndex, 0), Math.max(0, group.length - 1));
  state.notebook.reviewCardIndex = safeCardIndex;
  const currentItem = group[safeCardIndex] || null;
  const modeLabel = state.notebook.reviewMode === 'listen' ? '听音识字错题集' : '看字识音错题集';

  appEl.classList.remove('listen-layout');
  appEl.classList.add('home-stage-layout', 'app-section-layout', 'notebook-review-layout');
  appEl.style.removeProperty('--listen-option-height');
  appEl.style.removeProperty('--listen-option-gap');
  appEl.innerHTML = `
    <section class="section-page notebook-review-page">
      <div class="notebook-topbar">
        <div class="section-title-row">
          <span class="section-title-text">${modeLabel}复习</span>
        </div>
        <div class="notebook-switcher">
          <button class="nav-btn" type="button" data-notebook-review-nav="prev" ${safeGroupIndex === 0 ? 'disabled' : ''}>&lt;</button>
          <span class="notebook-switcher-label">${safeGroupIndex + 1} / ${groups.length || 1}</span>
          <button class="nav-btn" type="button" data-notebook-review-nav="next" ${safeGroupIndex >= groups.length - 1 ? 'disabled' : ''}>&gt;</button>
        </div>
      </div>
      <div class="notebook-group-header">
        <button class="back-inline-btn" type="button" data-notebook-action="back-to-notebook">返回</button>
        <span class="notebook-group-title">${safeGroupIndex + 1}</span>
      </div>
      <div class="unit-char-strip notebook-char-strip">
        ${group.map((item, index) => `<span class="unit-char-link${index === safeCardIndex ? ' active' : ''}" data-notebook-review-char="${index}">${escapeHtml(item.char)}</span>`).join('，')}
      </div>
      <div class="home-stage-shell notebook-home-stage">
        <button class="home-card-nav prev" type="button" data-notebook-review-card="prev" ${safeCardIndex === 0 ? 'disabled' : ''}>‹</button>
        <div class="home-card-stage">
          ${currentItem ? `
            <div class="card home-card ${state.notebook.reviewMotion !== 'none' ? `card-motion-${state.notebook.reviewMotion}` : ''}" data-char="${escapeHtml(currentItem.char)}">
              <div class="char-header-container">
                <div class="char-with-btn">
                  <div class="char-box">
                    <div class="char-text">${escapeHtml(currentItem.char)}</div>
                  </div>
                  ${getBtnHtml(currentItem.char, 'char', currentItem.char, currentItem.level, currentItem.unit, false)}
                </div>
              </div>
              <div class="content-box">
                <div class="row">
                  <div class="tag">误认为</div>
                  <div class="text-btn-row">
                    <div class="text-content words notebook-mistake-content">${buildReviewMistakeRows(currentItem)}</div>
                  </div>
                </div>
              </div>
            </div>
          ` : '<div class="loading">当前错题组暂无内容</div>'}
        </div>
        <button class="home-card-nav next" type="button" data-notebook-review-card="next" ${safeCardIndex >= group.length - 1 ? 'disabled' : ''}>›</button>
      </div>
    </section>
  `;
}

function renderNotebookPracticeSection(appEl) {
  const session = state.notebook.practice;
  const total = session.sequence.length;
  const groupChars = session.sourceItems.map((item) => item.char);
  const currentStep = Math.min(session.currentIndex + 1, Math.max(total, 1));
  const progressPercent = total === 0 ? 0 : Math.round((session.answeredChars.length / total) * 100);
  const titleText = `${session.groupIndex + 1}`;
  const groupCount = getNotebookGroups(session.mode).length;

  appEl.classList.add('listen-layout', 'notebook-practice-layout');
  appEl.classList.remove('app-section-layout', 'home-stage-layout');

  if (!total) {
    appEl.innerHTML = `
      <div class="notebook-topbar compact">
        <div class="section-title-row">
          <span class="section-title-text">${session.mode === 'listen' ? '听音识字练习' : '看字识音练习'}</span>
        </div>
      </div>
      <div class="loading">当前错题组暂无可练习内容</div>
    `;
    return;
  }

  if (session.mode === 'listen') {
    const question = session.questions[session.currentIndex] || null;
    const currentChar = question?.char || session.sequence[session.currentIndex] || '';
    const options = Array.isArray(question?.options) ? question.options : [];
    appEl.innerHTML = `
      <div class="notebook-topbar compact">
        <div class="section-title-row">
          <span class="section-title-text">听音识字练习</span>
        </div>
        <div class="notebook-switcher">
          <button class="nav-btn" type="button" data-notebook-practice-group="prev" ${session.groupIndex === 0 ? 'disabled' : ''}>&lt;</button>
          <span class="notebook-switcher-label">${titleText}</span>
          <button class="nav-btn" type="button" data-notebook-practice-group="next" ${session.groupIndex >= groupCount - 1 ? 'disabled' : ''}>&gt;</button>
        </div>
      </div>
      <div class="notebook-group-header">
        <button class="back-inline-btn" type="button" data-notebook-action="back-to-notebook">返回</button>
        <span class="notebook-group-title">${titleText}</span>
      </div>
      <div class="unit-char-strip notebook-char-strip">${groupChars.map((char) => escapeHtml(char)).join('，')}</div>
      <div class="listen-progress-card">
        <div class="listen-progress-header"><span>听音识字进度</span><span>${currentStep}/${total}</span></div>
        <div class="progress-track listen-progress-track"><div class="progress-fill" style="width:${progressPercent}%"></div></div>
        <div class="listen-progress-caption">已完成 ${session.answeredChars.length} / ${total}</div>
      </div>
      <div class="listen-mode-panel" data-char="${escapeHtml(currentChar)}">
        <button class="listen-audio-btn" id="notebookListenReplayBtn" title="播放读音">${getListenSpeakerIconHtml()}</button>
        <div class="listen-options-grid">
          ${options.map((option) => `<button class="listen-option-btn" data-char="${escapeHtml(option)}" type="button">${escapeHtml(option)}</button>`).join('')}
        </div>
      </div>
    `;
    return;
  }

  const question = session.questions[session.currentIndex] || null;
  const currentChar = question?.char || session.sequence[session.currentIndex] || '';
  const options = Array.isArray(question?.options) ? question.options : [];
  const revealedOptions = Array.isArray(question?.revealedOptions) ? question.revealedOptions : [];
  appEl.innerHTML = `
    <div class="notebook-topbar compact">
      <div class="section-title-row">
        <span class="section-title-text">看字识音练习</span>
      </div>
      <div class="notebook-switcher">
        <button class="nav-btn" type="button" data-notebook-practice-group="prev" ${session.groupIndex === 0 ? 'disabled' : ''}>&lt;</button>
        <span class="notebook-switcher-label">${titleText}</span>
        <button class="nav-btn" type="button" data-notebook-practice-group="next" ${session.groupIndex >= groupCount - 1 ? 'disabled' : ''}>&gt;</button>
      </div>
    </div>
    <div class="notebook-group-header">
      <button class="back-inline-btn" type="button" data-notebook-action="back-to-notebook">返回</button>
      <span class="notebook-group-title">${titleText}</span>
    </div>
    <div class="unit-char-strip notebook-char-strip">${groupChars.map((char) => escapeHtml(char)).join('，')}</div>
    <div class="listen-progress-card">
      <div class="listen-progress-header"><span>看字识音进度</span><span>${currentStep}/${total}</span></div>
      <div class="progress-track listen-progress-track"><div class="progress-fill" style="width:${progressPercent}%"></div></div>
      <div class="listen-progress-caption">已完成 ${session.answeredChars.length} / ${total}</div>
    </div>
    <div class="listen-mode-panel see-mode-panel" data-char="${escapeHtml(currentChar)}">
      <div class="see-char-card" id="notebookSeePromptCard" data-char="${escapeHtml(currentChar)}">${escapeHtml(currentChar)}</div>
      <div class="see-options-grid">
        ${options.map((option) => {
          const isRevealed = revealedOptions.includes(option);
          return `<button class="see-audio-option${isRevealed ? ' revealed' : ''}" data-char="${escapeHtml(option)}" type="button">${isRevealed ? escapeHtml(option) : getListenSpeakerIconHtml()}</button>`;
        }).join('')}
      </div>
    </div>
  `;
}

function renderProfileSection(appEl) {
  const username = localStorage.getItem(USER_KEY) || '';
  const displayName = username || '未登录';
  const avatarText = username ? username.slice(0, 1).toUpperCase() : '我';
  const helperText = username ? '点击可切换登录状态' : '点击登录后可同步学习进度';

  appEl.classList.remove('listen-layout');
  appEl.classList.add('app-section-layout');
  appEl.style.removeProperty('--listen-option-height');
  appEl.style.removeProperty('--listen-option-gap');

  if (state.profileView === 'notebookReview') {
    renderNotebookReviewSection(appEl);
    return;
  }

  if (state.profileView === 'notebookPractice') {
    renderNotebookPracticeSection(appEl);
    requestAnimationFrame(() => applyResponsiveLayout());
    return;
  }

  appEl.innerHTML = `
    <section class="section-page">
      <div class="section-card-list">
        <button class="section-action-card profile-card" type="button" data-action="login">
          <span class="profile-avatar">${escapeHtml(avatarText)}</span>
          <span class="profile-copy">
            <span class="section-action-label">${escapeHtml(displayName)}</span>
            <span class="section-action-meta">${escapeHtml(helperText)}</span>
          </span>
          <span class="section-action-arrow">›</span>
        </button>
        <div class="profile-progress-card-wrap">
          <button class="section-action-card profile-progress-toggle" type="button" data-action="progress">
            <span class="section-action-icon">${SECTION_ICONS.progress}</span>
            <span class="section-action-label">查询学习进度</span>
            <span class="section-action-count">${state.profileProgress.total}</span>
            <span class="notebook-section-arrow${state.profileProgress.expanded ? ' expanded' : ''}">${getProgressChevronIcon(state.profileProgress.expanded)}</span>
          </button>
          <div class="notebook-collapse${state.profileProgress.expanded ? ' expanded' : ''}">
            ${state.profileProgress.loading ? `
              <div class="loading">正在加载学习进度...</div>
            ` : state.profileProgress.error ? `
              <div class="error-msg">${escapeHtml(state.profileProgress.error)}</div>
            ` : renderProfileProgressContent()}
          </div>
        </div>
        <div class="section-card-list notebook-list">
          ${renderNotebookCollectionSection('listen', '听音识字错题集')}
          ${renderNotebookCollectionSection('see', '看字识音错题集')}
        </div>
      </div>
    </section>
  `;
}

export function updateAppShell() {
  const toolbarTitle = document.getElementById('toolbarTitle');
  const toolbarSearch = document.querySelector('.toolbar-search');
  const toolbarControls = document.querySelector('.toolbar-right');
  const homeNavItem = document.querySelector('.bottom-nav-item[data-section="home"]');
  const learningActive = document.getElementById('learningView')?.classList.contains('active');
  const appEl = document.getElementById('app');

  let title = '主页';
  if (learningActive) {
    title = '笔顺学习';
  } else if (state.appSection === 'other') {
    title = '其他';
  } else if (state.appSection === 'profile') {
    if (state.profileView === 'notebook') {
      title = '生字本';
    } else if (state.profileView === 'notebookReview') {
      title = '复习';
    } else if (state.profileView === 'notebookPractice') {
      title = '练习';
    } else {
      title = '我的';
    }
  } else if (state.mainViewMode === 'listen' && !state.isTeachingMode) {
    title = '听音识字';
  } else if (state.mainViewMode === 'see' && !state.isTeachingMode) {
    title = '看字识音';
  }

  if (toolbarTitle) {
    toolbarTitle.textContent = title;
  }

  const showHomeControls = !learningActive && state.appSection === 'home';
  if (toolbarSearch) {
    toolbarSearch.style.display = showHomeControls ? 'flex' : 'none';
  }
  if (toolbarControls) {
    toolbarControls.style.display = showHomeControls ? 'flex' : 'none';
  }

  if (homeNavItem) {
    const iconEl = homeNavItem.querySelector('.bottom-nav-icon');
    const labelEl = homeNavItem.querySelector('.bottom-nav-label');
    const shouldReturnHome = learningActive || (state.appSection === 'home' && state.mainViewMode !== 'study');
    if (iconEl) {
      iconEl.innerHTML = shouldReturnHome ? BACK_HOME_ICON : HOME_NAV_ICON;
    }
    if (labelEl) {
      labelEl.textContent = shouldReturnHome ? '回到主页' : '主页';
    }
  }

  if (appEl) {
    appEl.classList.toggle('app-home-mode', state.appSection === 'home');
  }
}

function fitUnitCharStrip() {
  const strip = document.querySelector('.unit-char-strip');
  if (!strip) return;

  const rootFontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  const basePx = rootFontSize * UNIT_CHAR_BASE_REM;
  const minPx = rootFontSize * UNIT_CHAR_MIN_REM;

  let nextPx = basePx;
  strip.style.fontSize = `${UNIT_CHAR_BASE_REM}rem`;

  const availableWidth = strip.clientWidth;
  if (!availableWidth) return;

  let contentWidth = strip.scrollWidth;
  if (contentWidth <= availableWidth) return;

  nextPx = Math.max(minPx, Math.floor((basePx * availableWidth / contentWidth) * 100) / 100);
  strip.style.fontSize = `${nextPx / rootFontSize}rem`;

  contentWidth = strip.scrollWidth;
  while (contentWidth > availableWidth && nextPx > minPx) {
    nextPx = Math.max(minPx, nextPx - 0.5);
    strip.style.fontSize = `${nextPx / rootFontSize}rem`;
    contentWidth = strip.scrollWidth;
  }
}

function fitListenLayout(appEl = document.getElementById('app')) {
  if (!appEl || !appEl.classList.contains('listen-layout')) return;

  const optionButtons = Array.from(document.querySelectorAll('.listen-option-btn, .see-audio-option'));
  if (!optionButtons.length) return;

  const isMobile = window.innerWidth <= 720;
  const baseHeight = isMobile ? LISTEN_MOBILE_OPTION_HEIGHT : LISTEN_DESKTOP_OPTION_HEIGHT;
  const minHeight = isMobile ? LISTEN_MOBILE_OPTION_MIN_HEIGHT : LISTEN_DESKTOP_OPTION_MIN_HEIGHT;
  const baseGap = isMobile ? LISTEN_MOBILE_OPTION_GAP : LISTEN_DESKTOP_OPTION_GAP;
  const rows = isMobile ? 2 : 1;

  appEl.style.setProperty('--listen-option-height', `${baseHeight}px`);
  appEl.style.setProperty('--listen-option-gap', `${baseGap}px`);

  const appTop = appEl.getBoundingClientRect().top;
  const viewportBudget = Math.max(window.innerHeight - appTop - 12, 0);
  const currentHeight = appEl.scrollHeight;
  const overflow = Math.max(0, Math.ceil(currentHeight - viewportBudget));

  if (!overflow) return;

  const maxHeightReduction = baseHeight - minHeight;
  const heightReduction = Math.min(maxHeightReduction, Math.ceil(overflow / rows));
  const nextHeight = Math.max(minHeight, baseHeight - heightReduction);
  const leftoverOverflow = Math.max(0, overflow - ((baseHeight - nextHeight) * rows));
  const nextGap = Math.max(LISTEN_OPTION_MIN_GAP, baseGap - Math.ceil(leftoverOverflow / Math.max(rows, 1)));

  appEl.style.setProperty('--listen-option-height', `${nextHeight}px`);
  appEl.style.setProperty('--listen-option-gap', `${nextGap}px`);
}

export function applyResponsiveLayout() {
  fitUnitCharStrip();
  fitListenLayout();
}

function renderListenMode(appEl, unitName) {
  const session = state.listenMode;
  const total = session.sequence.length;

  if (!total) {
    appEl.classList.add('listen-layout');
    appEl.innerHTML = `
      ${getUnitTitleHtml(unitName)}
      <div class="card">
        <div class="loading">当前单元暂无可练习汉字</div>
      </div>
    `;
    return;
  }

  const question = session.questions[session.currentIndex] || null;
  const currentChar = question?.char || session.sequence[session.currentIndex] || '';
  const options = Array.isArray(question?.options) ? question.options : [];
  const completedCount = Math.min(session.answeredChars.length, total);
  const currentStep = completedCount >= total ? total : Math.min(completedCount + 1, total);
  const progressPercent = total === 0 ? 0 : Math.round((completedCount / total) * 100);

  appEl.innerHTML = `
    ${getUnitTitleHtml(unitName, 'listen-unit-title')}
    <div class="listen-progress-card">
      <div class="listen-progress-header">
        <span>听音识字进度</span>
        <span>${currentStep}/${total}</span>
      </div>
      <div class="progress-track listen-progress-track">
        <div class="progress-fill" style="width:${progressPercent}%"></div>
      </div>
      <div class="listen-progress-caption">已完成 ${completedCount} / ${total}</div>
    </div>
    <div class="listen-mode-panel" data-char="${escapeHtml(currentChar)}">
      <button class="listen-audio-btn" id="listenReplayBtn" title="播放读音" data-text="${escapeHtml(currentChar)}" data-type="char" data-root-char="${escapeHtml(currentChar)}" data-level="${escapeHtml(state.currentLevel)}" data-unit="${escapeHtml(unitName)}">
        ${getListenSpeakerIconHtml()}
      </button>
      <div class="listen-options-grid">
        ${options.map(option => `
          <button class="listen-option-btn" data-char="${escapeHtml(option)}" type="button">${escapeHtml(option)}</button>
        `).join('')}
      </div>
    </div>
  `;
  requestAnimationFrame(() => applyResponsiveLayout());
}

function renderSeeMode(appEl, unitName) {
  const session = state.seeMode;
  const total = session.sequence.length;

  if (!total) {
    appEl.classList.add('listen-layout');
    appEl.innerHTML = `
      ${getUnitTitleHtml(unitName)}
      <div class="card">
        <div class="loading">当前单元暂无可练习汉字</div>
      </div>
    `;
    return;
  }

  const question = session.questions[session.currentIndex] || null;
  const currentChar = question?.char || session.sequence[session.currentIndex] || '';
  const options = Array.isArray(question?.options) ? question.options : [];
  const revealedOptions = Array.isArray(question?.revealedOptions) ? question.revealedOptions : [];
  const completedCount = Math.min(session.answeredChars.length, total);
  const currentStep = completedCount >= total ? total : Math.min(completedCount + 1, total);
  const progressPercent = total === 0 ? 0 : Math.round((completedCount / total) * 100);

  appEl.innerHTML = `
    ${getUnitTitleHtml(unitName, 'listen-unit-title')}
    <div class="listen-progress-card">
      <div class="listen-progress-header">
        <span>看字识音进度</span>
        <span>${currentStep}/${total}</span>
      </div>
      <div class="progress-track listen-progress-track">
        <div class="progress-fill" style="width:${progressPercent}%"></div>
      </div>
      <div class="listen-progress-caption">已完成 ${completedCount} / ${total}</div>
    </div>
    <div class="listen-mode-panel see-mode-panel" data-char="${escapeHtml(currentChar)}">
      <div class="see-char-card" id="seePromptCard" data-char="${escapeHtml(currentChar)}" tabindex="0" role="button" aria-label="拖动汉字到正确读音">
        ${escapeHtml(currentChar)}
      </div>
      <div class="see-options-grid">
        ${options.map((option) => {
          const isRevealed = revealedOptions.includes(option);
          return `
            <button class="see-audio-option${isRevealed ? ' revealed' : ''}" data-char="${escapeHtml(option)}" type="button">
              ${isRevealed ? escapeHtml(option) : getListenSpeakerIconHtml()}
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
  requestAnimationFrame(() => applyResponsiveLayout());
}

export function renderUnit() {
  const appEl = document.getElementById('app');
  const indicatorText = document.getElementById('indicatorText');
  const unitSelect = document.getElementById('unitSelect');
  const prevBtn = document.getElementById('prevUnit');
  const nextBtn = document.getElementById('nextUnit');
  const bottomTabs = document.querySelectorAll('.bottom-nav-item');

  const isHomeSection = state.appSection === 'home';
  const isCenteredHomeStage = isHomeSection && state.mainViewMode === 'study' && !state.isTeachingMode;
  document.body.classList.toggle('home-lock-scroll', isCenteredHomeStage);
  bottomTabs.forEach((item) => {
    item.classList.toggle('active', item.dataset.section === state.appSection);
  });
  updateAppShell();

  if (!state.currentData || state.unitKeys.length === 0) {
    appEl.classList.remove('listen-layout');
    appEl.classList.remove('home-stage-layout', 'app-section-layout');
    appEl.style.removeProperty('--listen-option-height');
    appEl.style.removeProperty('--listen-option-gap');
    appEl.innerHTML = '<div class="loading">暂无数据</div>';
    indicatorText.textContent = '0/0';
    return;
  }

  const unitName = state.unitKeys[state.currentUnitIndex];
  const unitChars = state.currentData[unitName];

  indicatorText.textContent = `${state.currentUnitIndex + 1}/${state.unitKeys.length}`;
  unitSelect.value = state.currentUnitIndex;
  prevBtn.disabled = state.currentUnitIndex === 0;
  nextBtn.disabled = state.currentUnitIndex === state.unitKeys.length - 1;

  if (state.appSection === 'other') {
    renderOtherSection(appEl);
    window.scrollTo(0, 0);
    return;
  }

  if (state.appSection === 'profile') {
    renderProfileSection(appEl);
    window.scrollTo(0, 0);
    return;
  }

  if (state.mainViewMode === 'listen' && !state.isTeachingMode) {
    appEl.classList.remove('home-stage-layout', 'app-section-layout');
    appEl.classList.add('listen-layout');
    renderListenMode(appEl, unitName);
    window.scrollTo(0, 0);
    return;
  }

  if (state.mainViewMode === 'see' && !state.isTeachingMode) {
    appEl.classList.remove('home-stage-layout', 'app-section-layout');
    appEl.classList.add('listen-layout');
    renderSeeMode(appEl, unitName);
    window.scrollTo(0, 0);
    return;
  }

  appEl.classList.remove('listen-layout');
  appEl.classList.remove('app-section-layout');
  appEl.style.removeProperty('--listen-option-height');
  appEl.style.removeProperty('--listen-option-gap');
  renderHomeStudyMode(appEl, unitName, unitChars);
  window.scrollTo(0, 0);
}

export function renderSearchResult(char, info, level, unit) {
  const appEl = document.getElementById('app');
  appEl.classList.remove('listen-layout');
  appEl.style.removeProperty('--listen-option-height');
  appEl.style.removeProperty('--listen-option-gap');
  const words = (info.词) ? info.词 : [];
  const sentence = (info.句) ? info.句 : '';

  const wordsHtml = Array.isArray(words)
    ? words.map((word, idx) =>
        `<span class="word-item">${escapeHtml(word)}${getBtnHtml(word, 'word', char, level, unit, true, idx)}</span>`
      ).join(' ')
    : '';

  const sentenceHtml = highlightChar(sentence, char);

  appEl.innerHTML = `
    <div class="unit-title">${escapeHtml(level)} - ${escapeHtml(unit)}</div>
    <div class="card">
      <div class="char-header-container">
        <div class="char-with-btn">
          <div class="char-box">
            <div class="char-text">${escapeHtml(char)}</div>
          </div>
          ${getBtnHtml(char, 'char', char, level, unit, false)}
        </div>
      </div>
      <div class="content-box">
        <div class="row">
          <div class="tag">词</div>
          <div class="text-btn-row">
            <div class="text-content words">${wordsHtml}</div>
          </div>
        </div>
        <div class="row">
          <div class="tag">句</div>
          <div class="text-btn-row">
            <div class="text-content sentence">${sentenceHtml}</div>
            ${getBtnHtml(sentence, 'sentence', char, level, unit, false)}
          </div>
        </div>
      </div>
    </div>
  `;
}
