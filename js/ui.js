// UI 渲染：卡片、搜索结果、听音识字视图、HTML 工具函数
import { state } from './state.js';

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

function getUnitTitleHtml(unitName, extraClass = '') {
  const classes = ['unit-title'];
  if (extraClass) classes.push(extraClass);
  return `
    <div class="${classes.join(' ')}">
      <div class="unit-title-center">
        <span class="unit-title-text">${escapeHtml(unitName)}</span>
        ${getUnitReadButtonHtml(unitName)}
      </div>
    </div>
  `;
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

  if (!state.currentData || state.unitKeys.length === 0) {
    appEl.classList.remove('listen-layout');
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

  if (state.mainViewMode === 'listen' && !state.isTeachingMode) {
    appEl.classList.add('listen-layout');
    renderListenMode(appEl, unitName);
    window.scrollTo(0, 0);
    return;
  }

  if (state.mainViewMode === 'see' && !state.isTeachingMode) {
    appEl.classList.add('listen-layout');
    renderSeeMode(appEl, unitName);
    window.scrollTo(0, 0);
    return;
  }

  appEl.classList.remove('listen-layout');
  appEl.style.removeProperty('--listen-option-height');
  appEl.style.removeProperty('--listen-option-gap');

  let html = `
    ${getUnitTitleHtml(unitName)}
  `;

  if (unitChars) {
    const allChars = Object.keys(unitChars);
    if (allChars.length > 0) {
      html += `
        <div class="unit-char-strip">
          ${allChars.map(c => `<span class="unit-char-link" data-char="${escapeHtml(c)}">${escapeHtml(c)}</span>`).join('，')}
        </div>
      `;
    }

    for (const [char, info] of Object.entries(unitChars)) {
      const words = (info && info.词) ? info.词 : [];
      const sentence = (info && info.句) ? info.句 : '';

      const wordsHtml = Array.isArray(words)
        ? words.map((word, idx) =>
            `<span class="word-item">${escapeHtml(word)}${getBtnHtml(word, 'word', char, state.currentLevel, unitName, true, idx)}</span>`
          ).join(' ')
        : '';

      const sentenceHtml = highlightChar(sentence, char);

      html += `
        <div class="card" data-char="${escapeHtml(char)}">
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
  } else {
    html += '<div class="loading">本单元暂无内容</div>';
  }

  appEl.innerHTML = html;
  requestAnimationFrame(() => applyResponsiveLayout());
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
