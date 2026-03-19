export function renderProgressRow({ escapeHtml, level, unit, chars, items, formatUnitDisplay, formatProgressUnitDisplay }) {
  const rowChars = chars || items || [];
  const formatter = formatUnitDisplay || formatProgressUnitDisplay;

  return `
    <div class="progress-unit-row">
      <div class="progress-unit-info">
        <span class="progress-unit-name">
          <span class="progress-unit-number">${escapeHtml(formatter(unit))}</span><span class="progress-unit-colon"> :</span>
        </span>
        <span class="progress-char-list">
          ${rowChars.map((char) => `<span class="progress-char learned">${escapeHtml(char)}</span>`).join('，')}
        </span>
      </div>
      <button class="modal-btn confirm progress-review-btn" type="button" data-profile-progress-nav="${escapeHtml(level)}|${escapeHtml(unit)}" title="复习该单元">复习</button>
    </div>
  `;
}

export function renderAudioProgressRow({ escapeHtml, level, unit, chars, items, formatUnitDisplay, formatProgressUnitDisplay }) {
  const rowChars = chars || items || [];
  const formatter = formatUnitDisplay || formatProgressUnitDisplay;

  return `
    <div class="progress-unit-row">
      <div class="progress-unit-info">
        <span class="progress-unit-name">
          <span class="progress-unit-number">${escapeHtml(formatter(unit))}</span><span class="progress-unit-colon"> :</span>
        </span>
        <span class="progress-char-list">
          ${rowChars.map((char) => `<span class="progress-char learned">${escapeHtml(char)}</span>`).join('，')}
        </span>
      </div>
      <button class="modal-btn confirm progress-review-btn" type="button" data-audio-progress-view="${escapeHtml(level)}|${escapeHtml(unit)}" title="查看该单元录音详情">查看</button>
    </div>
  `;
}

export function renderNotebookGroupRow({ escapeHtml, group, index, mode, level, formatIndex, formatAlignedIndex }) {
  const formatter = formatIndex || formatAlignedIndex;

  return `
    <div class="notebook-group-row">
      <div class="progress-unit-info notebook-group-info">
        <span class="progress-unit-name">
          <span class="progress-unit-number">${escapeHtml(formatter(index + 1))}</span><span class="progress-unit-colon"> :</span>
        </span>
        <span class="progress-char-list notebook-group-text">${group.map((item) => `<span class="progress-char learned">${escapeHtml(item.char)}</span>`).join('，')}</span>
      </div>
      <div class="notebook-group-actions">
        <button class="modal-btn confirm" type="button" data-notebook-action="review" data-mode="${mode}" data-level="${escapeHtml(level)}" data-group-index="${index}">复习</button>
        <button class="modal-btn retry" type="button" data-notebook-action="practice" data-mode="${mode}" data-level="${escapeHtml(level)}" data-group-index="${index}">练习</button>
      </div>
    </div>
  `;
}
