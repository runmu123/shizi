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

  function normalizePracticeEntry(entry, fallbackLevel = state.currentLevel, fallbackUnit = getCurrentUnitName()) {
    if (typeof entry === 'string') {
      const char = entry.trim();
      return char ? { char, level: fallbackLevel, unit: fallbackUnit } : null;
    }
    if (!entry || typeof entry !== 'object') return null;
    const char = String(entry.char || '').trim();
    if (!char) return null;
    return {
      char,
      level: String(entry.level || fallbackLevel || '').trim(),
      unit: String(entry.unit || fallbackUnit || '').trim(),
    };
  }

  function buildPracticeQuestion(entry, mode, fallbackLevel = state.currentLevel, fallbackUnit = getCurrentUnitName()) {
    const normalizedEntry = normalizePracticeEntry(entry, fallbackLevel, fallbackUnit);
    if (!normalizedEntry) return null;
    const question = {
      char: normalizedEntry.char,
      level: normalizedEntry.level,
      unit: normalizedEntry.unit,
      options: buildListenOptions(normalizedEntry.char),
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
    const fallbackLevel = state.currentLevel;
    const fallbackUnit = unitName;
    const normalizedEntries = [];
    const seen = new Set();

    (chars || []).forEach((entry) => {
      const normalizedEntry = normalizePracticeEntry(entry, fallbackLevel, fallbackUnit);
      if (!normalizedEntry) return;
      const key = `${normalizedEntry.char}__${normalizedEntry.level}__${normalizedEntry.unit}`;
      if (seen.has(key)) return;
      seen.add(key);
      normalizedEntries.push(normalizedEntry);
    });

    state[modeKey] = createEmptyState(unitName);
    const shuffledEntries = shuffleArray([...normalizedEntries]);
    state[modeKey].questions = shuffledEntries
      .map((entry) => buildPracticeQuestion(entry, mode, fallbackLevel, fallbackUnit))
      .filter(Boolean);
    state[modeKey].sequence = state[modeKey].questions.map((question) => question.char);
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
    createEmptyListenState,
    createEmptySeeState,
    buildListenOptions,
    initializeListenSession,
    initializeSeeSession,
    ensurePracticeSession,
  };
}
