import { finalizeCorrectAnswer, handleWrongAnswer } from '../common/practice-answer-flow.js';
import { collectRetryEntries } from '../common/practice-retry.js';

export function createNotebookEngine({
  state,
  normalizeWrongCharEntries,
  findWrongCharEntry,
  getNotebookGroupsByLevel,
  shuffleArray,
  buildListenOptions,
  renderUnit,
  showToast,
  playNotebookPracticeAudio,
  stopActiveAudioPlayback,
  waitForNextFrame,
  flushNotebookMutations,
  showNotebookPracticeCompletionModal,
  getCurrentUnitName,
  resolveCharOrigin,
  playSpecificListenCharAudio,
  playCharAudio,
  updateUserMistakeRecord,
  trackNotebookMutation,
  removeUserMistakeRecord,
  removeWrongCharEntryFromMistakeRecord,
  currentLevel,
  markQuestionCorrect,
  markQuestionMistaken,
}) {
  function navigateNotebookReviewCard(offset) {
    const groups = (getNotebookGroupsByLevel(state.notebook.reviewMode)[state.notebook.reviewLevel] || []);
    const group = groups[state.notebook.reviewGroupIndex] || [];
    const nextIndex = state.notebook.reviewCardIndex + offset;
    if (nextIndex < 0 || nextIndex >= group.length) return;
    state.notebook.reviewMotion = offset > 0 ? 'next' : 'prev';
    state.notebook.reviewCardIndex = nextIndex;
    renderUnit();
  }

  function navigateNotebookReviewCardTo(targetIndex) {
    const groups = (getNotebookGroupsByLevel(state.notebook.reviewMode)[state.notebook.reviewLevel] || []);
    const group = groups[state.notebook.reviewGroupIndex] || [];
    if (!group.length) return;
    const nextIndex = Math.max(0, Math.min(targetIndex, group.length - 1));
    if (nextIndex === state.notebook.reviewCardIndex) return;
    state.notebook.reviewMotion = nextIndex > state.notebook.reviewCardIndex ? 'next' : 'prev';
    state.notebook.reviewCardIndex = nextIndex;
    renderUnit();
  }

  function navigateNotebookReviewGroup(offset) {
    const groups = (getNotebookGroupsByLevel(state.notebook.reviewMode)[state.notebook.reviewLevel] || []);
    const nextGroup = state.notebook.reviewGroupIndex + offset;
    if (nextGroup < 0 || nextGroup >= groups.length) return;
    state.notebook.reviewGroupIndex = nextGroup;
    state.notebook.reviewCardIndex = 0;
    state.notebook.reviewMotion = 'none';
    renderUnit();
  }

  function openNotebookReview(mode, level, groupIndex) {
    state.profileView = 'notebookReview';
    state.notebook.reviewMode = mode;
    state.notebook.reviewLevel = level;
    state.notebook.reviewGroupIndex = groupIndex;
    state.notebook.reviewCardIndex = 0;
    state.notebook.reviewMotion = 'none';
    renderUnit();
  }

  function getNotebookPracticeSourceItems(mode, level, groupIndex) {
    return (getNotebookGroupsByLevel(mode)[level] || [])[groupIndex] || [];
  }

  function collectNotebookPracticeChars(sourceItems) {
    return Array.from(new Set(
      (sourceItems || [])
        .flatMap((item) => [item.char, ...normalizeWrongCharEntries(item.wrong_chars, item.level, item.unit).map((entry) => entry.char)])
        .filter(Boolean),
    ));
  }

  function buildNotebookPracticeQuestions(chars) {
    return chars.map((char) => ({
      char,
      options: buildListenOptions(char),
      selectedChar: '',
      answered: false,
      hadMistake: false,
      countedCorrect: null,
      wrongSelections: [],
      wrongSelectionEntries: [],
      revealedOptions: [],
    }));
  }

  function initializeNotebookPracticeSession(mode, level, groupIndex, { allowRemoval = true } = {}) {
    const sourceItems = getNotebookPracticeSourceItems(mode, level, groupIndex);
    const chars = collectNotebookPracticeChars(sourceItems);

    state.notebook.practice = {
      mode,
      level,
      groupIndex,
      allowRemoval,
      title: `第${groupIndex + 1}组`,
      sourceItems,
      sequence: shuffleArray(chars),
      questions: buildNotebookPracticeQuestions(chars),
      currentIndex: 0,
      answeredChars: [],
      currentMistaken: false,
    };
  }

  function openNotebookPractice(mode, level, groupIndex) {
    initializeNotebookPracticeSession(mode, level, groupIndex, { allowRemoval: true });
    state.profileView = 'notebookPractice';
    renderUnit();
    if (mode === 'listen') {
      setTimeout(() => playNotebookPracticeAudio(), 80);
    }
  }

  function getNotebookPracticeQuestion() {
    return state.notebook.practice.questions[state.notebook.practice.currentIndex] || null;
  }

  function findNotebookPracticeMistakeItem(char) {
    if (!char) return null;
    const sourceItems = state.notebook.practice.sourceItems || [];
    const exact = sourceItems.find((item) => item.char === char);
    if (exact) return exact;
    return sourceItems.find((item) => !!findWrongCharEntry(item.wrong_chars, char, item.level, item.unit)) || null;
  }

  function findExactNotebookPracticeMistakeItem(char) {
    if (!char) return null;
    const sourceItems = state.notebook.practice.sourceItems || [];
    return sourceItems.find((item) => item.char === char) || null;
  }

  function findPersistedNotebookMistakeItem({ char, level, unit, mistakeMode }) {
    return (state.notebook.items || []).find((item) => (
      item.char === char
      && item.level === level
      && item.unit === unit
      && item.mistake_mode === mistakeMode
    )) || null;
  }

  function getNotebookPracticeCharContext(char) {
    const exact = state.notebook.practice.sourceItems.find((item) => item.char === char);
    if (exact) return exact;
    for (const item of (state.notebook.practice.sourceItems || [])) {
      const relatedEntry = findWrongCharEntry(item.wrong_chars, char, item.level, item.unit);
      if (relatedEntry) {
        return relatedEntry;
      }
    }
    return state.notebook.practice.sourceItems[0] || { level: currentLevel(), unit: getCurrentUnitName(), char };
  }

  function addNotebookWrongSelectionEntry(question, entry) {
    if (!entry?.char) return;
    if (!Array.isArray(question.wrongSelectionEntries)) {
      question.wrongSelectionEntries = [];
    }
    const exists = question.wrongSelectionEntries.some((item) => (
      item.char === entry.char
      && item.level === entry.level
      && item.unit === entry.unit
    ));
    if (!exists) {
      question.wrongSelectionEntries.push({
        char: entry.char,
        level: entry.level,
        unit: entry.unit,
      });
    }
  }

  function applyNotebookCorrectSideEffects(session, currentChar, question) {
    if (!session.allowRemoval || question.hadMistake) return;

    const exactMistakeItem = findExactNotebookPracticeMistakeItem(currentChar);
    if (exactMistakeItem) {
      trackNotebookMutation(removeUserMistakeRecord({
        char: exactMistakeItem.char,
        level: exactMistakeItem.level,
        unit: exactMistakeItem.unit,
        mistakeMode: exactMistakeItem.mistake_mode || session.mode,
      }));
      return;
    }

    const ownerMistakeItem = findNotebookPracticeMistakeItem(currentChar);
    const wrongEntry = findWrongCharEntry(
      ownerMistakeItem?.wrong_chars,
      currentChar,
      ownerMistakeItem?.level,
      ownerMistakeItem?.unit,
    );
    const persistedOwner = ownerMistakeItem
      ? findPersistedNotebookMistakeItem({
          char: ownerMistakeItem.char,
          level: ownerMistakeItem.level,
          unit: ownerMistakeItem.unit,
          mistakeMode: ownerMistakeItem.mistake_mode || session.mode,
        })
      : null;

    if (persistedOwner && wrongEntry) {
      trackNotebookMutation(removeWrongCharEntryFromMistakeRecord({
        ownerChar: persistedOwner.char,
        ownerLevel: persistedOwner.level,
        ownerUnit: persistedOwner.unit,
        mistakeMode: persistedOwner.mistake_mode || session.mode,
        wrongChar: wrongEntry.char,
        wrongLevel: wrongEntry.level,
        wrongUnit: wrongEntry.unit,
      }));
    }
  }

  async function goToNextNotebookPracticeItem() {
    stopActiveAudioPlayback();
    const session = state.notebook.practice;
    if (session.currentIndex >= session.sequence.length - 1) {
      renderUnit();
      await waitForNextFrame();
      void flushNotebookMutations().catch((error) => {
        console.error('后台同步练习结果失败:', error);
      });
      showNotebookPracticeCompletionModal();
      return;
    }
    session.currentIndex += 1;
    session.currentMistaken = false;
    renderUnit();
    if (session.mode === 'listen') {
      setTimeout(() => playNotebookPracticeAudio(), 80);
    }
  }

  async function handleNotebookListenPracticeAnswer(selectedChar) {
    const session = state.notebook.practice;
    if (state.profileView !== 'notebookPractice' || session.mode !== 'listen') return;
    const question = getNotebookPracticeQuestion();
    const currentChar = question?.char || '';
    if (!question || !currentChar) return;

    if (selectedChar === currentChar) {
      finalizeCorrectAnswer({
        question,
        currentChar,
        markQuestionCorrect,
        ensureAnsweredChar: (char) => {
          if (!session.answeredChars.includes(char)) {
            session.answeredChars.push(char);
          }
        },
        beforeAdvance: () => applyNotebookCorrectSideEffects(session, currentChar, question),
        stopActiveAudioPlayback,
        showToast,
        advance: () => goToNextNotebookPracticeItem(),
      });
      return;
    }

    const currentContext = getNotebookPracticeCharContext(currentChar);
    const selectedContext = await resolveCharOrigin(
      selectedChar,
      currentContext?.level || session.level || currentLevel(),
    );

    await handleWrongAnswer({
      question,
      selectedChar,
      markQuestionMistaken,
      persistWrongSelection: () => trackNotebookMutation(updateUserMistakeRecord({
        char: currentChar,
        level: currentContext?.level || session.level || currentLevel(),
        unit: currentContext?.unit || getCurrentUnitName(),
        mistakeMode: session.mode,
        wrongChar: {
          char: selectedChar,
          level: selectedContext?.level || session.level || currentLevel(),
          unit: selectedContext?.unit || getCurrentUnitName(),
        },
      })),
      afterMarkMistaken: () => addNotebookWrongSelectionEntry(question, selectedContext),
      showToast,
      playWrongAudio: () => playSpecificListenCharAudio(selectedChar, {
        level: selectedContext?.level || session.level || currentLevel(),
        unit: selectedContext?.unit || getCurrentUnitName(),
      }),
    });
  }

  async function handleNotebookSeePracticeAnswer(selectedChar) {
    const session = state.notebook.practice;
    if (state.profileView !== 'notebookPractice' || session.mode !== 'see') return;
    const question = getNotebookPracticeQuestion();
    const currentChar = question?.char || '';
    if (!question || !currentChar) return;

    if (selectedChar === currentChar) {
      finalizeCorrectAnswer({
        question,
        currentChar,
        markQuestionCorrect,
        ensureAnsweredChar: (char) => {
          if (!session.answeredChars.includes(char)) {
            session.answeredChars.push(char);
          }
        },
        beforeAdvance: () => applyNotebookCorrectSideEffects(session, currentChar, question),
        renderBeforeToast: renderUnit,
        stopActiveAudioPlayback,
        showToast,
        advance: () => goToNextNotebookPracticeItem(),
      });
      return;
    }

    const currentContext = getNotebookPracticeCharContext(currentChar);
    const selectedContext = await resolveCharOrigin(
      selectedChar,
      currentContext?.level || session.level || currentLevel(),
    );

    await handleWrongAnswer({
      question,
      selectedChar,
      markQuestionMistaken,
      revealOption: true,
      afterMarkMistaken: () => addNotebookWrongSelectionEntry(question, selectedContext),
      persistWrongSelection: () => trackNotebookMutation(updateUserMistakeRecord({
        char: currentChar,
        level: currentContext?.level || session.level || currentLevel(),
        unit: currentContext?.unit || getCurrentUnitName(),
        mistakeMode: session.mode,
        wrongChar: {
          char: selectedChar,
          level: selectedContext?.level || session.level || currentLevel(),
          unit: selectedContext?.unit || getCurrentUnitName(),
        },
      })),
      renderBeforeToast: renderUnit,
      showToast,
      playWrongAudio: () => playCharAudio(selectedChar, {
        level: selectedContext?.level || session.level || currentLevel(),
        unit: selectedContext?.unit || getCurrentUnitName(),
      }),
    });
  }

  async function retryCurrentNotebookPracticeGroup() {
    const session = state.notebook.practice;
    const retryEntries = await collectRetryEntries({
      questions: session.questions,
      getQuestionContext: (question) => {
        const currentContext = getNotebookPracticeCharContext(question.char);
        return {
          level: currentContext?.level || session.level || currentLevel(),
          unit: currentContext?.unit || getCurrentUnitName(),
        };
      },
      getExistingWrongEntry: (question, wrongChar) => (
        Array.isArray(question.wrongSelectionEntries)
          ? question.wrongSelectionEntries.find((entry) => entry.char === wrongChar)
          : null
      ),
      resolveWrongEntry: async (wrongChar, questionContext) => resolveCharOrigin(wrongChar, questionContext.level),
    });
    const retryChars = retryEntries.map((entry) => entry.char);

    if (!retryChars.length) {
      showToast('当前没有需要重新练的字', 'info');
      return;
    }

    initializeNotebookPracticeSession(session.mode, session.level, session.groupIndex, { allowRemoval: false });
    const retrySourceItems = retryEntries.map((entry) => {
      const exactItem = (session.sourceItems || []).find((item) => item.char === entry.char);
      return exactItem || {
        char: entry.char,
        level: entry.level,
        unit: entry.unit,
        wrong_chars: [],
        mistake_mode: session.mode,
      };
    });
    state.notebook.practice.sourceItems = retrySourceItems;
    state.notebook.practice.sequence = shuffleArray(retryChars);
    state.notebook.practice.questions = buildNotebookPracticeQuestions(retryChars);
    state.notebook.practice.currentIndex = 0;
    state.notebook.practice.answeredChars = [];
    state.notebook.practice.currentMistaken = false;
    renderUnit();
    if (session.mode === 'listen') {
      setTimeout(() => playNotebookPracticeAudio(), 80);
    }
  }

  async function moveToNextNotebookPracticeGroup() {
    void flushNotebookMutations().catch((error) => {
      console.error('后台同步下一组练习结果失败:', error);
    });
    const session = state.notebook.practice;
    const groups = (getNotebookGroupsByLevel(session.mode)[session.level] || []);
    const nextGroup = session.groupIndex + 1;
    if (nextGroup >= groups.length) {
      showToast('已经是最后一组', 'info');
      return;
    }
    initializeNotebookPracticeSession(session.mode, session.level, nextGroup, { allowRemoval: true });
    renderUnit();
    if (session.mode === 'listen') {
      setTimeout(() => playNotebookPracticeAudio(), 80);
    }
  }

  function switchNotebookPracticeGroup(offset) {
    const groups = (getNotebookGroupsByLevel(state.notebook.practice.mode)[state.notebook.practice.level] || []);
    const nextGroup = state.notebook.practice.groupIndex + offset;
    if (nextGroup < 0 || nextGroup >= groups.length) return;
    initializeNotebookPracticeSession(state.notebook.practice.mode, state.notebook.practice.level, nextGroup);
    renderUnit();
    if (state.notebook.practice.mode === 'listen') {
      setTimeout(() => playNotebookPracticeAudio(), 80);
    }
  }

  return {
    navigateNotebookReviewCard,
    navigateNotebookReviewCardTo,
    navigateNotebookReviewGroup,
    openNotebookReview,
    initializeNotebookPracticeSession,
    openNotebookPractice,
    getNotebookPracticeQuestion,
    findNotebookPracticeMistakeItem,
    findExactNotebookPracticeMistakeItem,
    findPersistedNotebookMistakeItem,
    getNotebookPracticeCharContext,
    addNotebookWrongSelectionEntry,
    retryCurrentNotebookPracticeGroup,
    moveToNextNotebookPracticeGroup,
    handleNotebookListenPracticeAnswer,
    handleNotebookSeePracticeAnswer,
    switchNotebookPracticeGroup,
  };
}
