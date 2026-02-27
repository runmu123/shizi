// 学习视图：笔顺演示、书写练习、音频循环
import { state } from './state.js';
import { showToast, showQuizToast } from './toast.js';
import { USER_KEY } from './constants.js';

const STROKE_ANIMATION_SPEED = 0.5;
const STROKE_DELAY = 500;
const AUDIO_LOOP_DELAY = 800;

let savedScrollPosition = 0;

export function updateLearningViewBtn() {
  const btn = document.getElementById('learnPlayBtn');
  if (!btn) return;

  if (state.isTeachingMode) {
    btn.title = '录音';
    btn.innerHTML = `<svg><use href="#icon-mic"></use></svg>`;
  } else {
    btn.title = '播放';
    btn.innerHTML = `<svg><use href="#icon-play"></use></svg>`;
  }
}

function startQuizLogic() {
  if (!state.writer) return;

  const quizResult = document.getElementById('quizResult');
  quizResult.style.display = 'none';

  state.writer.quiz({
    onMistake: () => {
      quizResult.style.display = 'none';
      showQuizToast('笔画错误，请重试。', 'error');
    },
    onCorrectStroke: (strokeData) => {
      quizResult.style.display = 'none';
      showQuizToast(`第 ${strokeData.strokeNum + 1} 笔正确`, 'success');
    },
    onComplete: async (summaryData) => {
      quizResult.style.display = 'none';
      showQuizToast(`练习完成！总共错误 ${summaryData.totalMistakes} 次。`, 'success');

      // 如果用户已登录则保存进度
      const user = localStorage.getItem(USER_KEY);
      if (user && audioManager.supabase) {
        const char = document.getElementById('learnChar').textContent;
        const playBtn = document.getElementById('learnPlayBtn');
        const level = playBtn ? playBtn.dataset.level : state.currentLevel;
        const unit = playBtn ? playBtn.dataset.unit : (state.unitKeys[state.currentUnitIndex] || '');

        try {
          const { error } = await audioManager.supabase.from('user_progress').insert({
            username: user,
            char: char,
            level: level,
            unit: unit,
            completed_at: new Date(),
          });
          if (error) {
            console.error('保存进度出错:', error);
            console.error('错误详情:', error.message, error.hint);
          } else {
            console.log('进度已保存:', char, level, unit);
          }
        } catch (e) {
          console.error('保存进度出错:', e);
        }
      }
    },
  });
}

function switchMode(mode) {
  state.currentMode = mode;

  const animateControls = document.getElementById('animateControls');
  const quizControls = document.getElementById('quizControls');
  const quizResult = document.getElementById('quizResult');
  const strokeInfo = document.getElementById('strokeInfo');

  document.querySelectorAll('.mode-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === mode);
  });

  if (mode === 'animate') {
    animateControls.style.display = 'flex';
    quizControls.style.display = 'none';
    if (state.writer) state.writer.showCharacter();
  } else {
    animateControls.style.display = 'none';
    quizControls.style.display = 'flex';
    if (state.writer) {
      state.writer.hideCharacter();
      startQuizLogic();
    }
  }

  quizResult.style.display = 'none';
  strokeInfo.textContent = '';
}

function initWriter(char) {
  const writerTarget = document.getElementById('writerTarget');
  const strokeInfo = document.getElementById('strokeInfo');
  const quizResult = document.getElementById('quizResult');

  writerTarget.innerHTML = '';
  strokeInfo.textContent = '';
  quizResult.style.display = 'none';
  state.currentStroke = 0;

  const size = Math.min(window.innerWidth - 60, 300);
  writerTarget.style.width = size + 'px';
  writerTarget.style.height = size + 'px';

  if (typeof HanziWriter === 'undefined') {
    writerTarget.innerHTML = '<div class="loading">HanziWriter 库加载失败</div>';
    return;
  }

  state.writer = HanziWriter.create('writerTarget', char, {
    width: size,
    height: size,
    padding: 20,
    showOutline: true,
    strokeAnimationSpeed: STROKE_ANIMATION_SPEED,
    delayBetweenStrokes: STROKE_DELAY,
    strokeColor: '#1c1917',
    outlineColor: '#d6d3d1',
    drawingColor: '#d97706',
    radicalColor: '#d97706',
    highlightColor: '#fca5a5',
    showCharacter: true,
    drawingWidth: 20,
    onLoadCharDataSuccess: (data) => {
      state.totalStrokes = data.strokes.length;
      strokeInfo.textContent = '共 ' + state.totalStrokes + ' 笔';
    },
  });

  switchMode('animate');
}

