export function createPracticeStateSupport({
  state,
  shuffleArray,
  getCurrentUnitName,
  getLevelCharPool,
}) {
  function createEmptyPracticeState(unitName = '') {
    return {
      unitName,
      sequence: [],
      questions: [],
      currentIndex: 0,
      options: [],
      mistakeChars: [],
      firstTryCorrectChars: [],
      answeredChars: [],
      currentMistaken: false,
    };
  }

  function createEmptyListenState(unitName = '') {
    return createEmptyPracticeState(unitName);
  }

  function createEmptySeeState(unitName = '') {
    return createEmptyPracticeState(unitName);
  }

  function buildListenOptions(correctChar) {
    const distractors = shuffleArray(
      getLevelCharPool().filter((char) => char && char !== correctChar),
    ).slice(0, 3);

    return shuffleArray([correctChar, ...distractors]);
  }

  function buildPracticeQuestion(char, mode) {
    const question = {
      char,
      options: buildListenOptions(char),
      selectedChar: '',
      answered: false,
      hadMistake: false,
      countedCorrect: null,
      wrongSelections: [],
    };
    if (mode === 'see') {
      question.revealedOptions = [];
    }
    return question;
  }

  function initializePracticeSession(mode, chars, unitName = getCurrentUnitName()) {
    const modeKey = mode === 'see' ? 'seeMode' : 'listenMode';
    const createEmptyState = mode === 'see' ? createEmptySeeState : createEmptyListenState;
    const normalizedChars = Array.from(new Set((chars || []).filter(Boolean)));

    state[modeKey] = createEmptyState(unitName);
    state[modeKey].sequence = shuffleArray(normalizedChars);
    state[modeKey].questions = state[modeKey].sequence.map((char) => buildPracticeQuestion(char, mode));
    state[modeKey].options = state[modeKey].questions[0]?.options
      ? [...state[modeKey].questions[0].options]
      : [];
  }

  function initializeListenSession(chars, unitName = getCurrentUnitName()) {
    initializePracticeSession('listen', chars, unitName);
  }

  function initializeSeeSession(chars, unitName = getCurrentUnitName()) {
    initializePracticeSession('see', chars, unitName);
  }

  function ensurePracticeSession(mode, getQuestion, forceReset = false) {
    const modeState = mode === 'see' ? state.seeMode : state.listenMode;
    const initialize = mode === 'see' ? initializeSeeSession : initializeListenSession;
    const unitName = getCurrentUnitName();
    const unitData = unitName ? state.currentData?.[unitName] : null;
    const unitChars = Object.keys(unitData || {});
    const shouldReset =
      forceReset ||
      modeState.unitName !== unitName ||
      modeState.sequence.length === 0;

    if (shouldReset) {
      initialize(unitChars, unitName);
    }

    const question = getQuestion();
    const currentChar = question?.char || '';
    modeState.options = question ? [...question.options] : [];
    return currentChar;
  }

  return {
    createEmptyPracticeState,
    createEmptyListenState,
    createEmptySeeState,
    buildListenOptions,
    buildPracticeQuestion,
    initializePracticeSession,
    initializeListenSession,
    initializeSeeSession,
    ensurePracticeSession,
  };
}
