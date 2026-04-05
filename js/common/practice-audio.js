export function playPracticeQuestionAudio({
  question,
  context,
  replayButtonId,
  practiceAudioUiState,
  setSpeakerButtonPlaying,
  stopActiveAudioPlayback,
  showToast,
  enabled = true,
}) {
  if (!enabled || !question?.char || !context?.unit || !window.audioManager) return;

  const btn = replayButtonId ? document.getElementById(replayButtonId) : null;
  if (btn?.classList.contains('playing')) {
    stopActiveAudioPlayback?.();
    return;
  }

  const cleanup = () => {
    if (practiceAudioUiState.button === btn) {
      practiceAudioUiState.button = null;
      practiceAudioUiState.cleanup = null;
    }
    if (btn) {
      setSpeakerButtonPlaying(btn, false);
    }
  };

  if (btn) {
    setSpeakerButtonPlaying(btn, true);
    practiceAudioUiState.button = btn;
    practiceAudioUiState.cleanup = cleanup;
  }

  audioManager.stopCurrentAudio();
  audioManager.playAudio(
    context.level,
    context.unit,
    question.char,
    question.char,
    'char',
    null,
    cleanup,
  ).then((success) => {
    if (!success) {
      cleanup();
      showToast('暂无录音', 'info');
    }
  }).catch((err) => {
    cleanup();
    showToast('播放失败: ' + err.message, 'error');
  });
}
