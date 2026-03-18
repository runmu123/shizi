export function createLearnBatchSupport({
  state,
  getPauseIconHtml,
  getPlayIconHtml,
  getCurrentUnitChars,
  renderUnit,
  showToast,
  audioManager,
}) {
  const playbackState = {
    running: false,
    paused: false,
    sequence: [],
    index: 0,
    token: 0,
    button: null,
  };

  function setLearnBatchBtnState(btn, isPlaying) {
    if (!btn) return;
    btn.classList.toggle('playing', isPlaying);
    btn.title = isPlaying ? '暂停整单元朗读' : '整单元朗读';
    btn.innerHTML = isPlaying ? getPauseIconHtml() : getPlayIconHtml();
  }

  function clearLearnBatchHighlight() {
    document.querySelectorAll('.unit-reading-active').forEach((el) => {
      el.classList.remove('unit-reading-active');
    });
  }

  async function syncLearnBatchCard(item) {
    if (state.appSection !== 'home' || state.mainViewMode !== 'study' || state.isTeachingMode) {
      return;
    }

    const chars = getCurrentUnitChars();
    const targetIndex = chars.indexOf(item.rootChar);
    if (targetIndex === -1 || targetIndex === state.homeCardIndex) return;

    state.homeCardMotion = targetIndex > state.homeCardIndex ? 'next' : 'prev';
    state.homeCardIndex = targetIndex;
    renderUnit();

    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
  }

  async function applyLearnBatchHighlight(item) {
    await syncLearnBatchCard(item);
    clearLearnBatchHighlight();
    if (!item) return;

    const cards = Array.from(document.querySelectorAll('#app .card'));
    const card = cards.find((candidate) => candidate.dataset.char === item.rootChar);
    if (!card) return;

    let target = null;
    if (item.type === 'char') {
      target = card.querySelector('.char-text');
    } else if (item.type === 'word') {
      const words = card.querySelectorAll('.word-item');
      target = words[item.index] || null;
    } else if (item.type === 'sentence') {
      target = card.querySelector('.text-content.sentence');
    }

    if (target) {
      target.classList.add('unit-reading-active');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function buildLearnBatchSequence() {
    const unitName = state.unitKeys?.[state.currentUnitIndex];
    const unitData = unitName ? state.currentData?.[unitName] : null;
    if (!unitData) return [];

    const queue = [];
    for (const [rootChar, info] of Object.entries(unitData)) {
      queue.push({
        rootChar,
        text: rootChar,
        type: 'char',
        index: null,
        level: state.currentLevel,
        unit: unitName,
      });

      const words = (info && Array.isArray(info.词)) ? info.词 : [];
      words.forEach((word, index) => {
        queue.push({
          rootChar,
          text: word,
          type: 'word',
          index,
          level: state.currentLevel,
          unit: unitName,
        });
      });

      const sentence = (info && typeof info.句 === 'string') ? info.句.trim() : '';
      if (sentence) {
        queue.push({
          rootChar,
          text: sentence,
          type: 'sentence',
          index: null,
          level: state.currentLevel,
          unit: unitName,
        });
      }
    }

    return queue;
  }

  function stopLearnBatchPlayback(resetQueue = true) {
    playbackState.token += 1;
    playbackState.running = false;
    playbackState.paused = false;
    audioManager.stopCurrentAudio();
    clearLearnBatchHighlight();

    if (playbackState.button) {
      setLearnBatchBtnState(playbackState.button, false);
    }

    if (resetQueue) {
      playbackState.sequence = [];
      playbackState.index = 0;
      playbackState.button = null;
    }
  }

  async function runLearnBatchPlaybackLoop(token) {
    while (
      token === playbackState.token &&
      playbackState.running &&
      !playbackState.paused &&
      playbackState.index < playbackState.sequence.length
    ) {
      const item = playbackState.sequence[playbackState.index];
      await applyLearnBatchHighlight(item);

      await new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };

        audioManager.playAudio(
          item.level,
          item.unit,
          item.rootChar,
          item.text,
          item.type,
          item.index,
          finish,
        ).then((success) => {
          if (!success) finish();
        }).catch(() => {
          finish();
        });
      });

      if (
        token !== playbackState.token ||
        !playbackState.running ||
        playbackState.paused
      ) {
        break;
      }

      playbackState.index += 1;
    }

    if (
      token === playbackState.token &&
      playbackState.running &&
      !playbackState.paused &&
      playbackState.index >= playbackState.sequence.length
    ) {
      showToast('单元朗读完成', 'success');
      stopLearnBatchPlayback(true);
    }
  }

  function toggleLearnBatchPlayback(btn) {
    if (state.isTeachingMode) return;

    if (playbackState.running) {
      playbackState.paused = true;
      playbackState.running = false;
      audioManager.stopCurrentAudio();
      setLearnBatchBtnState(btn, false);
      showToast('已暂停', 'info');
      return;
    }

    if (playbackState.paused && playbackState.sequence.length > 0) {
      playbackState.running = true;
      playbackState.paused = false;
      playbackState.button = btn;
      setLearnBatchBtnState(btn, true);
      runLearnBatchPlaybackLoop(playbackState.token);
      showToast('继续朗读', 'info');
      return;
    }

    const queue = buildLearnBatchSequence();
    if (queue.length === 0) {
      showToast('当前单元无可播放内容', 'error');
      return;
    }

    playbackState.sequence = queue;
    playbackState.index = 0;
    playbackState.token += 1;
    playbackState.running = true;
    playbackState.paused = false;
    playbackState.button = btn;
    setLearnBatchBtnState(btn, true);
    runLearnBatchPlaybackLoop(playbackState.token);
    showToast('开始整单元朗读', 'info');
  }

  return {
    stopLearnBatchPlayback,
    toggleLearnBatchPlayback,
  };
}
