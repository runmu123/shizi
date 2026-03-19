function toggleLevelSection(header, expanded) {
  header.classList.toggle('active', expanded);
  header.nextElementSibling?.classList.toggle('show', expanded);
}

function navigateProfileUnit(state, navigateToUnit, level, unit) {
  if (!level || !unit) return;
  state.appSection = 'home';
  if (state.mainViewMode !== 'study') {
    state.mainViewMode = 'study';
  }
  navigateToUnit(level, unit);
}

export function setupProfileSectionEvents({
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
    if (state.appSection !== 'profile') return;

    const actionCard = e.target.closest('.section-action-card');
    if (actionCard?.dataset.action === 'login') {
      window.shiziActions?.toggleLogin?.();
      return;
    }

    if (actionCard?.dataset.action === 'progress') {
      state.profileProgress.expanded = !state.profileProgress.expanded;
      toggleInlineCollapse(actionCard, state.profileProgress.expanded);
      return;
    }

    if (actionCard?.dataset.action === 'audio-progress') {
      state.audioProgress.expanded = !state.audioProgress.expanded;
      toggleInlineCollapse(actionCard, state.audioProgress.expanded);
      return;
    }

    const progressHeader = e.target.closest('[data-profile-progress-header]');
    if (progressHeader) {
      toggleLevelSection(progressHeader, !progressHeader.classList.contains('active'));
      return;
    }

    const progressNavBtn = e.target.closest('[data-profile-progress-nav]');
    if (progressNavBtn) {
      const [level, unit] = (progressNavBtn.dataset.profileProgressNav || '').split('|');
      navigateProfileUnit(state, navigateToUnit, level, unit);
      return;
    }

    const audioProgressHeader = e.target.closest('[data-audio-progress-header]');
    if (audioProgressHeader) {
      toggleLevelSection(audioProgressHeader, !audioProgressHeader.classList.contains('active'));
      return;
    }

    const audioProgressViewBtn = e.target.closest('[data-audio-progress-view]');
    if (audioProgressViewBtn) {
      const [level, unit] = (audioProgressViewBtn.dataset.audioProgressView || '').split('|');
      navigateProfileUnit(state, navigateToUnit, level, unit);
      return;
    }

    const notebookToggle = e.target.closest('[data-notebook-section]');
    if (notebookToggle) {
      const mode = notebookToggle.dataset.notebookSection;
      const expanded = !state.notebook.expandedSections[mode];
      state.notebook.expandedSections[mode] = expanded;
      toggleInlineCollapse(notebookToggle, expanded);
      return;
    }

    const notebookLevelHeader = e.target.closest('[data-notebook-level-header]');
    if (notebookLevelHeader) {
      const [mode, level] = (notebookLevelHeader.dataset.notebookLevelHeader || '').split('|');
      if (!mode || !level) return;
      if (!state.notebook.expandedLevels[mode]) {
        state.notebook.expandedLevels[mode] = {};
      }
      const expanded = !(!!state.notebook.expandedLevels[mode][level]);
      state.notebook.expandedLevels[mode][level] = expanded;
      toggleLevelSection(notebookLevelHeader, expanded);
      return;
    }

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
      return;
    }

    if (state.profileView === 'notebookPractice' && notebookActionBtn.id === 'notebookListenReplayBtn') {
      playNotebookPracticeAudio();
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
    if (!replayBtn) return;
    e.stopPropagation();
    playNotebookPracticeAudio();
  });
}
