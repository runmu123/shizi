import { finalizeCorrectAnswer, handleWrongAnswer } from '../common/practice-answer-flow.js';
import { collectRetryEntries } from '../common/practice-retry.js';

export function createPracticeEngine({
  state,
  getActivePracticeMode,
  getPracticeState,
  initializeSeeSession,
  initializeListenSession,
  getCurrentUnitName,
  renderUnit,
  saveCurrentPosition,
  scheduleListenModeAutoPlay,
  stopActiveAudioPlayback,
  showPracticeCompletionModal,
  ensureListenSession,
  ensureSeeSession,
  getListenQuestion,
  getSeeQuestion,
  showToast,
  playSpecificListenCharAudio,
  updateUserMistakeRecord,
  findCharUnitInCurrentLevel,
  playCharAudio,
}) {
  function getQuestionContext(question, fallbackUnit = getCurrentUnitName()) {
    return {
      level: question?.level || state.currentLevel,
      unit: question?.unit || fallbackUnit,
    };
  }

  function getSelectedCharContext(selectedChar, fallbackUnit = getCurrentUnitName()) {
    return {
      char: selectedChar,
      level: state.currentLevel,
      unit: findCharUnitInCurrentLevel(selectedChar) || fallbackUnit,
    };
  }

  function markQuestionCorrect(question) {
    question.answered = true;
    question.countedCorrect = question.hadMistake ? false : true;
  }

  function markQuestionMistaken(question, selectedChar, { revealOption = false } = {}) {
    question.hadMistake = true;
    if (!question.wrongSelections.includes(selectedChar)) {
      question.wrongSelections.push(selectedChar);
    }
    if (revealOption && !question.revealedOptions.includes(selectedChar)) {
      question.revealedOptions.push(selectedChar);
    }
    if (question.countedCorrect === true || question.countedCorrect === null) {
      question.countedCorrect = false;
    }
  }

  async function retryWrongPracticeItems(mode = getActivePracticeMode()) {
    const session = getPracticeState(mode);
    if (!session) return;

    const retryEntries = await collectRetryEntries({
      questions: session.questions,
      getQuestionContext: (question) => getQuestionContext(question),
      resolveWrongEntry: async (wrongChar, questionContext) => getSelectedCharContext(wrongChar, questionContext.unit),
    });

    if (!retryEntries.length) {
      showToast(mode === 'see' ? '当前没有需要重新练的字' : '当前没有需要重新听的字', 'info');
      return;
    }

    if (mode === 'see') {
      initializeSeeSession(retryEntries, getCurrentUnitName());
    } else {
      initializeListenSession(retryEntries, getCurrentUnitName());
    }
    renderUnit();
    saveCurrentPosition();
    if (mode === 'listen') {
      scheduleListenModeAutoPlay();
    }
  }

  function goToNextListenItem() {
    stopActiveAudioPlayback();
    if (state.listenMode.currentIndex >= state.listenMode.sequence.length - 1) {
      renderUnit();
      showPracticeCompletionModal('listen');
      return;
    }

    state.listenMode.currentIndex += 1;
    state.listenMode.currentMistaken = false;
    ensureListenSession(false);
    state.listenMode.options = getListenQuestion()?.options ? [...getListenQuestion().options] : [];
    renderUnit();
    saveCurrentPosition();
    scheduleListenModeAutoPlay();
  }

  function goToNextSeeItem() {
    stopActiveAudioPlayback();
    if (state.seeMode.currentIndex >= state.seeMode.sequence.length - 1) {
      renderUnit();
      showPracticeCompletionModal('see');
      return;
    }

    state.seeMode.currentIndex += 1;
    state.seeMode.currentMistaken = false;
    ensureSeeSession(false);
    state.seeMode.options = getSeeQuestion()?.options ? [...getSeeQuestion().options] : [];
    renderUnit();
    saveCurrentPosition();
  }

  function navigateListenHistory(direction) {
    if (state.mainViewMode !== 'listen' || state.isTeachingMode) return;

    const maxNavigableIndex = Math.min(
      state.listenMode.answeredChars.length,
      Math.max(0, state.listenMode.sequence.length - 1),
    );
    if (maxNavigableIndex < 0) return;

    if (direction === 'prev') {
      if (state.listenMode.currentIndex <= 0) return;
      state.listenMode.currentIndex -= 1;
    } else if (direction === 'next') {
      if (state.listenMode.currentIndex >= maxNavigableIndex) return;
      state.listenMode.currentIndex += 1;
    } else {
      return;
    }

    state.listenMode.currentMistaken = !!getListenQuestion()?.hadMistake;
    state.listenMode.options = getListenQuestion()?.options ? [...getListenQuestion().options] : [];
    renderUnit();
    scheduleListenModeAutoPlay();
  }

  function navigateSeeHistory(direction) {
    if (state.mainViewMode !== 'see' || state.isTeachingMode) return;

    const maxNavigableIndex = Math.min(
      state.seeMode.answeredChars.length,
      Math.max(0, state.seeMode.sequence.length - 1),
    );
    if (maxNavigableIndex < 0) return;

    if (direction === 'prev') {
      if (state.seeMode.currentIndex <= 0) return;
      state.seeMode.currentIndex -= 1;
    } else if (direction === 'next') {
      if (state.seeMode.currentIndex >= maxNavigableIndex) return;
      state.seeMode.currentIndex += 1;
    } else {
      return;
    }

    state.seeMode.currentMistaken = !!getSeeQuestion()?.hadMistake;
    state.seeMode.options = getSeeQuestion()?.options ? [...getSeeQuestion().options] : [];
    renderUnit();
  }

  function handleListenModeAnswer(selectedChar) {
    if (state.mainViewMode !== 'listen' || state.isTeachingMode) return;

    const question = getListenQuestion();
    const currentChar = question?.char || '';
    if (!currentChar || !question) return;

    if (selectedChar === currentChar) {
      question.selectedChar = selectedChar;
      if (!question.answered) {
        finalizeCorrectAnswer({
          question,
          currentChar,
          markQuestionCorrect,
          ensureAnsweredChar: (char) => {
            if (!question.hadMistake && !state.listenMode.firstTryCorrectChars.includes(char)) {
              state.listenMode.firstTryCorrectChars.push(char);
            }
            if (!state.listenMode.answeredChars.includes(char)) {
              state.listenMode.answeredChars.push(char);
            }
          },
          stopActiveAudioPlayback,
          showToast,
          advance: () => goToNextListenItem(),
        });
      } else {
        showToast('已切回正确答案', 'success');
        setTimeout(() => {
          navigateListenHistory('next');
        }, 280);
      }
      return;
    }

    state.listenMode.currentMistaken = true;
    question.selectedChar = selectedChar;
    const questionContext = getQuestionContext(question);
    const selectedContext = getSelectedCharContext(selectedChar, questionContext.unit);
    void handleWrongAnswer({
      question,
      selectedChar,
      markQuestionMistaken,
      afterMarkMistaken: () => {
        if (!state.listenMode.mistakeChars.includes(currentChar)) {
          state.listenMode.mistakeChars.push(currentChar);
        }
      },
      persistWrongSelection: () => updateUserMistakeRecord({
        char: currentChar,
        level: questionContext.level,
        unit: questionContext.unit,
        mistakeMode: 'listen',
        wrongChar: selectedContext,
      }),
      showToast,
      playWrongAudio: () => playSpecificListenCharAudio(selectedChar, selectedContext),
    });
  }

  function handleSeeModeAnswer(selectedChar) {
    if (state.mainViewMode !== 'see' || state.isTeachingMode) return;

    const question = getSeeQuestion();
    const currentChar = question?.char || '';
    if (!currentChar || !question || !selectedChar) return;

    if (selectedChar === currentChar) {
      question.selectedChar = selectedChar;
      if (!question.answered) {
        finalizeCorrectAnswer({
          question,
          currentChar,
          markQuestionCorrect: (currentQuestion) => {
            currentQuestion.answered = true;
            currentQuestion.countedCorrect = currentQuestion.hadMistake ? false : true;
          },
          ensureAnsweredChar: (char) => {
            if (!question.hadMistake && !state.seeMode.firstTryCorrectChars.includes(char)) {
              state.seeMode.firstTryCorrectChars.push(char);
            }
            if (!state.seeMode.answeredChars.includes(char)) {
              state.seeMode.answeredChars.push(char);
            }
          },
          renderBeforeToast: renderUnit,
          stopActiveAudioPlayback,
          showToast,
          advance: () => goToNextSeeItem(),
        });
      } else {
        renderUnit();
        showToast('已切回正确答案', 'success');
        setTimeout(() => {
          navigateSeeHistory('next');
        }, 280);
      }
      return;
    }

    state.seeMode.currentMistaken = true;
    question.selectedChar = selectedChar;
    const questionContext = getQuestionContext(question);
    const selectedContext = getSelectedCharContext(selectedChar, questionContext.unit);

    void handleWrongAnswer({
      question,
      selectedChar,
      markQuestionMistaken,
      revealOption: true,
      afterMarkMistaken: () => {
        if (!state.seeMode.mistakeChars.includes(currentChar)) {
          state.seeMode.mistakeChars.push(currentChar);
        }
      },
      persistWrongSelection: () => updateUserMistakeRecord({
        char: currentChar,
        level: questionContext.level,
        unit: questionContext.unit,
        mistakeMode: 'see',
        wrongChar: selectedContext,
      }),
      renderBeforeToast: renderUnit,
      showToast,
      playWrongAudio: () => playCharAudio(selectedChar, {
        level: selectedContext.level,
        unit: selectedContext.unit,
      }),
    });
  }

  return {
    retryWrongPracticeItems,
    navigateListenHistory,
    navigateSeeHistory,
    handleListenModeAnswer,
    handleSeeModeAnswer,
    markQuestionCorrect,
    markQuestionMistaken,
  };
}