function animateStrokeByStroke() {
  if (!state.writer) return;

  if (state.currentStroke === 0) {
    state.writer.hideCharacter();
    state.writer.showOutline();
  }

  const strokeInfo = document.getElementById('strokeInfo');

  if (state.currentStroke < state.totalStrokes) {
    state.writer.animateStroke(state.currentStroke, {
      onComplete: () => {
        state.currentStroke++;
        strokeInfo.textContent = `第 ${state.currentStroke} / ${state.totalStrokes} 笔`;
      },
    });
  } else {
    state.currentStroke = 0;
    strokeInfo.textContent = `共 ${state.totalStrokes} 笔 — 演示完成`;
    state.writer.showCharacter();
  }
}

function startAudioLoop(char, level, unit) {
  state.isLoopingAudio = true;
  const btn = document.getElementById('learnPlayBtn');

  const playNext = async () => {
    if (!state.isLoopingAudio) return;

    btn.classList.add('playing');
    btn.disabled = false;

    const onStop = () => {
      if (state.isLoopingAudio) {
        setTimeout(playNext, AUDIO_LOOP_DELAY);
      } else {
        btn.classList.remove('playing');
        btn.disabled = false;
        updateLearningViewBtn();
      }
    };

    const text = btn.dataset.text || char;
    const type = btn.dataset.type || 'char';
    const index = btn.dataset.index || '';

    try {
      const success = await audioManager.playAudio(level, unit, char, text, type, index, onStop);
      if (!success) {
        state.isLoopingAudio = false;
        onStop();
      }
    } catch (e) {
      showToast('播放失败: ' + (e?.message || e), 'error');
      state.isLoopingAudio = false;
      onStop();
    }
  };

  playNext();
}

export function enterLearning(char, level, unit) {
  const appEl = document.getElementById('app');
  const learningView = document.getElementById('learningView');
  const learnCharEl = document.getElementById('learnChar');
  const learnPinyinEl = document.getElementById('learnPinyin');

  savedScrollPosition = window.scrollY;

  appEl.style.display = 'none';
  document.querySelector('.navbar').style.display = 'none';
  document.querySelector('.toolbar').style.display = 'none';
  document.body.style.paddingTop = '20px';
  learningView.classList.add('active');
  window.scrollTo(0, 0);

  updateLearningViewBtn();

  const learnPlayBtn = document.getElementById('learnPlayBtn');
  if (learnPlayBtn) {
    learnPlayBtn.dataset.text = char;
    learnPlayBtn.dataset.type = 'char';
    learnPlayBtn.dataset.rootChar = char;
    learnPlayBtn.dataset.level = level || state.currentLevel;
    learnPlayBtn.dataset.unit = unit || (state.unitKeys[state.currentUnitIndex] || '');
    learnPlayBtn.dataset.index = '';
  }

  learnCharEl.textContent = char;
  if (typeof pinyinPro !== 'undefined') {
    const { pinyin } = pinyinPro;
    learnPinyinEl.textContent = pinyin(char, { multiple: true });
  } else {
    learnPinyinEl.textContent = '';
  }

  initWriter(char);

  if (!state.isTeachingMode) {
    startAudioLoop(char, level, unit);
  }

  switchMode('quiz');
}

export function exitLearning() {
  const writerTarget = document.getElementById('writerTarget');

  state.isLoopingAudio = false;
  if (audioManager.currentAudio) {
    audioManager.currentAudio.pause();
    audioManager.currentAudio = null;
  }
  audioManager.onStopCallback = null;

  document.getElementById('learningView').classList.remove('active');
  document.getElementById('app').style.display = 'flex';
  document.querySelector('.navbar').style.display = 'flex';
  document.querySelector('.toolbar').style.display = 'flex';
  document.body.style.paddingTop = '120px';
  window.scrollTo(0, savedScrollPosition);

  if (state.writer) {
    writerTarget.innerHTML = '';
    state.writer = null;
  }
}

export function setupLearningEvents() {
  document.getElementById('backBtn').addEventListener('click', exitLearning);

  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => switchMode(tab.dataset.mode));
  });

  document.getElementById('playBtn').addEventListener('click', () => {
    if (state.writer) {
      state.currentStroke = 0;
      state.writer.animateCharacter({ strokeAnimationSpeed: STROKE_ANIMATION_SPEED, delayBetweenStrokes: STROKE_DELAY });
    }
  });

  document.getElementById('strokeBtn').addEventListener('click', animateStrokeByStroke);
  document.getElementById('startQuizBtn').addEventListener('click', startQuizLogic);

  document.getElementById('hintBtn').addEventListener('click', () => {
    if (state.writer) {
      state.writer.animateCharacter({ strokeAnimationSpeed: STROKE_ANIMATION_SPEED, delayBetweenStrokes: STROKE_DELAY });
    }
  });
}
