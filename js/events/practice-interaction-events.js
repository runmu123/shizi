export function setupPracticeInteractionEvents({
  appEl,
  state,
  searchInput,
  unitNavigator,
  isPracticeMode,
  handleNotebookListenPracticeAnswer,
  handleListenModeAnswer,
  handleNotebookSeePracticeAnswer,
  handleSeeModeAnswer,
  playSeeOptionAudio,
  stopActiveAudioPlayback,
  navigateNotebookReviewCardTo,
  getCurrentUnitChars,
  navigateHomeCard,
  navigateHomeCardByOffset,
  enterLearning,
  navigateSeeHistory,
  navigateListenHistory,
  navigateNotebookReviewCard,
  setMainViewMode,
  setPracticeEntryContext,
  returnFromMainPractice,
  playListenModeAudio,
}) {
  let listenTouchStartX = 0;
  let listenTouchStartY = 0;
  let homeTouchStartX = 0;
  let homeTouchStartY = 0;
  const seeDragState = {
    active: false,
    pointerId: null,
    ghostEl: null,
    sourceEl: null,
    currentTarget: null,
    suppressClickUntil: 0,
  };

  appEl.addEventListener('click', (e) => {
    const listenOptionBtn = e.target.closest('.listen-option-btn');
    if (listenOptionBtn) {
      e.stopPropagation();
      if (state.profileView === 'notebookPractice' && state.notebook.practice.mode === 'listen') {
        handleNotebookListenPracticeAnswer(listenOptionBtn.dataset.char || '');
        return;
      }
      handleListenModeAnswer(listenOptionBtn.dataset.char || '');
      return;
    }

    const seeOptionBtn = e.target.closest('.see-audio-option');
    if (seeOptionBtn) {
      e.stopPropagation();
      if (state.profileView === 'notebookPractice' && state.notebook.practice.mode === 'see') {
        if (Date.now() < seeDragState.suppressClickUntil) return;
        if (seeOptionBtn.classList.contains('revealed')) return;
        if (seeOptionBtn.classList.contains('playing')) {
          stopActiveAudioPlayback();
          return;
        }
        playSeeOptionAudio(seeOptionBtn.dataset.char || '', seeOptionBtn);
        return;
      }
      if (Date.now() < seeDragState.suppressClickUntil) return;
      if (seeOptionBtn.classList.contains('revealed')) return;
      if (seeOptionBtn.classList.contains('playing')) {
        stopActiveAudioPlayback();
        return;
      }
      playSeeOptionAudio(seeOptionBtn.dataset.char || '', seeOptionBtn);
      return;
    }

    const notebookReviewChar = e.target.closest('[data-notebook-review-char]');
    if (notebookReviewChar) {
      const nextIndex = parseInt(notebookReviewChar.dataset.notebookReviewChar || '0', 10);
      if (!Number.isNaN(nextIndex)) {
        navigateNotebookReviewCardTo(nextIndex);
      }
      return;
    }

    const practiceActionBtn = e.target.closest('[data-practice-action]');
    if (practiceActionBtn?.dataset.practiceAction === 'back-main-practice') {
      e.stopPropagation();
      returnFromMainPractice();
      return;
    }

    const unitCharLink = e.target.closest('.unit-char-link');
    if (unitCharLink) {
      const targetChar = unitCharLink.dataset.char;
      if (targetChar && state.appSection === 'home' && state.mainViewMode === 'study') {
        const chars = getCurrentUnitChars();
        const nextIndex = chars.indexOf(targetChar);
        if (nextIndex !== -1) {
          navigateHomeCard(nextIndex, nextIndex > state.homeCardIndex ? 'next' : 'prev');
        }
      }
      return;
    }

    const homeCardNavBtn = e.target.closest('#homeCardPrevBtn, #homeCardNextBtn');
    if (homeCardNavBtn) {
      e.stopPropagation();
      navigateHomeCardByOffset(homeCardNavBtn.id === 'homeCardPrevBtn' ? -1 : 1);
      return;
    }

    const charBox = e.target.closest('.char-box');
    if (charBox) {
      const charText = charBox.querySelector('.char-text');
      const char = charText ? charText.textContent.trim() : '';
      if (char) {
        const container = charBox.closest('.char-header-container');
        const playBtn = container ? container.querySelector('.play-btn') : null;
        let level = state.currentLevel;
        let unit = state.unitKeys ? state.unitKeys[state.currentUnitIndex] : '';

        if (playBtn && playBtn.dataset.level) {
          level = playBtn.dataset.level;
          unit = playBtn.dataset.unit;
        }
        enterLearning(char, level, unit);
      }
    }
  });

  appEl.addEventListener('touchstart', (e) => {
    if (!isPracticeMode() || state.isTeachingMode) return;
    const panel = e.target.closest('.listen-mode-panel');
    if (!panel || e.touches.length !== 1) return;
    listenTouchStartX = e.touches[0].clientX;
    listenTouchStartY = e.touches[0].clientY;
  }, { passive: true });

  appEl.addEventListener('touchstart', (e) => {
    if (state.appSection !== 'home' || state.mainViewMode !== 'study' || state.isTeachingMode) return;
    const stage = e.target.closest('.home-card-stage');
    if (!stage || e.touches.length !== 1) return;
    homeTouchStartX = e.touches[0].clientX;
    homeTouchStartY = e.touches[0].clientY;
  }, { passive: true });

  appEl.addEventListener('touchend', (e) => {
    if (!isPracticeMode() || state.isTeachingMode) return;
    const panel = e.target.closest('.listen-mode-panel');
    if (!panel || e.changedTouches.length !== 1) return;

    const deltaX = e.changedTouches[0].clientX - listenTouchStartX;
    const deltaY = e.changedTouches[0].clientY - listenTouchStartY;
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    if (deltaX > 0) {
      if (state.mainViewMode === 'see') {
        navigateSeeHistory('prev');
      } else {
        navigateListenHistory('prev');
      }
    } else if (state.mainViewMode === 'see') {
      navigateSeeHistory('next');
    } else {
      navigateListenHistory('next');
    }
  }, { passive: true });

  appEl.addEventListener('touchend', (e) => {
    if (state.appSection !== 'home' || state.mainViewMode !== 'study' || state.isTeachingMode) return;
    const stage = e.target.closest('.home-card-stage');
    if (!stage || e.changedTouches.length !== 1) return;

    const deltaX = e.changedTouches[0].clientX - homeTouchStartX;
    const deltaY = e.changedTouches[0].clientY - homeTouchStartY;
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    navigateHomeCardByOffset(deltaX > 0 ? -1 : 1);
  }, { passive: true });

  appEl.addEventListener('touchstart', (e) => {
    if (state.appSection !== 'profile' || state.profileView !== 'notebookReview') return;
    const stage = e.target.closest('.home-card-stage');
    if (!stage || e.touches.length !== 1) return;
    homeTouchStartX = e.touches[0].clientX;
    homeTouchStartY = e.touches[0].clientY;
  }, { passive: true });

  appEl.addEventListener('touchend', (e) => {
    if (state.appSection !== 'profile' || state.profileView !== 'notebookReview') return;
    const stage = e.target.closest('.home-card-stage');
    if (!stage || e.changedTouches.length !== 1) return;
    const deltaX = e.changedTouches[0].clientX - homeTouchStartX;
    const deltaY = e.changedTouches[0].clientY - homeTouchStartY;
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    navigateNotebookReviewCard(deltaX > 0 ? -1 : 1);
  }, { passive: true });

  const clearSeeDragState = () => {
    if (seeDragState.sourceEl) {
      seeDragState.sourceEl.classList.remove('dragging');
    }
    if (seeDragState.currentTarget) {
      seeDragState.currentTarget.classList.remove('drag-over');
    }
    if (seeDragState.ghostEl?.parentNode) {
      seeDragState.ghostEl.parentNode.removeChild(seeDragState.ghostEl);
    }
    seeDragState.active = false;
    seeDragState.pointerId = null;
    seeDragState.ghostEl = null;
    seeDragState.sourceEl = null;
    seeDragState.currentTarget = null;
  };

  const updateSeeDragTarget = (clientX, clientY) => {
    if (seeDragState.currentTarget) {
      seeDragState.currentTarget.classList.remove('drag-over');
      seeDragState.currentTarget = null;
    }

    const hovered = document.elementFromPoint(clientX, clientY)?.closest('.see-audio-option:not(.revealed)');
    if (hovered) {
      hovered.classList.add('drag-over');
      seeDragState.currentTarget = hovered;
    }
  };

  appEl.addEventListener('pointerdown', (e) => {
    const isSeePage =
      (!state.isTeachingMode && state.mainViewMode === 'see') ||
      (state.profileView === 'notebookPractice' && state.notebook.practice.mode === 'see');
    if (!isSeePage || state.isTeachingMode) return;
    const card = e.target.closest('.see-char-card');
    if (!card || e.button !== 0) return;

    e.preventDefault();
    clearSeeDragState();

    const rect = card.getBoundingClientRect();
    const ghostEl = card.cloneNode(true);
    ghostEl.style.position = 'fixed';
    ghostEl.style.left = `${rect.left}px`;
    ghostEl.style.top = `${rect.top}px`;
    ghostEl.style.width = `${rect.width}px`;
    ghostEl.style.height = `${rect.height}px`;
    ghostEl.style.pointerEvents = 'none';
    ghostEl.style.zIndex = '9999';
    ghostEl.style.margin = '0';
    ghostEl.classList.add('dragging');
    document.body.appendChild(ghostEl);

    seeDragState.active = true;
    seeDragState.pointerId = e.pointerId;
    seeDragState.ghostEl = ghostEl;
    seeDragState.sourceEl = card;
    card.classList.add('dragging');
    updateSeeDragTarget(e.clientX, e.clientY);
  });

  appEl.addEventListener('pointermove', (e) => {
    if (!seeDragState.active || seeDragState.pointerId !== e.pointerId) return;
    e.preventDefault();

    if (seeDragState.ghostEl) {
      const ghostRect = seeDragState.ghostEl.getBoundingClientRect();
      seeDragState.ghostEl.style.left = `${e.clientX - ghostRect.width / 2}px`;
      seeDragState.ghostEl.style.top = `${e.clientY - ghostRect.height / 2}px`;
    }

    updateSeeDragTarget(e.clientX, e.clientY);
  });

  const finishSeeDrag = (e) => {
    if (!seeDragState.active || seeDragState.pointerId !== e.pointerId) return;
    e.preventDefault();
    const target = seeDragState.currentTarget;
    clearSeeDragState();
    if (target) {
      seeDragState.suppressClickUntil = Date.now() + 320;
      if (state.profileView === 'notebookPractice' && state.notebook.practice.mode === 'see') {
        handleNotebookSeePracticeAnswer(target.dataset.char || '');
      } else {
        handleSeeModeAnswer(target.dataset.char || '');
      }
    }
  };

  appEl.addEventListener('pointerup', finishSeeDrag);
  appEl.addEventListener('pointercancel', finishSeeDrag);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#earStudyToggleBtnMain');
    if (!btn || state.isTeachingMode) return;
    e.stopPropagation();
    if (searchInput.value) {
      searchInput.value = '';
      unitNavigator.style.visibility = 'visible';
    }
    if (state.mainViewMode === 'study') {
      setPracticeEntryContext('listen', 'home-unit', {
        appSection: state.appSection,
        mainViewMode: 'study',
      });
    }
    setMainViewMode(state.mainViewMode === 'listen' ? 'study' : 'listen', {
      resetListen: true,
      autoPlay: true,
    });
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#eyeStudyToggleBtnMain');
    if (!btn || state.isTeachingMode) return;
    e.stopPropagation();
    if (searchInput.value) {
      searchInput.value = '';
      unitNavigator.style.visibility = 'visible';
    }
    if (state.mainViewMode === 'study') {
      setPracticeEntryContext('see', 'home-unit', {
        appSection: state.appSection,
        mainViewMode: 'study',
      });
    }
    setMainViewMode(state.mainViewMode === 'see' ? 'study' : 'see', {
      resetListen: true,
      autoPlay: false,
    });
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#listenReplayBtn');
    if (!btn) return;
    e.stopPropagation();
    if (btn.classList.contains('playing')) {
      stopActiveAudioPlayback();
      return;
    }
    playListenModeAudio();
  });
}
