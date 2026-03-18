export function createPracticePlaybackSupport({
  state,
  practiceAudioUiState,
  getPracticeState,
  findCharUnitInCurrentLevel,
  getCurrentListenChar,
  resolveCharOrigin,
  getSpeakerIconHtml,
  getPauseIconHtml,
  setSpeakerButtonPlaying,
  showToast,
}) {
  function stopActiveAudioPlayback() {
    if (window.audioManager && typeof audioManager.stopCurrentAudio === 'function') {
      audioManager.stopCurrentAudio();
    }
    if (typeof practiceAudioUiState.cleanup === 'function') {
      practiceAudioUiState.cleanup();
    }
    practiceAudioUiState.button = null;
    practiceAudioUiState.cleanup = null;
  }

  function getActivePracticeMode() {
    return state.mainViewMode === 'see' ? 'see' : 'listen';
  }

  function getPracticeQuestion(mode = state.mainViewMode, index = null) {
    const session = getPracticeState(mode);
    if (!session) return null;
    const resolvedIndex = index === null ? session.currentIndex : index;
    return session.questions[resolvedIndex] || null;
  }

  function playCharAudio(char, { button = null, setPauseIcon = false, level = '', unit = '' } = {}) {
    if (!char || state.isTeachingMode || !window.audioManager) return;

    const resolvedLevel = level || state.currentLevel;
    const unitName = unit || findCharUnitInCurrentLevel(char);
    const cleanup = () => {
      if (practiceAudioUiState.button === button) {
        practiceAudioUiState.button = null;
        practiceAudioUiState.cleanup = null;
      }
      if (!button) return;
      button.classList.remove('playing');
      if (setPauseIcon) {
        button.innerHTML = getSpeakerIconHtml();
      }
    };

    if (button) {
      button.classList.add('playing');
      if (setPauseIcon) {
        button.innerHTML = getPauseIconHtml();
      }
      practiceAudioUiState.button = button;
      practiceAudioUiState.cleanup = cleanup;
    }

    audioManager.stopCurrentAudio();
    audioManager.playAudio(
      resolvedLevel,
      unitName,
      char,
      char,
      'char',
      null,
      cleanup,
    ).then((success) => {
      if (!success) {
        cleanup();
        showToast('暂无录音', 'info');
      }
    }).catch((err) => {
      cleanup();
      showToast('播放失败: ' + err.message, 'error');
    });
  }

  function playListenModeAudio() {
    if (state.mainViewMode !== 'listen' || state.isTeachingMode) return;

    const currentChar = getCurrentListenChar();
    const unitName = findCharUnitInCurrentLevel(currentChar);
    const btn = document.getElementById('listenReplayBtn');

    if (!currentChar || !unitName || !window.audioManager) return;

    if (btn) {
      setSpeakerButtonPlaying(btn, true);
      practiceAudioUiState.button = btn;
    }

    const cleanup = () => {
      if (practiceAudioUiState.button === btn) {
        practiceAudioUiState.button = null;
        practiceAudioUiState.cleanup = null;
      }
      if (!btn) return;
      setSpeakerButtonPlaying(btn, false);
    };
    practiceAudioUiState.cleanup = cleanup;

    audioManager.stopCurrentAudio();
    audioManager.playAudio(
      state.currentLevel,
      unitName,
      currentChar,
      currentChar,
      'char',
      null,
      cleanup,
    ).then((success) => {
      if (!success) {
        cleanup();
        showToast('暂无录音', 'info');
      }
    }).catch((err) => {
      cleanup();
      showToast('播放失败: ' + err.message, 'error');
    });
  }

  function playSpecificListenCharAudio(char) {
    playCharAudio(char);
  }

  async function playSeeOptionAudio(char, btn = null) {
    const inMainSeeMode = state.mainViewMode === 'see' && state.appSection === 'home';
    const inNotebookSeePractice = state.profileView === 'notebookPractice' && state.notebook.practice.mode === 'see';
    if ((!inMainSeeMode && !inNotebookSeePractice) || state.isTeachingMode || !char) return;
    if (btn?.classList.contains('revealed')) return;
    const preferredLevel = inNotebookSeePractice
      ? state.notebook.practice.level
      : state.currentLevel;
    const context = await resolveCharOrigin(char, preferredLevel);
    playCharAudio(char, {
      button: btn,
      setPauseIcon: true,
      level: context?.level || preferredLevel,
      unit: context?.unit || '',
    });
  }

  function scheduleListenModeAutoPlay() {
    if (state.mainViewMode !== 'listen' || state.isTeachingMode) return;
    setTimeout(() => {
      playListenModeAudio();
    }, 80);
  }

  return {
    stopActiveAudioPlayback,
    getActivePracticeMode,
    getPracticeQuestion,
    playCharAudio,
    playListenModeAudio,
    playSpecificListenCharAudio,
    playSeeOptionAudio,
    scheduleListenModeAutoPlay,
  };
}
