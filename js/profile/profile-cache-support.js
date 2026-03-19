import { normalizeWrongCharEntries } from '../utils/mistake-utils.js';

function sortNotebookItems(items) {
  return [...items].sort((a, b) => {
    const ta = new Date(a.last_wrong_at || a.created_at || 0).getTime();
    const tb = new Date(b.last_wrong_at || b.created_at || 0).getTime();
    return tb - ta;
  });
}

export function upsertNotebookItemInState(state, {
  username,
  char,
  level,
  unit,
  mistakeMode,
  mistakeCount = 1,
  wrongChars = [],
  lastWrongAt = new Date().toISOString(),
}) {
  if (!state?.notebook || !username || !char || !level || !unit || !mistakeMode) return;

  const normalizedWrongChars = normalizeWrongCharEntries(wrongChars, level, unit);
  const items = Array.isArray(state.notebook.items) ? [...state.notebook.items] : [];
  const existingIndex = items.findIndex((item) => (
    item.char === char
    && item.level === level
    && item.unit === unit
    && item.mistake_mode === mistakeMode
  ));

  const nextItem = {
    ...(existingIndex >= 0 ? items[existingIndex] : {}),
    username,
    char,
    level,
    unit,
    mistake_mode: mistakeMode,
    mistake_count: mistakeCount,
    wrong_chars: normalizedWrongChars,
    last_wrong_at: lastWrongAt,
  };

  if (existingIndex >= 0) {
    items[existingIndex] = nextItem;
  } else {
    items.push(nextItem);
  }

  state.notebook.items = sortNotebookItems(items);
  state.notebook.loadedUser = username;
  state.notebook.error = '';
}

export function removeNotebookItemFromState(state, { char, level, unit, mistakeMode }) {
  if (!state?.notebook) return;
  state.notebook.items = (state.notebook.items || []).filter((item) => !(
    item.char === char
    && item.level === level
    && item.unit === unit
    && item.mistake_mode === mistakeMode
  ));
}

export function removeWrongCharEntryFromNotebookState(state, {
  ownerChar,
  ownerLevel,
  ownerUnit,
  mistakeMode,
  wrongChar,
  wrongLevel,
  wrongUnit,
}) {
  if (!state?.notebook) return;

  state.notebook.items = (state.notebook.items || []).map((item) => {
    if (
      item.char !== ownerChar
      || item.level !== ownerLevel
      || item.unit !== ownerUnit
      || item.mistake_mode !== mistakeMode
    ) {
      return item;
    }

    return {
      ...item,
      wrong_chars: normalizeWrongCharEntries(item.wrong_chars, item.level, item.unit).filter((entry) => !(
        entry.char === wrongChar
        && entry.level === wrongLevel
        && entry.unit === wrongUnit
      )),
    };
  });
}

export function upsertProgressEntryInState(state, {
  username,
  char,
  level,
  unit,
}) {
  if (!state?.profileProgress || !username || !char || !level || !unit) return;

  if (!state.profileProgress.grouped[level]) {
    state.profileProgress.grouped[level] = {};
  }
  if (!Array.isArray(state.profileProgress.grouped[level][unit])) {
    state.profileProgress.grouped[level][unit] = [];
  }

  const chars = state.profileProgress.grouped[level][unit];
  if (!chars.includes(char)) {
    chars.push(char);
  }

  const uniqueChars = new Set();
  Object.values(state.profileProgress.grouped || {}).forEach((units) => {
    Object.values(units || {}).forEach((unitChars) => {
      (unitChars || []).forEach((itemChar) => uniqueChars.add(itemChar));
    });
  });

  state.profileProgress.total = uniqueChars.size;
  state.profileProgress.loadedUser = username;
  state.profileProgress.error = '';
}

export function upsertAudioProgressEntryInState(state, {
  level,
  unit,
  char,
}) {
  if (!state?.audioProgress || !level || !unit || !char) return;

  if (!state.audioProgress.grouped[level]) {
    state.audioProgress.grouped[level] = {};
  }
  if (!Array.isArray(state.audioProgress.grouped[level][unit])) {
    state.audioProgress.grouped[level][unit] = [];
  }

  const chars = state.audioProgress.grouped[level][unit];
  if (!chars.includes(char)) {
    chars.push(char);
  }

  const uniqueChars = new Set();
  Object.entries(state.audioProgress.grouped || {}).forEach(([groupLevel, units]) => {
    Object.entries(units || {}).forEach(([groupUnit, unitChars]) => {
      (unitChars || []).forEach((itemChar) => uniqueChars.add(`${groupLevel}__${groupUnit}__${itemChar}`));
    });
  });

  state.audioProgress.total = uniqueChars.size;
  state.audioProgress.loaded = true;
  state.audioProgress.error = '';
}
