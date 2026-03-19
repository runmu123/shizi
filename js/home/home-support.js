import { buildCompletionSummaryHtml } from '../common/completion-summary.js';
import { isHomeStudyStage } from '../common/home-stage-navigation.js';

export function createHomeSupport({
  state,
  completionModalState,
  getCurrentUnitName,
  renderUnit,
  saveCurrentPosition,
  setMainViewMode,
  stopLearnBatchPlayback,
  getActivePracticeMode,
  getPracticeState,
  stopActiveAudioPlayback,
  setSpeakerButtonPlaying,
  escapeHtml,
}) {
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
    if (!isHomeStudyStage(state)) return;
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

    completionModalState.kind = 'main';
    completionModalState.mode = mode;

    stopActiveAudioPlayback();
    if (replayBtn) {
      setSpeakerButtonPlaying(replayBtn, false);
      replayBtn.disabled = false;
    }

    const correctQuestions = session.questions.filter((question) => question.countedCorrect === true);
    const wrongQuestions = session.questions.filter((question) => question.countedCorrect === false);
    const hasRetryTargets = session.questions.some((question) => (question.wrongSelections || []).length > 0);

    summary.innerHTML = buildCompletionSummaryHtml({
      scopeLabel: '本单元',
      totalCount: session.sequence.length,
      correctCount: correctQuestions.length,
      wrongCount: wrongQuestions.length,
      allCorrectText: '全部正确！',
    });

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
      retryBtn.textContent = '重新练';
    }

    if (nextBtn) {
      nextBtn.textContent = '下一单元';
    }

    modal.classList.add('active');
  }

  return {
    isHomeStudyStage: () => isHomeStudyStage(state),
    returnToHomeStudy,
    getCurrentUnitChars,
    navigateHomeCard,
    navigateHomeCardByOffset,
    showPracticeCompletionModal,
  };
}
