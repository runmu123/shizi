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

  function retryWrongPracticeItems(mode = getActivePracticeMode()) {
    const session = getPracticeState(mode);
    if (!session) return;

    const retryEntryMap = new Map();
    session.questions
      .filter((question) => question.countedCorrect === false)
      .forEach((question) => {
        const questionContext = getQuestionContext(question);
        const questionKey = `${question.char}__${questionContext.level}__${questionContext.unit}`;
        retryEntryMap.set(questionKey, {
          char: question.char,
          level: questionContext.level,
          unit: questionContext.unit,
        });

        (question.wrongSelections || [])
          .filter(Boolean)
          .forEach((wrongChar) => {
            const selectedContext = getSelectedCharContext(wrongChar, questionContext.unit);
            const wrongKey = `${selectedContext.char}__${selectedContext.level}__${selectedContext.unit}`;
            retryEntryMap.set(wrongKey, selectedContext);
          });
      });

    const retryEntries = Array.from(retryEntryMap.values());

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
        markQuestionCorrect(question);

        if (!question.hadMistake && !state.listenMode.firstTryCorrectChars.includes(currentChar)) {
          state.listenMode.firstTryCorrectChars.push(currentChar);
        }
        if (!state.listenMode.answeredChars.includes(currentChar)) {
          state.listenMode.answeredChars.push(currentChar);
        }

        showToast('选择正确', 'success');
        stopActiveAudioPlayback();
        setTimeout(() => {
          goToNextListenItem();
        }, 280);
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
    markQuestionMistaken(question, selectedChar);

    if (!state.listenMode.mistakeChars.includes(currentChar)) {
      state.listenMode.mistakeChars.push(currentChar);
    }
    const questionContext = getQuestionContext(question);
    const selectedContext = getSelectedCharContext(selectedChar, questionContext.unit);
    updateUserMistakeRecord({
      char: currentChar,
      level: questionContext.level,
      unit: questionContext.unit,
      mistakeMode: 'listen',
      wrongChar: selectedContext,
    });
    showToast('错误！请重新选择', 'error');
    playSpecificListenCharAudio(selectedChar, selectedContext);
  }

  function handleSeeModeAnswer(selectedChar) {
    if (state.mainViewMode !== 'see' || state.isTeachingMode) return;

    const question = getSeeQuestion();
    const currentChar = question?.char || '';
    if (!currentChar || !question || !selectedChar) return;

    if (selectedChar === currentChar) {
      question.selectedChar = selectedChar;
      if (!question.answered) {
        question.answered = true;
        question.countedCorrect = question.hadMistake ? false : true;

        if (!question.hadMistake && !state.seeMode.firstTryCorrectChars.includes(currentChar)) {
          state.seeMode.firstTryCorrectChars.push(currentChar);
        }
        if (!state.seeMode.answeredChars.includes(currentChar)) {
          state.seeMode.answeredChars.push(currentChar);
        }

        renderUnit();
        showToast('选择正确', 'success');
        stopActiveAudioPlayback();
        setTimeout(() => {
          goToNextSeeItem();
        }, 280);
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
    markQuestionMistaken(question, selectedChar, { revealOption: true });

    if (!state.seeMode.mistakeChars.includes(currentChar)) {
      state.seeMode.mistakeChars.push(currentChar);
    }
    const questionContext = getQuestionContext(question);
    const selectedContext = getSelectedCharContext(selectedChar, questionContext.unit);

    updateUserMistakeRecord({
      char: currentChar,
      level: questionContext.level,
      unit: questionContext.unit,
      mistakeMode: 'see',
      wrongChar: selectedContext,
    });
    renderUnit();
    showToast('错误！请重新选择', 'error');
    playCharAudio(selectedChar, {
      level: selectedContext.level,
      unit: selectedContext.unit,
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
