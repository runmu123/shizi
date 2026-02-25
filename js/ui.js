// UI 渲染：卡片、搜索结果、HTML 工具函数
import { state } from './state.js';

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
  // 使用 split/join 替代 regex，避免 regex 注入
  return safeText.split(safeChar).join(`<span class="highlight">${safeChar}</span>`);
}

export function getBtnHtml(text, type, rootChar, level, unit, isSmall = false, index = null) {
  const svgAttr = isSmall ? ' style="width:16px;height:16px"' : '';
  const iconId = state.isTeachingMode ? '#icon-mic' : '#icon-play';
  const icon = `<svg${svgAttr}><use href="${iconId}"></use></svg>`;
  
  const title = state.isTeachingMode ? '录音' : '播放';
  const btnStyle = isSmall ? 'padding: 2px; margin-left: 2px;' : '';

  return `<button class="play-btn" title="${title}" style="${btnStyle}" data-text="${escapeHtml(text || '')}" data-type="${type}" data-root-char="${escapeHtml(rootChar || '')}" data-level="${escapeHtml(level || '')}" data-unit="${escapeHtml(unit || '')}" data-is-small="${isSmall}" data-index="${index !== null ? index : ''}">${icon}</button>`;
}

export function renderUnit() {
  const appEl = document.getElementById('app');
  const indicatorText = document.getElementById('indicatorText');
  const unitSelect = document.getElementById('unitSelect');
  const prevBtn = document.getElementById('prevUnit');
  const nextBtn = document.getElementById('nextUnit');

  if (!state.currentData || state.unitKeys.length === 0) {
    appEl.innerHTML = '<div class="loading">暂无数据</div>';
    indicatorText.textContent = '0/0';
    return;
  }

  const unitName = state.unitKeys[state.currentUnitIndex];
  const unitChars = state.currentData[unitName];

  // 更新导航 UI
  indicatorText.textContent = `${state.currentUnitIndex + 1}/${state.unitKeys.length}`;
  unitSelect.value = state.currentUnitIndex;
  prevBtn.disabled = state.currentUnitIndex === 0;
  nextBtn.disabled = state.currentUnitIndex === state.unitKeys.length - 1;

  // 渲染卡片
  let html = `<div class="unit-title">${escapeHtml(unitName)}`;
  
  // 教学模式下显示批量录音按钮
  if (state.isTeachingMode) {
    html += `
      <button class="play-btn" title="批量录音" id="batchRecordBtnMain" style="float: right; margin-right: 10px;">
        <svg style="width:20px;height:20px;">
          <use href="#icon-mic"></use>
        </svg>
      </button>
    `;
  }
  
  html += `</div>`;

  if (unitChars) {
    // 生成单元摘要
    const allChars = Object.keys(unitChars);
    if (allChars.length > 0) {
      html += `
        <div style="
          text-align: center;
          margin: -10px 0 20px 0;
          padding: 0 16px;
          color: #666;
          font-size: 1.5rem;
          font-family: 'KaiTi', 'STKaiti', serif;
        ">
          ${allChars.map(escapeHtml).join('，')}
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
        <div class="card">
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
  window.scrollTo(0, 0);
}

export function renderSearchResult(char, info, level, unit) {
  const appEl = document.getElementById('app');
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
