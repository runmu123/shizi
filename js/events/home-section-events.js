export function setupHomeSectionEvents({
  appEl,
  bottomNav,
  state,
  saveCurrentPosition,
  updateAppShell,
  exitLearning,
  returnToHomeStudy,
  setAppSection,
  setMainViewMode,
  setPracticeEntryContext,
  switchTeachingMode,
  tryEnterTeachingMode,
  toggleInlineCollapse,
}) {
  if (bottomNav) {
    bottomNav.addEventListener('click', (e) => {
      const item = e.target.closest('.bottom-nav-item');
      if (!item) return;
      e.stopPropagation();
      const section = item.dataset.section || 'home';
      const learningActive = document.getElementById('learningView')?.classList.contains('active');
      if (section === 'home') {
        if (learningActive) {
          exitLearning();
          state.appSection = 'home';
          saveCurrentPosition();
          updateAppShell();
          return;
        }
        returnToHomeStudy();
        return;
      }
      if (learningActive) {
        exitLearning();
      }
      setAppSection(section);
    });
  }

  appEl.addEventListener('click', (e) => {
    if (state.appSection === 'profile') return;
    const actionCard = e.target.closest('.section-action-card');
    if (!actionCard) return;
    const action = actionCard.dataset.action;
    if (!action) return;

    if (action === 'listen') {
      setPracticeEntryContext('listen', 'other', {
        appSection: state.appSection,
        mainViewMode: 'study',
      });
      setAppSection('home');
      setMainViewMode('listen', { resetListen: true, autoPlay: true });
      return;
    }

    if (action === 'see') {
      setPracticeEntryContext('see', 'other', {
        appSection: state.appSection,
        mainViewMode: 'study',
      });
      setAppSection('home');
      setMainViewMode('see', { resetListen: true, autoPlay: false });
      return;
    }

    if (action === 'download') {
      window.shiziActions?.openDownloadDialog?.();
      return;
    }

    if (action === 'clear-cache') {
      window.shiziActions?.clearAudioCache?.();
      return;
    }

    if (action === 'toggle-teaching') {
      if (state.isTeachingMode) {
        switchTeachingMode(false);
      } else {
        tryEnterTeachingMode();
      }
      setAppSection('home');
      return;
    }

    if (action === 'refresh') {
      window.shiziActions?.hardRefresh?.();
      return;
    }

    if (action === 'notebook-item') {
      return;
    }
  });
}
