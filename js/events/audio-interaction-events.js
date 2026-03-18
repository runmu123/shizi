export function setupAudioInteractionEvents({
  appEl,
  state,
  currentLevelBtn,
  levelDropdown,
  showToast,
  playRecordedBlob,
  updateBtnIcon,
  setSpeakerButtonPlaying,
  toggleLearnBatchPlayback,
  enterBatchRecord,
  enterBatchPlay,
}) {
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.play-btn');
    if (!btn) return;
    if (['learnBatchPlayBtnMain', 'earStudyToggleBtnMain', 'eyeStudyToggleBtnMain', 'batchRecordBtnMain', 'batchPlayBtnMain'].includes(btn.id)) return;
    if (btn.classList.contains('processing') || btn.disabled) return;

    e.stopPropagation();

    const text = btn.dataset.text;
    const type = btn.dataset.type;
    const rootChar = btn.dataset.rootChar;
    const level = btn.dataset.level || state.currentLevel;
    const unit = btn.dataset.unit || (state.unitKeys ? state.unitKeys[state.currentUnitIndex] : '');
    const indexStr = btn.dataset.index;
    const index = indexStr ? parseInt(indexStr, 10) : null;

    if (!text || !level || !unit) {
      console.warn('缺少音频上下文:', { text, type, rootChar, level, unit });
      return;
    }

    if (state.isTeachingMode) {
      if (audioManager.isRecording) {
        btn.classList.add('recording-processing');
        btn.disabled = true;
        btn.innerHTML = '...';
        showToast('正在上传...', 'info');

        try {
          const blob = await audioManager.stopRecording();
          if (blob) {
            playRecordedBlob(blob).catch((err) => {
              showToast('录音预览播放失败: ' + err.message, 'error');
            });
            await audioManager.uploadAudio(blob, level, unit, rootChar, text, type, index);
            showToast('上传成功！', 'success');
          } else {
            showToast('录音失败：未获取到音频数据', 'error');
          }
        } catch (err) {
          showToast('上传失败: ' + err.message, 'error');
        } finally {
          btn.classList.remove('recording-processing');
          btn.classList.remove('recording-active');
          btn.disabled = false;
          updateBtnIcon(btn, true);
        }
      } else {
        try {
          await audioManager.startRecording();
          btn.classList.add('recording-active');
          const isSmall = btn.dataset.isSmall === 'true';
          btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="${isSmall ? 'width:16px;height:16px' : ''}">
            <rect x="6" y="6" width="12" height="12" />
          </svg>`;
          showToast('开始录音', 'info');
        } catch (err) {
          showToast('无法启动录音: ' + err.message, 'error');
        }
      }
    } else {
      if (state.isLoopingAudio) {
        state.isLoopingAudio = false;
        audioManager.stopCurrentAudio();
        return;
      }

      if (btn.classList.contains('playing')) {
        audioManager.stopCurrentAudio();
        if (btn.id === 'listenReplayBtn') {
          setSpeakerButtonPlaying(btn, false);
        } else {
          updateBtnIcon(btn, false);
        }
        return;
      }

      setSpeakerButtonPlaying(btn, true);

      const onStop = () => {
        updateBtnIcon(btn, false);
        btn.disabled = false;
      };

      try {
        const success = await audioManager.playAudio(level, unit, rootChar, text, type, index, onStop);
        if (!success) {
          showToast('暂无录音', 'info');
          onStop();
        }
      } catch (err) {
        showToast('播放失败: ' + err.message, 'error');
        onStop();
      }
    }
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#learnBatchPlayBtnMain');
    if (!btn) return;
    e.stopPropagation();
    toggleLearnBatchPlayback(btn);
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#batchRecordBtnMain');
    if (!btn) return;
    e.stopPropagation();
    enterBatchRecord();
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#batchPlayBtnMain');
    if (!btn) return;
    e.stopPropagation();
    enterBatchPlay();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.level-selector-wrapper')) {
      levelDropdown.classList.remove('show');
      currentLevelBtn.classList.remove('active');
    }
  });

  appEl.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-home-action]');
    if (!actionBtn) return;
    const action = actionBtn.dataset.homeAction;
    if (action === 'batch-play') {
      e.stopPropagation();
      enterBatchPlay();
      return;
    }
    if (action === 'batch-record') {
      e.stopPropagation();
      enterBatchRecord();
    }
  });
}
