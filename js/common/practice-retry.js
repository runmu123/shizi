export async function collectRetryEntries({
  questions,
  getQuestionContext,
  getExistingWrongEntry = null,
  resolveWrongEntry,
}) {
  const retryEntryMap = new Map();
  const failedQuestions = (questions || []).filter((question) => question.countedCorrect === false);

  for (const question of failedQuestions) {
    const questionContext = getQuestionContext(question);
    if (question?.char) {
      const questionKey = `${question.char}__${questionContext.level}__${questionContext.unit}`;
      retryEntryMap.set(questionKey, {
        char: question.char,
        level: questionContext.level,
        unit: questionContext.unit,
      });
    }

    for (const wrongChar of (question?.wrongSelections || []).filter(Boolean)) {
      const existingEntry = getExistingWrongEntry?.(question, wrongChar) || null;
      const resolvedEntry = existingEntry || await resolveWrongEntry(wrongChar, questionContext, question);
      const normalizedEntry = {
        char: wrongChar,
        level: resolvedEntry?.level || questionContext.level,
        unit: resolvedEntry?.unit || questionContext.unit,
      };
      const wrongKey = `${normalizedEntry.char}__${normalizedEntry.level}__${normalizedEntry.unit}`;
      retryEntryMap.set(wrongKey, normalizedEntry);
    }
  }

  return Array.from(retryEntryMap.values());
}
