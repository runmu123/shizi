// 核心应用逻辑：初始化、级别加载、事件、导航
import { state, cacheSuffix } from './state.js';
import { TEACH_PASSWORD, USER_KEY } from './constants.js';
import { showToast } from './toast.js';
import { saveCurrentPosition } from './position.js';
import { renderUnit, renderSearchResult, escapeHtml } from './ui.js';
import { enterLearning, exitLearning, updateLearningViewBtn } from './learning.js';
import { enterBatchRecord } from './batch-record.js';
import { enterBatchPlay } from './batch-play.js';

// ===== 级别初始化 =====
export async function initLevels() {
  const dropdown = document.getElementById('levelDropdown');
  dropdown.innerHTML = '';
  state.LEVELS = [];

  let i = 0;
  while (true) {
    const level = `L${i}`;
    try {
      const res = await fetch(`yaml/contents_${level}.yaml${cacheSuffix}`, { method: 'GET' });
      if (res.ok) {
        const text = await res.text();
        try {
          if (window.jsyaml) {
            state.levelDataCache[level] = jsyaml.load(text);
          }
        } catch (yamlErr) {
          console.warn('解析 YAML 失败:', level, yamlErr);
        }

        state.LEVELS.push(level);
        const btn = document.createElement('button');
        btn.className = 'level-option';
        btn.dataset.level = level;
        btn.textContent = level;
        dropdown.appendChild(btn);
        i++;
      } else {
        if (i === 0) {
          i++;
          continue;
        }
        break;
      }
    } catch (e) {
      console.warn('检查级别失败:', level, e);
      break;
    }
    if (i > 20) break;
  }

  if (state.LEVELS.length === 0) {
    state.LEVELS = ['L1'];
    state.currentLevel = 'L1';
    dropdown.innerHTML = '<button class="level-option" data-level="L1">L1</button>';
  } else {
    if (!state.LEVELS.includes(state.currentLevel)) {
      state.currentLevel = state.LEVELS[0];
    }
  }

  const opts = dropdown.querySelectorAll('.level-option');
  opts.forEach(o => {
    o.classList.toggle('active', o.dataset.level === state.currentLevel);
  });
  document.getElementById('currentLevelBtn').textContent = state.currentLevel;
}

