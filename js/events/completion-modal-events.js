export function setupCompletionModalEvents({
  listenCompletionModal,
  closeListenCompletion,
  nextListenUnitBtn,
  retryListenBtn,
  completionModalState,
  state,
  showToast,
  moveToNextNotebookPracticeGroup,
  resetCurrentPracticeState,
  refreshCurrentUnitView,
  saveCurrentPosition,
  retryCurrentNotebookPracticeGroup,
  retryWrongPracticeItems,
  getActivePracticeMode,
}) {
  if (closeListenCompletion) {
    closeListenCompletion.addEventListener('click', () => {
      listenCompletionModal?.classList.remove('active');
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
    nextListenUnitBtn.addEventListener('click', async () => {
      listenCompletionModal?.classList.remove('active');

      if (completionModalState.kind === 'notebook') {
        await moveToNextNotebookPracticeGroup();
        return;
      }

      if (state.currentUnitIndex >= state.unitKeys.length - 1) {
        showToast('已经是最后一个单元', 'info');
        return;
      }

      state.currentUnitIndex += 1;
      state.homeCardIndex = 0;
      state.homeCardMotion = 'none';
      resetCurrentPracticeState();
      refreshCurrentUnitView({ resetListen: true, autoPlayListen: true });
      saveCurrentPosition();
    });
  }

  if (retryListenBtn) {
    retryListenBtn.addEventListener('click', () => {
      listenCompletionModal?.classList.remove('active');
      if (completionModalState.kind === 'notebook') {
        retryCurrentNotebookPracticeGroup();
        return;
      }
      retryWrongPracticeItems(getActivePracticeMode());
    });
  }
}
