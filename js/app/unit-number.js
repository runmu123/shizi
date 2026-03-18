(function initShiziUnitNumber(global) {
  const digitMap = {
    '零': 0,
    '一': 1,
    '二': 2,
    '三': 3,
    '四': 4,
    '五': 5,
    '六': 6,
    '七': 7,
    '八': 8,
    '九': 9,
  };
  const unitMap = {
    '十': 10,
    '百': 100,
    '千': 1000,
  };

  function parseChineseNumber(text) {
    const source = String(text || '').trim();
    if (!source) return null;

    let result = 0;
    let temp = 0;
    let hasNumber = false;

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (digitMap[char] !== undefined) {
        temp = digitMap[char];
        hasNumber = true;
        continue;
      }
      if (!unitMap[char]) continue;
      if (char === '十' && temp === 0 && result === 0) temp = 1;
      result += temp * unitMap[char];
      temp = 0;
      hasNumber = true;
    }

    result += temp;
    return hasNumber ? result : null;
  }

  function toArabicNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value);
    }

    const source = String(value || '').trim();
    if (!source) return null;

    const numericMatch = source.match(/^\d+$/);
    if (numericMatch) {
      const parsed = parseInt(numericMatch[0], 10);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return parseChineseNumber(source);
  }

  function toChineseNumber(value) {
    const parsed = toArabicNumber(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return String(value);
    if (parsed >= 10000) return String(parsed);

    const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const units = ['', '十', '百', '千'];
    const chars = String(parsed).split('').map((digit) => parseInt(digit, 10));

    let result = '';
    for (let index = 0; index < chars.length; index += 1) {
      const digit = chars[index];
      const unitIndex = chars.length - index - 1;
      if (digit === 0) {
        const hasNonZeroAfter = chars.slice(index + 1).some((n) => n !== 0);
        if (!result.endsWith('零') && hasNonZeroAfter) {
          result += '零';
        }
        continue;
      }
      if (!(digit === 1 && unitIndex === 1 && result === '')) {
        result += digits[digit];
      }
      result += units[unitIndex];
    }

    return result.replace(/零+$/g, '');
  }

  function parseUnitNumber(unit) {
    const normalized = String(unit || '').trim();
    if (!normalized) return null;

    const numericMatch = normalized.match(/\d+/);
    if (numericMatch) {
      const parsed = parseInt(numericMatch[0], 10);
      return Number.isFinite(parsed) ? parsed : null;
    }

    const blockMatch = normalized.match(/第(.+)单元/);
    const candidate = blockMatch ? blockMatch[1] : normalized;
    return parseChineseNumber(candidate);
  }

  function getUnitCode(unit) {
    const normalized = String(unit || '');
    const numericMatch = normalized.match(/\d+/);
    if (numericMatch) return numericMatch[0];

    const blockMatch = normalized.match(/第(.+)单元/);
    if (!blockMatch) return normalized;

    const parsed = parseChineseNumber(blockMatch[1]);
    return parsed === null ? blockMatch[1] : parsed;
  }

  global.ShiziUnitNumber = {
    parseChineseNumber,
    toArabicNumber,
    toChineseNumber,
    parseUnitNumber,
    getUnitCode,
  };
})(window);