// ===== 级别加载 =====
export async function loadLevel(level, savedPos = null) {
  const appEl = document.getElementById('app');
  const unitSelect = document.getElementById('unitSelect');
  appEl.innerHTML = '<div class="loading">正在加载数据...</div>';

  try {
    let data = state.levelDataCache[level];
    if (!data) {
      const response = await fetch(`yaml/contents_${level}.yaml${cacheSuffix}`);
      if (!response.ok) {
        throw new Error(`HTTP 错误! 状态码: ${response.status}`);
      }
      const text = await response.text();
      data = jsyaml.load(text);
      if (!data) throw new Error('YAML 数据为空或无效');
      state.levelDataCache[level] = data;
    }

    state.currentData = data;
    state.unitKeys = Object.keys(data);

    // 尝试恢复保存的单元索引
    state.currentUnitIndex = 0;
    if (savedPos && savedPos.level === level) {
      if (savedPos.unitName) {
        const idxByName = state.unitKeys.indexOf(savedPos.unitName);
        if (idxByName !== -1) {
          state.currentUnitIndex = idxByName;
        }
      } else if (savedPos.unitIndex !== undefined && savedPos.unitIndex < state.unitKeys.length) {
        state.currentUnitIndex = savedPos.unitIndex;
      }
    }

    // 填充单元选择下拉框
    unitSelect.innerHTML = '';
    state.unitKeys.forEach((key, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = key;
      unitSelect.appendChild(option);
    });

    renderUnit();
  } catch (err) {
    console.error('加载数据失败:', err);
    appEl.innerHTML = `
      <div class="error-msg">
        <h3>加载失败</h3>
        <p>无法加载 ${escapeHtml(level)} 的数据文件。</p>
        <p>请确保文件 yaml/contents_${escapeHtml(level)}.yaml 存在。</p>
        <p>错误信息: ${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

// ===== 搜索 =====
async function searchChar(char) {
  const appEl = document.getElementById('app');
  const unitNavigator = document.querySelector('.unit-navigator');
  appEl.innerHTML = '<div class="loading">正在全库搜索...</div>';
  unitNavigator.style.visibility = 'hidden';

  let foundInfo = null;
  let foundLevel = '';
  let foundUnit = '';

  for (const level of state.LEVELS) {
    let data = state.levelDataCache[level];

    if (!data) {
      try {
        const response = await fetch(`yaml/contents_${level}.yaml${cacheSuffix}`);
        if (response.ok) {
          const text = await response.text();
          data = jsyaml.load(text);
          state.levelDataCache[level] = data;
        }
      } catch (e) {
        console.error(`获取 ${level} 数据出错:`, e);
      }
    }

    if (data) {
      for (const [unit, chars] of Object.entries(data)) {
        if (chars && chars[char]) {
          foundInfo = chars[char];
          foundLevel = level;
          foundUnit = unit;
          break;
        }
      }
    }

    if (foundInfo) break;
  }

  if (foundInfo) {
    renderSearchResult(char, foundInfo, foundLevel, foundUnit);
  } else {
    appEl.innerHTML = `
      <div class="modal-msg">
        <p>未在任何等级找到汉字「${escapeHtml(char)}」</p>
      </div>
    `;
  }
}

// ===== 模式切换 =====
export function switchTeachingMode(enable) {
  state.isTeachingMode = enable;

  const currentModeBtn = document.getElementById('currentModeBtn');
  const modeOptions = document.querySelectorAll('.mode-option');
  const unitNavigator = document.querySelector('.unit-navigator');
  const searchInput = document.getElementById('searchInput');
  const batchPlayBtn = document.getElementById('batchPlayBtnMain');
  const batchRecordBtn = document.getElementById('batchRecordBtnMain');

  currentModeBtn.textContent = state.isTeachingMode ? '教学模式' : '学习模式';
  const activeMode = state.isTeachingMode ? 'teach' : 'learn';
  modeOptions.forEach(o => o.classList.toggle('active', o.dataset.mode === activeMode));

  // 控制批量按钮的显示/隐藏
  if (batchPlayBtn) {
    batchPlayBtn.style.display = state.isTeachingMode ? 'block' : 'none';
  }
  if (batchRecordBtn) {
    batchRecordBtn.style.display = state.isTeachingMode ? 'block' : 'none';
  }

  // 重新渲染
  renderUnit();

  // 更新学习视图按钮
  if (document.getElementById('learningView').classList.contains('active')) {
    updateLearningViewBtn();
  }

  // 保存当前位置和模式
  saveCurrentPosition();
}

// ===== 导航到指定单元 =====
export async function navigateToUnit(level, unitName) {
  document.getElementById('progressModal').classList.remove('active');

  if (document.getElementById('learningView').classList.contains('active')) {
    exitLearning();
  }

  if (state.currentLevel !== level) {
    state.currentLevel = level;
    document.getElementById('currentLevelBtn').textContent = level;
    document.querySelectorAll('.level-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.level === level);
    });

    await loadLevel(level);
  }

  const index = state.unitKeys.indexOf(unitName);
  if (index !== -1) {
    state.currentUnitIndex = index;
    renderUnit();
    saveCurrentPosition();
    showToast(`已跳转到 ${level} ${unitName}`, 'success');
  } else {
    showToast(`未找到单元: ${unitName}`, 'error');
  }
}

// ===== 按钮图标更新（录音/播放模式切换后） =====
function updateBtnIcon(btn, isTeaching) {
  const isSmall = btn.dataset.isSmall === 'true';
  const style = isSmall ? ' style="width: 16px; height: 16px;"' : '';
  const iconId = isTeaching ? '#icon-mic' : '#icon-play';

  btn.innerHTML = `<svg${style}><use href="${iconId}"></use></svg>`;
  btn.title = isTeaching ? '录音' : '播放';
}

// 播放刚录制完成的本地音频，便于老师即时检查
function playRecordedBlob(blob) {
  return new Promise((resolve, reject) => {
    if (!blob || blob.size === 0) {
      resolve(false);
      return;
    }

    const previewUrl = URL.createObjectURL(blob);
    const previewAudio = new Audio(previewUrl);

    const cleanup = () => URL.revokeObjectURL(previewUrl);

    previewAudio.onended = () => {
      cleanup();
      resolve(true);
    };
    previewAudio.onerror = (err) => {
      cleanup();
      reject(err);
    };
    previewAudio.play().catch((err) => {
      cleanup();
      reject(err);
    });
  });
}

// ===== 事件绑定 =====
export function setupEventListeners() {
  let scrollPosition = 0;

  function lockScroll() {
    scrollPosition = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollPosition}px`;
    document.body.style.width = '100%';
  }

  function unlockScroll() {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollPosition);
  }

  const currentModeBtn = document.getElementById('currentModeBtn');
  const modeDropdown = document.getElementById('modeDropdown');
  const modeOptions = document.querySelectorAll('.mode-option');
  const currentLevelBtn = document.getElementById('currentLevelBtn');
  const levelDropdown = document.getElementById('levelDropdown');
  const searchInput = document.getElementById('searchInput');
  const unitNavigator = document.querySelector('.unit-navigator');
  const prevBtn = document.getElementById('prevUnit');
  const nextBtn = document.getElementById('nextUnit');
  const unitSelect = document.getElementById('unitSelect');
  const appEl = document.getElementById('app');

  // 密码弹窗元素
  const passwordModal = document.getElementById('passwordModal');
  const passwordInput = document.getElementById('passwordInput');
  const passwordError = document.getElementById('passwordError');

  // ===== 模式下拉菜单 =====
  currentModeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    modeDropdown.classList.toggle('show');
    currentModeBtn.classList.toggle('active');
    levelDropdown.classList.remove('show');
    currentLevelBtn.classList.remove('active');
  });

  modeOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      const mode = opt.dataset.mode;
      const newModeIsTeaching = (mode === 'teach');

      if (state.isTeachingMode !== newModeIsTeaching) {
        if (newModeIsTeaching) {
          modeDropdown.classList.remove('show');
          currentModeBtn.classList.remove('active');
          const currentUser = localStorage.getItem(USER_KEY);
          if (currentUser === 'admin') {
            switchTeachingMode(true);
          } else {
            passwordModal.classList.add('active');
            lockScroll();
            passwordInput.value = '';
            passwordError.style.display = 'none';
            passwordInput.focus();
          }
        } else {
          switchTeachingMode(false);
          modeDropdown.classList.remove('show');
          currentModeBtn.classList.remove('active');
        }
      } else {
        modeDropdown.classList.remove('show');
        currentModeBtn.classList.remove('active');
      }
    });
  });

  // ===== 密码弹窗 =====
  const handlePasswordSubmit = () => {
    const password = passwordInput.value.trim();
    if (password === TEACH_PASSWORD) {
      switchTeachingMode(true);
      passwordModal.classList.remove('active');
      unlockScroll();
    } else {
      passwordError.style.display = 'block';
      passwordInput.value = '';
      passwordInput.focus();
    }
  };

  document.getElementById('confirmPassword').addEventListener('click', handlePasswordSubmit);

  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handlePasswordSubmit();
  });

  document.getElementById('cancelPassword').addEventListener('click', () => {
    passwordModal.classList.remove('active');
    unlockScroll();
  });

  passwordModal.addEventListener('click', (e) => {
    if (e.target === passwordModal) {
      passwordModal.classList.remove('active');
      unlockScroll();
    }
  });

  // ===== 级别选择 =====
  currentLevelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    levelDropdown.classList.toggle('show');
    currentLevelBtn.classList.toggle('active');
    modeDropdown.classList.remove('show');
    currentModeBtn.classList.remove('active');
  });

  levelDropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('.level-option');
    if (!opt) return;

    const level = opt.dataset.level;
    if (level !== state.currentLevel) {
      currentLevelBtn.textContent = level;
      const options = levelDropdown.querySelectorAll('.level-option');
      options.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      levelDropdown.classList.remove('show');
      currentLevelBtn.classList.remove('active');

      state.currentLevel = level;
      loadLevel(level);
      saveCurrentPosition();
    } else {
      levelDropdown.classList.remove('show');
      currentLevelBtn.classList.remove('active');
    }
  });

  // ===== 搜索 =====
  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val && val.length === 1) {
      searchChar(val);
    } else if (val.length === 0) {
      unitNavigator.style.visibility = 'visible';
      renderUnit();
    }
  });

  // ===== 导航按钮 =====
  const goPrevUnit = () => {
    if (state.currentUnitIndex > 0) {
      state.currentUnitIndex--;
      renderUnit();
      saveCurrentPosition();
    }
  };

  const goNextUnit = () => {
    if (state.currentUnitIndex < state.unitKeys.length - 1) {
      state.currentUnitIndex++;
      renderUnit();
      saveCurrentPosition();
    }
  };

  prevBtn.addEventListener('click', goPrevUnit);
  nextBtn.addEventListener('click', goNextUnit);

  unitSelect.addEventListener('change', (e) => {
    const idx = parseInt(e.target.value, 10);
    if (!isNaN(idx) && idx >= 0 && idx < state.unitKeys.length) {
      state.currentUnitIndex = idx;
      renderUnit();
      saveCurrentPosition();
    }
  });

  // ===== 主页面键盘导航 =====
  document.addEventListener('keydown', (e) => {
    // 仅在主页面可见时生效，避免与学习/批量页面冲突
    if (document.getElementById('learningView').classList.contains('active')) return;
    if (document.getElementById('batchRecordView').classList.contains('active')) return;
    if (document.getElementById('batchPlayView').classList.contains('active')) return;
    if (document.getElementById('passwordModal').classList.contains('active')) return;

    // 输入场景不拦截按键
    if (
      e.target.tagName === 'INPUT' ||
      e.target.tagName === 'TEXTAREA' ||
      e.target.tagName === 'SELECT' ||
      e.target.isContentEditable
    ) {
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goPrevUnit();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goNextUnit();
    }
  });

  // ===== 点击汉字进入学习模式 =====
  appEl.addEventListener('click', (e) => {
    const charBox = e.target.closest('.char-box');
    if (charBox) {
      const charText = charBox.querySelector('.char-text');
      const char = charText ? charText.textContent.trim() : '';
      if (char) {
        const container = charBox.closest('.char-header-container');
        const playBtn = container ? container.querySelector('.play-btn') : null;
        let level = state.currentLevel;
        let unit = state.unitKeys ? state.unitKeys[state.currentUnitIndex] : '';

        if (playBtn && playBtn.dataset.level) {
          level = playBtn.dataset.level;
          unit = playBtn.dataset.unit;
        }
        enterLearning(char, level, unit);
      }
    }
  });

  // ===== 全局音频播放/录音处理 =====
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.play-btn');
    if (!btn) return;

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
      // 录音逻辑
      if (audioManager.isRecording) {
        btn.classList.add('recording-processing');
        btn.disabled = true;
        btn.innerHTML = '...';
        showToast('正在上传...', 'info');

        try {
          const blob = await audioManager.stopRecording();
          if (blob) {
            // 并行执行：本地回放 + 上传
            playRecordedBlob(blob).catch(err => {
              showToast('录音预览播放失败: ' + err.message, 'error');
            });
            await audioManager.uploadAudio(blob, level, unit, rootChar, text, type, index);
            showToast('上传成功！', 'success');
          } else {
            showToast('录音失败：未获取到音频数据', 'error');
          }
        } catch (err) {
          console.error(err);
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
      // 播放逻辑
      if (state.isLoopingAudio) {
        state.isLoopingAudio = false;
        audioManager.stopCurrentAudio();
        return;
      }

      if (btn.classList.contains('playing')) {
        audioManager.stopCurrentAudio();
        return;
      }

      btn.classList.add('playing');

      const onStop = () => {
        btn.classList.remove('playing');
        btn.disabled = false;
      };

      try {
        const success = await audioManager.playAudio(level, unit, rootChar, text, type, index, onStop);
        if (!success) {
          showToast('暂无录音', 'info');
          onStop();
        }
      } catch (err) {
        console.error(err);
        showToast('播放失败: ' + err.message, 'error');
        onStop();
      }
    }
  });

  // ===== 批量录音按钮事件 =====
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#batchRecordBtnMain');
    if (btn) {
      e.stopPropagation();
      enterBatchRecord();
    }
  });

  // ===== 批量播放按钮事件 =====
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#batchPlayBtnMain');
    if (btn) {
      e.stopPropagation();
      enterBatchPlay();
    }
  });

  // ===== 点击外部关闭下拉菜单 =====
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.level-selector-wrapper')) {
      levelDropdown.classList.remove('show');
      modeDropdown.classList.remove('show');
      currentLevelBtn.classList.remove('active');
      currentModeBtn.classList.remove('active');
    }
  });
}
