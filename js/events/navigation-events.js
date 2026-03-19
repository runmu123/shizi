import { handleHomeCardKeyboard } from '../common/home-stage-navigation.js';

export function setupNavigationEvents({
  state,
  currentLevelBtn,
  levelDropdown,
  searchInput,
  unitNavigator,
  prevBtn,
  nextBtn,
  unitSelect,
  passwordModal,
  passwordInput,
  passwordError,
  listenCompletionModal,
  lockScroll,
  unlockScroll,
  switchTeachingMode,
  saveCurrentPosition,
  loadLevel,
  searchChar,
  isPracticeMode,
  updateEarStudyButtonForMode,
  refreshCurrentUnitView,
  stopLearnBatchPlayback,
  navigateListenHistory,
  navigateSeeHistory,
  navigateHomeCardByOffset,
  navigateNotebookReviewCard,
  TEACH_PASSWORD,
}) {
  const tryEnterTeachingMode = () => {
    const currentUser = localStorage.getItem('shizi_user');
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
      options.forEach((o) => o.classList.remove('active'));
      opt.classList.add('active');
      levelDropdown.classList.remove('show');
      currentLevelBtn.classList.remove('active');

      state.currentLevel = level;
      state.homeCardIndex = 0;
      state.homeCardMotion = 'none';
      stopLearnBatchPlayback(true);
      await loadLevel(level);
      saveCurrentPosition();
    } else {
      levelDropdown.classList.remove('show');
      currentLevelBtn.classList.remove('active');
    }
  });

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    stopLearnBatchPlayback(true);
    if (val && val.length === 1) {
      if (isPracticeMode()) {
        state.mainViewMode = 'study';
        updateEarStudyButtonForMode();
        saveCurrentPosition();
      }
      searchChar(val);
    } else if (val.length === 0) {
      unitNavigator.style.visibility = 'visible';
      refreshCurrentUnitView({
        resetListen: isPracticeMode(),
        autoPlayListen: false,
      });
    }
  });

  const goPrevUnit = () => {
    if (state.currentUnitIndex > 0) {
      stopLearnBatchPlayback(true);
      state.currentUnitIndex -= 1;
      state.homeCardIndex = 0;
      state.homeCardMotion = 'none';
      refreshCurrentUnitView({
        resetListen: isPracticeMode(),
        autoPlayListen: state.mainViewMode === 'listen' && !state.isTeachingMode,
      });
      saveCurrentPosition();
    }
  };

  const goNextUnit = () => {
    if (state.currentUnitIndex < state.unitKeys.length - 1) {
      stopLearnBatchPlayback(true);
      state.currentUnitIndex += 1;
      state.homeCardIndex = 0;
      state.homeCardMotion = 'none';
      refreshCurrentUnitView({
        resetListen: isPracticeMode(),
        autoPlayListen: state.mainViewMode === 'listen' && !state.isTeachingMode,
      });
      saveCurrentPosition();
    }
  };

  prevBtn.addEventListener('click', goPrevUnit);
  nextBtn.addEventListener('click', goNextUnit);

  unitSelect.addEventListener('change', (e) => {
    const idx = parseInt(e.target.value, 10);
    if (!Number.isNaN(idx) && idx >= 0 && idx < state.unitKeys.length) {
      stopLearnBatchPlayback(true);
      state.currentUnitIndex = idx;
      state.homeCardIndex = 0;
      state.homeCardMotion = 'none';
      refreshCurrentUnitView({
        resetListen: isPracticeMode(),
        autoPlayListen: state.mainViewMode === 'listen' && !state.isTeachingMode,
      });
      saveCurrentPosition();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (document.getElementById('learningView').classList.contains('active')) return;
    if (document.getElementById('batchRecordView').classList.contains('active')) return;
    if (document.getElementById('batchPlayView').classList.contains('active')) return;
    if (document.getElementById('passwordModal').classList.contains('active')) return;
    if (listenCompletionModal?.classList.contains('active')) return;

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

    if (state.mainViewMode === 'see' && !state.isTeachingMode) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateSeeHistory('prev');
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateSeeHistory('next');
        return;
      }
    }

    if (handleHomeCardKeyboard({
      event: e,
      isActive: state.appSection === 'home' && state.mainViewMode === 'study',
      navigateHomeCardByOffset,
    })) {
      return;
    }

    if (state.appSection === 'profile' && state.profileView === 'notebookReview') {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateNotebookReviewCard(-1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateNotebookReviewCard(1);
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

  return {
    tryEnterTeachingMode,
    goPrevUnit,
    goNextUnit,
  };
}
