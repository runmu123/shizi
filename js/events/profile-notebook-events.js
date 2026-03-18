export function setupProfileNotebookEvents({
  appEl,
  toolbarNotebookSwitcher,
  state,
  toggleInlineCollapse,
  navigateToUnit,
  openNotebookReview,
  openNotebookPractice,
  returnToNotebookList,
  jumpToNotebookOrigin,
  navigateNotebookReviewGroup,
  navigateNotebookReviewCard,
  switchNotebookPracticeGroup,
  playNotebookPracticeAudio,
}) {
  appEl.addEventListener('click', (e) => {
    const progressHeader = e.target.closest('[data-profile-progress-header]');
    if (progressHeader) {
      progressHeader.classList.toggle('active');
      progressHeader.nextElementSibling?.classList.toggle('show');
      return;
    }

    const progressNavBtn = e.target.closest('[data-profile-progress-nav]');
    if (progressNavBtn) {
      const [level, unit] = (progressNavBtn.dataset.profileProgressNav || '').split('|');
      if (level && unit) {
        state.appSection = 'home';
        if (state.mainViewMode !== 'study') {
          state.mainViewMode = 'study';
        }
        navigateToUnit(level, unit);
      }
      return;
    }

    const toggle = e.target.closest('[data-notebook-section]');
    if (!toggle) return;
    const mode = toggle.dataset.notebookSection;
    const expanded = !state.notebook.expandedSections[mode];
    state.notebook.expandedSections[mode] = expanded;
    toggleInlineCollapse(toggle, expanded);
  });

  appEl.addEventListener('click', (e) => {
    const notebookLevelHeader = e.target.closest('[data-notebook-level-header]');
    if (!notebookLevelHeader) return;
    const [mode, level] = (notebookLevelHeader.dataset.notebookLevelHeader || '').split('|');
    if (!mode || !level) return;
    const expanded = !(!!state.notebook.expandedLevels?.[mode]?.[level]);
    if (!state.notebook.expandedLevels[mode]) {
      state.notebook.expandedLevels[mode] = {};
    }
    state.notebook.expandedLevels[mode][level] = expanded;
    notebookLevelHeader.classList.toggle('active', expanded);
    notebookLevelHeader.nextElementSibling?.classList.toggle('show', expanded);
  });

  appEl.addEventListener('click', (e) => {
    const notebookActionBtn = e.target.closest('[data-notebook-action], [data-notebook-review-nav], [data-notebook-review-card], [data-notebook-practice-group]');
    if (!notebookActionBtn) return;
    e.stopPropagation();

    if (notebookActionBtn.dataset.notebookAction === 'review') {
      openNotebookReview(
        notebookActionBtn.dataset.mode || 'listen',
        notebookActionBtn.dataset.level || '未分级',
        parseInt(notebookActionBtn.dataset.groupIndex || '0', 10),
      );
      return;
    }

    if (notebookActionBtn.dataset.notebookAction === 'practice') {
      openNotebookPractice(
        notebookActionBtn.dataset.mode || 'listen',
        notebookActionBtn.dataset.level || '未分级',
        parseInt(notebookActionBtn.dataset.groupIndex || '0', 10),
      );
      return;
    }

    if (notebookActionBtn.dataset.notebookAction === 'back-to-notebook') {
      returnToNotebookList();
      return;
    }

    if (notebookActionBtn.dataset.notebookAction === 'jump') {
      jumpToNotebookOrigin(
        notebookActionBtn.dataset.level || '',
        notebookActionBtn.dataset.unit || '',
        notebookActionBtn.dataset.char || '',
      );
      return;
    }

    if (notebookActionBtn.dataset.notebookReviewNav) {
      navigateNotebookReviewGroup(notebookActionBtn.dataset.notebookReviewNav === 'next' ? 1 : -1);
      return;
    }

    if (notebookActionBtn.dataset.notebookReviewCard) {
      navigateNotebookReviewCard(notebookActionBtn.dataset.notebookReviewCard === 'next' ? 1 : -1);
      return;
    }

    if (notebookActionBtn.dataset.notebookPracticeGroup) {
      switchNotebookPracticeGroup(notebookActionBtn.dataset.notebookPracticeGroup === 'next' ? 1 : -1);
    }
  });

  toolbarNotebookSwitcher?.addEventListener('click', (e) => {
    const toolbarBtn = e.target.closest('[data-notebook-review-nav], [data-notebook-practice-group]');
    if (!toolbarBtn) return;
    e.stopPropagation();

    if (toolbarBtn.dataset.notebookReviewNav) {
      navigateNotebookReviewGroup(toolbarBtn.dataset.notebookReviewNav === 'next' ? 1 : -1);
      return;
    }

    if (toolbarBtn.dataset.notebookPracticeGroup) {
      switchNotebookPracticeGroup(toolbarBtn.dataset.notebookPracticeGroup === 'next' ? 1 : -1);
    }
  });

  appEl.addEventListener('click', (e) => {
    if (state.profileView !== 'notebookPractice') return;
    const replayBtn = e.target.closest('#notebookListenReplayBtn');
    if (replayBtn) {
      e.stopPropagation();
      playNotebookPracticeAudio();
    }
  });
}
