export function finalizeCorrectAnswer({
  question,
  currentChar,
  markQuestionCorrect,
  ensureAnsweredChar = null,
  beforeAdvance = null,
  renderBeforeToast = null,
  stopActiveAudioPlayback,
  showToast,
  advance,
  successMessage = '选择正确',
  advanceDelay = 280,
}) {
  if (!question || !currentChar || question.answered) return false;

  markQuestionCorrect(question);
  ensureAnsweredChar?.(currentChar);
  beforeAdvance?.();
  renderBeforeToast?.();
  showToast(successMessage, 'success');
  stopActiveAudioPlayback?.();
  setTimeout(() => {
    advance?.();
  }, advanceDelay);
  return true;
}

export async function handleWrongAnswer({
  question,
  selectedChar,
  markQuestionMistaken,
  revealOption = false,
  afterMarkMistaken = null,
  persistWrongSelection = null,
  renderBeforeToast = null,
  showToast,
  playWrongAudio = null,
  wrongMessage = '错误！请重新选择',
}) {
  if (!question || !selectedChar) return false;

  markQuestionMistaken(question, selectedChar, { revealOption });
  afterMarkMistaken?.(selectedChar);
  renderBeforeToast?.();
  showToast(wrongMessage, 'error');
  playWrongAudio?.(selectedChar);
  Promise.resolve()
    .then(() => persistWrongSelection?.(selectedChar))
    .catch((error) => {
      console.error('异步写入错误记录失败:', error);
    });
  return true;
}
