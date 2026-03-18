export function createNotebookSupport({
  state,
  completionModalState,
  normalizeWrongCharEntries,
  escapeHtml,
  renderUnitPreservingScroll,
  renderUnit,
  saveCurrentPosition,
  loadNotebookData,
  stopActiveAudioPlayback,
  flushNotebookMutations,
  loadProfilePageData,
  navigateToUnit,
  getCurrentUnitChars,
  setMainViewMode,
  getNotebookPracticeQuestion,
  getNotebookPracticeCharContext,
  practiceAudioUiState,
  setSpeakerButtonPlaying,
  showToast,
  getUserKey,
  invalidateNotebookCache,
}) {
  function removeNotebookMistakeItemLocally({ char, level, unit, mistakeMode }) {
    state.notebook.items = (state.notebook.items || []).filter((item) => !(
      item.char === char
      && item.level === level
      && item.unit === unit
      && item.mistake_mode === mistakeMode
    ));

    if (state.appSection === 'profile' && state.profileView === 'main') {
      renderUnitPreservingScroll();
    }
  }

  function removeWrongCharEntryLocally({ ownerChar, ownerLevel, ownerUnit, mistakeMode, wrongChar, wrongLevel, wrongUnit }) {
    state.notebook.items = (state.notebook.items || []).map((item) => {
      if (
        item.char !== ownerChar
        || item.level !== ownerLevel
        || item.unit !== ownerUnit
        || item.mistake_mode !== mistakeMode
      ) {
        return item;
      }

      const nextWrongChars = normalizeWrongCharEntries(item.wrong_chars, item.level, item.unit).filter((entry) => !(
        entry.char === wrongChar
        && entry.level === wrongLevel
        && entry.unit === wrongUnit
      ));

      return {
        ...item,
        wrong_chars: nextWrongChars,
      };
    });

    if (state.appSection === 'profile' && state.profileView === 'main') {
      renderUnitPreservingScroll();
    }
  }

  async function removeUserMistakeRecord({ char, level, unit, mistakeMode }) {
    const username = getUserKey();
    if (!char || !level || !unit || !mistakeMode) return;

    if (!window.audioManager?.supabase || !username) {
      return;
    }

    try {
      const { error } = await audioManager.supabase
        .from('user_mistakes')
        .delete()
        .eq('username', username)
        .eq('char', char)
        .eq('level', level)
        .eq('unit', unit)
        .eq('mistake_mode', mistakeMode);

      if (error) throw error;
      removeNotebookMistakeItemLocally({ char, level, unit, mistakeMode });
    } catch (error) {
      console.error('移除生字本错题失败:', error);
    }
  }

  async function removeWrongCharEntryFromMistakeRecord({
    ownerChar,
    ownerLevel,
    ownerUnit,
    mistakeMode,
    wrongChar,
    wrongLevel,
    wrongUnit,
  }) {
    const username = getUserKey();
    if (!ownerChar || !ownerLevel || !ownerUnit || !mistakeMode || !wrongChar) return;

    if (!window.audioManager?.supabase || !username) {
      return;
    }

    try {
      const { data, error } = await audioManager.supabase
        .from('user_mistakes')
        .select('*')
        .eq('username', username)
        .eq('char', ownerChar)
        .eq('level', ownerLevel)
        .eq('unit', ownerUnit)
        .eq('mistake_mode', mistakeMode)
        .maybeSingle();

      if (error) throw error;
      if (!data) return;

      const nextWrongChars = normalizeWrongCharEntries(data.wrong_chars, ownerLevel, ownerUnit).filter((entry) => !(
        entry.char === wrongChar
        && entry.level === wrongLevel
        && entry.unit === wrongUnit
      ));

      const { error: updateError } = await audioManager.supabase
        .from('user_mistakes')
        .update({
          wrong_chars: nextWrongChars,
          updated_at: new Date().toISOString(),
        })
        .eq('username', username)
        .eq('char', ownerChar)
        .eq('level', ownerLevel)
        .eq('unit', ownerUnit)
        .eq('mistake_mode', mistakeMode);

      if (updateError) throw updateError;

      removeWrongCharEntryLocally({
        ownerChar,
        ownerLevel,
        ownerUnit,
        mistakeMode,
        wrongChar,
        wrongLevel,
        wrongUnit,
      });
    } catch (error) {
      console.error('移除误认字失败:', error);
    }
  }

  function playNotebookPracticeAudio() {
    if (state.profileView !== 'notebookPractice' || state.notebook.practice.mode !== 'listen' || state.isTeachingMode) return;
    const question = getNotebookPracticeQuestion();
    if (!question) return;
    const context = getNotebookPracticeCharContext(question.char);
    const btn = document.getElementById('notebookListenReplayBtn');
    if (!btn) return;

    if (btn.classList.contains('playing')) {
      stopActiveAudioPlayback();
      return;
    }

    const cleanup = () => {
      if (practiceAudioUiState.button === btn) {
        practiceAudioUiState.button = null;
        practiceAudioUiState.cleanup = null;
      }
      setSpeakerButtonPlaying(btn, false);
    };

    setSpeakerButtonPlaying(btn, true);
    practiceAudioUiState.button = btn;
    practiceAudioUiState.cleanup = cleanup;
    audioManager.stopCurrentAudio();
    audioManager.playAudio(context.level, context.unit, question.char, question.char, 'char', null, cleanup).catch((err) => {
      cleanup();
      showToast('播放失败: ' + err.message, 'error');
    });
  }

  function setProfileView(view) {
    state.profileView = view;
    renderUnit();
    saveCurrentPosition();
    if (view === 'notebook') {
      loadNotebookData();
    }
  }

  async function returnToNotebookList() {
    stopActiveAudioPlayback();
    await flushNotebookMutations();
    state.profileView = 'main';
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    renderUnit();
  }

  async function jumpToNotebookOrigin(level, unit, char) {
    if (!level || !unit || !char) return;
    state.appSection = 'home';
    await navigateToUnit(level, unit);
    const chars = getCurrentUnitChars();
    const nextIndex = chars.indexOf(char);
    if (nextIndex !== -1) {
      state.homeCardIndex = nextIndex;
      state.homeCardMotion = 'none';
    }
    setMainViewMode('study', { resetListen: false, autoPlay: false });
  }

  function showNotebookPracticeCompletionModal() {
    const session = state.notebook.practice;
    const modal = document.getElementById('listenCompletionModal');
    const correctList = document.getElementById('listenCorrectList');
    const wrongList = document.getElementById('listenWrongList');
    const summary = document.getElementById('listenCompletionSummary');
    const retryBtn = document.getElementById('retryListenBtn');
    const nextBtn = document.getElementById('nextListenUnitBtn');
    if (!modal || !correctList || !wrongList || !summary || !session) return;

    completionModalState.kind = 'notebook';
    completionModalState.mode = state.notebook.practice.mode;
    stopActiveAudioPlayback();

    const correctQuestions = session.questions.filter((question) => question.countedCorrect === true);
    const wrongQuestions = session.questions.filter((question) => question.countedCorrect === false);
    const hasRetryTargets = session.questions.some((question) => (question.wrongSelections || []).length > 0);

    summary.textContent = wrongQuestions.length === 0
      ? '本组全部正确！'
      : `本组共 ${session.sequence.length} 个字，选对 ${correctQuestions.length} 个，未选对 ${wrongQuestions.length} 个。`;

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
      nextBtn.textContent = '下一组';
    }

    modal.classList.add('active');
  }

  return {
    removeUserMistakeRecord,
    removeWrongCharEntryFromMistakeRecord,
    playNotebookPracticeAudio,
    setProfileView,
    returnToNotebookList,
    jumpToNotebookOrigin,
    showNotebookPracticeCompletionModal,
  };
}
