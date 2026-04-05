import { playPracticeQuestionAudio } from '../common/practice-audio.js';
import { showPracticeCompletionModalShared } from '../common/practice-completion-modal.js';

export function createNotebookSupport({
  state,
  completionModalState,
  normalizeWrongCharEntries,
  escapeHtml,
  renderUnitPreservingScroll,
  renderUnit,
  stopActiveAudioPlayback,
  flushNotebookMutations,
  navigateToUnit,
  getCurrentUnitChars,
  setMainViewMode,
  getNotebookPracticeQuestion,
  getNotebookPracticeCharContext,
  practiceAudioUiState,
  setSpeakerButtonPlaying,
  showToast,
  getUserKey,
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
      console.error('移除错题失败:', error);
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
    playPracticeQuestionAudio({
      question,
      context,
      replayButtonId: 'notebookListenReplayBtn',
      practiceAudioUiState,
      setSpeakerButtonPlaying,
      stopActiveAudioPlayback,
      showToast,
      enabled: !state.isTeachingMode,
    });
  }

  async function returnToNotebookList() {
    stopActiveAudioPlayback();
    void flushNotebookMutations().catch((error) => {
      console.error('后台同步错题列表失败:', error);
    });
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
    showPracticeCompletionModalShared({
      kind: 'notebook',
      mode: state.notebook.practice.mode,
      session: state.notebook.practice,
      completionModalState,
      stopActiveAudioPlayback,
      escapeHtml,
      scopeLabel: '本组',
      allCorrectText: '本组全部正确！',
      nextLabel: '下一组',
    });
  }

  return {
    removeUserMistakeRecord,
    removeWrongCharEntryFromMistakeRecord,
    playNotebookPracticeAudio,
    returnToNotebookList,
    jumpToNotebookOrigin,
    showNotebookPracticeCompletionModal,
  };
}
