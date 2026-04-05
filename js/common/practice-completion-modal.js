import { buildCompletionSummaryHtml } from './completion-summary.js';

export function showPracticeCompletionModalShared({
  kind,
  mode,
  session,
  completionModalState,
  stopActiveAudioPlayback,
  escapeHtml,
  scopeLabel,
  allCorrectText,
  nextLabel,
  replayButtonId = '',
  setSpeakerButtonPlaying = null,
}) {
  const modal = document.getElementById('listenCompletionModal');
  const correctList = document.getElementById('listenCorrectList');
  const wrongList = document.getElementById('listenWrongList');
  const summary = document.getElementById('listenCompletionSummary');
  const retryBtn = document.getElementById('retryListenBtn');
  const nextBtn = document.getElementById('nextListenUnitBtn');
  if (!modal || !correctList || !wrongList || !summary || !session) return;

  completionModalState.kind = kind;
  completionModalState.mode = mode;
  stopActiveAudioPlayback?.();

  if (replayButtonId && typeof setSpeakerButtonPlaying === 'function') {
    const replayBtn = document.getElementById(replayButtonId);
    if (replayBtn) {
      setSpeakerButtonPlaying(replayBtn, false);
      replayBtn.disabled = false;
    }
  }

  const correctQuestions = session.questions.filter((question) => question.countedCorrect === true);
  const wrongQuestions = session.questions.filter((question) => question.countedCorrect === false);
  const hasRetryTargets = session.questions.some((question) => (question.wrongSelections || []).length > 0);

  summary.innerHTML = buildCompletionSummaryHtml({
    scopeLabel,
    totalCount: session.sequence.length,
    correctCount: correctQuestions.length,
    wrongCount: wrongQuestions.length,
    allCorrectText,
  });

  correctList.innerHTML = correctQuestions.length > 0
    ? correctQuestions.map((question) => `<span class="listen-result-char success">${escapeHtml(question.char)}</span>`).join('')
    : '<span class="listen-result-empty">暂无</span>';

  wrongList.innerHTML = wrongQuestions.length > 0
    ? wrongQuestions.map((question) => {
        const wrongChars = (question.wrongSelections || []).join(',');
        return `<div class="listen-result-row error">${escapeHtml(question.char)}(误认为：${escapeHtml(wrongChars)})</div>`;
      }).join('')
    : '<span class="listen-result-empty">无，表现很棒</span>';

  if (retryBtn) {
    retryBtn.style.display = hasRetryTargets ? 'inline-flex' : 'none';
    retryBtn.textContent = '重新练';
  }

  if (nextBtn) {
    nextBtn.textContent = nextLabel;
  }

  modal.classList.add('active');
}
