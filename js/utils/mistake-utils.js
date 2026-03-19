export function normalizeWrongCharEntries(wrongChars, fallbackLevel = '', fallbackUnit = '') {
  if (!Array.isArray(wrongChars)) return [];

  const seen = new Set();
  const result = [];

  wrongChars.forEach((item) => {
    let entry = null;

    if (typeof item === 'string') {
      const char = item.trim();
      if (char) {
        entry = { char, level: fallbackLevel, unit: fallbackUnit };
      }
    } else if (item && typeof item === 'object') {
      const char = String(item.char || '').trim();
      if (char) {
        entry = {
          char,
          level: String(item.level || fallbackLevel || '').trim(),
          unit: String(item.unit || fallbackUnit || '').trim(),
        };
      }
    }

    if (!entry) return;

    const key = `${entry.char}__${entry.level}__${entry.unit}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(entry);
  });

  return result;
}

export function findWrongCharEntry(wrongChars, char, fallbackLevel = '', fallbackUnit = '') {
  if (!char) return null;
  return normalizeWrongCharEntries(wrongChars, fallbackLevel, fallbackUnit)
    .find((item) => item.char === char) || null;
}
