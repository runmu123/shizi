function defaultListenSpeakerIconHtml() {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>`;
}

export function renderListenPracticeBody({
  escapeHtml,
  getListenSpeakerIconHtml = defaultListenSpeakerIconHtml,
  currentChar,
  options,
  level,
  unitName,
  replayButtonId = 'listenReplayBtn',
}) {
  return `
    <div class="listen-mode-panel" data-char="${escapeHtml(currentChar)}">
      <button class="listen-audio-btn" id="${escapeHtml(replayButtonId)}" title="播放读音" data-text="${escapeHtml(currentChar)}" data-type="char" data-root-char="${escapeHtml(currentChar)}" data-level="${escapeHtml(level)}" data-unit="${escapeHtml(unitName)}">
        ${getListenSpeakerIconHtml()}
      </button>
      <div class="listen-options-grid">
        ${options.map((option) => `
          <button class="listen-option-btn" data-char="${escapeHtml(option)}" type="button">${escapeHtml(option)}</button>
        `).join('')}
      </div>
    </div>
  `;
}

export function renderSeePracticeBody({
  escapeHtml,
  getListenSpeakerIconHtml = defaultListenSpeakerIconHtml,
  currentChar,
  options,
  revealedOptions = [],
  promptId = 'seePromptCard',
  promptInteractive = true,
}) {
  const promptAttrs = promptInteractive
    ? 'tabindex="0" role="button" aria-label="拖动汉字到正确读音"'
    : '';

  return `
    <div class="listen-mode-panel see-mode-panel" data-char="${escapeHtml(currentChar)}">
      <div class="see-char-card" id="${escapeHtml(promptId)}" data-char="${escapeHtml(currentChar)}" ${promptAttrs}>${escapeHtml(currentChar)}</div>
      <div class="see-options-grid">
        ${options.map((option) => {
          const isRevealed = revealedOptions.includes(option);
          return `<button class="see-audio-option${isRevealed ? ' revealed' : ''}" data-char="${escapeHtml(option)}" type="button">${isRevealed ? escapeHtml(option) : getListenSpeakerIconHtml()}</button>`;
        }).join('')}
      </div>
    </div>
  `;
}
