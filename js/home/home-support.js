import { showPracticeCompletionModalShared } from '../common/practice-completion-modal.js';
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
    showPracticeCompletionModalShared({
      kind: 'main',
      mode,
      session: getPracticeState(mode),
      completionModalState,
      stopActiveAudioPlayback,
      escapeHtml,
      scopeLabel: '本单元',
      allCorrectText: '全部正确！',
      nextLabel: '下一单元',
      replayButtonId: 'listenReplayBtn',
      setSpeakerButtonPlaying,
    });
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
