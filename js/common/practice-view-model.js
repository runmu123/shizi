export function buildPracticeViewModel({
  bodyType,
  session,
  titleText,
  backActionAttr,
  progressTitle,
  unitName = '',
  replayButtonId = 'listenReplayBtn',
  promptId = 'seePromptCard',
  promptInteractive = true,
}) {
  const total = session?.sequence?.length || 0;
  const answeredCount = session?.answeredChars?.length || 0;
  const question = session?.questions?.[session.currentIndex] || null;
  const currentChar = question?.char || session?.sequence?.[session.currentIndex] || '';
  const options = Array.isArray(question?.options) ? question.options : [];
  const currentStep = bodyType === 'notebook'
    ? Math.min((session?.currentIndex || 0) + 1, Math.max(total, 1))
    : (answeredCount >= total ? total : Math.min(answeredCount + 1, total));
  const progressPercent = total === 0 ? 0 : Math.round((answeredCount / total) * 100);

  if (bodyType === 'listen') {
    return {
      titleText,
      backActionAttr,
      progressTitle,
      currentStep,
      total,
      progressPercent,
      completedCount: answeredCount,
      bodyType: 'listen',
      bodyPayload: {
        currentChar,
        options,
        unitName,
        replayButtonId,
      },
    };
  }

  return {
    titleText,
    backActionAttr,
    progressTitle,
    currentStep,
    total,
    progressPercent,
    completedCount: answeredCount,
    bodyType: 'see',
    bodyPayload: {
      currentChar,
      options,
      revealedOptions: Array.isArray(question?.revealedOptions) ? question.revealedOptions : [],
      promptId,
      promptInteractive,
    },
  };
}
