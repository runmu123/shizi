// 批量播放功能模块
import { state } from './state.js';
import { showToast } from './toast.js';
import { escapeHtml, renderUnit } from './ui.js';

// 批量播放状态
const batchState = {
  items: [],           // 当前单元的所有播放项
  currentIndex: 0,     // 当前选中的索引
  completed: new Set(), // 已完成播放的索引集合
  isPlaying: false,    // 是否正在播放
  isQueuePlaying: false, // 是否正在队列播放
  queueIndex: 0,       // 队列播放当前索引
  currentAudio: null,  // 当前播放的音频对象
};

// 获取当前单元的所有字、词、句项
function getBatchItems() {
  const items = [];
  const unitData = state.currentData[state.unitKeys[state.currentUnitIndex]];

  for (const [rootChar, charData] of Object.entries(unitData)) {
    // 汉字
    items.push({
      index: items.length,
      rootChar: rootChar,
      text: rootChar,
      type: 'char',
      typeLabel: '字',
    });

    // 词组
    if (charData.词 && Array.isArray(charData.词)) {
      charData.词.forEach((word, wordIndex) => {
        items.push({
          index: items.length,
          rootChar: rootChar,
          text: word,
          type: 'word',
          typeLabel: `词`,
          wordIndex: wordIndex, // 保存词语在词组中的原始索引
        });
      });
    }

    // 例句
    if (charData.句) {
      items.push({
        index: items.length,
        rootChar: rootChar,
        text: charData.句,
        type: 'sentence',
        typeLabel: '句',
      });
    }
  }

  return items;
}

// 渲染左侧列表
function renderLeftPanel() {
  const leftPanel = document.getElementById('batchPlayLeft');
  if (!leftPanel) return;

  leftPanel.innerHTML = '';

  // 按 rootChar 分组
  const groups = {};
  batchState.items.forEach(item => {
    if (!groups[item.rootChar]) {
      groups[item.rootChar] = [];
    }
    groups[item.rootChar].push(item);
  });

  // 渲染每个分组
  Object.entries(groups).forEach(([rootChar, groupItems]) => {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'batch-record-section';

    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'batch-record-section-title';
    sectionTitle.textContent = rootChar;
    sectionDiv.appendChild(sectionTitle);

    // 渲染组内每个项目
    groupItems.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'batch-record-item';
      itemDiv.dataset.index = item.index;
      if (item.index === batchState.currentIndex) {
        itemDiv.classList.add('active');
      }

      const textSpan = document.createElement('span');
      textSpan.className = 'item-text';
      textSpan.textContent = item.text;
      itemDiv.appendChild(textSpan);

      // 创建状态容器
      const statusContainer = document.createElement('div');
      statusContainer.style.display = 'flex';
      statusContainer.style.alignItems = 'center';

      const typeSpan = document.createElement('span');
      typeSpan.className = 'item-type';
      typeSpan.textContent = item.typeLabel;
      statusContainer.appendChild(typeSpan);

      const statusSpan = document.createElement('span');
      statusSpan.className = 'item-status';
      if (batchState.completed.has(item.index)) {
        statusSpan.textContent = '✓ 已完成';
        statusSpan.classList.add('completed');
      } else {
        statusSpan.textContent = '待播放';
      }
      statusContainer.appendChild(statusSpan);

      itemDiv.appendChild(statusContainer);

      itemDiv.addEventListener('click', () => {
        selectItem(item.index);
      });

      sectionDiv.appendChild(itemDiv);
    });

    leftPanel.appendChild(sectionDiv);
  });

  updateProgress();
}

// 更新进度显示
function updateProgress() {
  const progressEl = document.getElementById('batchPlayProgress');
  const totalEl = document.getElementById('batchPlayTotal');

  progressEl.textContent = batchState.completed.size;
  totalEl.textContent = batchState.items.length;
}

// 更新播放按钮状态
function updatePlayButton() {
  const btn = document.getElementById('batchPlayBtn');
  if (!btn) return;

  if (batchState.isPlaying) {
    btn.classList.add('playing');
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <rect x="6" y="4" width="4" height="16" />
        <rect x="14" y="4" width="4" height="16" />
      </svg>
      暂停
    `;
  } else {
    btn.classList.remove('playing');
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      单个播放
    `;
  }
}

// 更新队列播放按钮状态
function updateQueuePlayButton() {
  const btn = document.getElementById('batchPlayQueueBtn');
  if (!btn) return;

  if (batchState.isQueuePlaying) {
    btn.classList.add('playing');
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <rect x="6" y="4" width="4" height="16" />
        <rect x="14" y="4" width="4" height="16" />
      </svg>
      暂停
    `;
  } else {
    btn.classList.remove('playing');
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
      </svg>
      按顺序播放
    `;
  }
}

// 选择项目
function selectItem(index) {
  if (index < 0 || index >= batchState.items.length) return;

  batchState.currentIndex = index;
  renderLeftPanel();
  updateCurrentInfo();

  // 滚动到可视区域中间
  setTimeout(() => {
    const itemElement = document.querySelector(`.batch-record-item[data-index="${index}"]`);
    if (itemElement) {
      itemElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, 50);
}

// 更新当前内容信息
function updateCurrentInfo() {
  const currentTextEl = document.getElementById('batchPlayCurrentText');
  const currentTypeEl = document.getElementById('batchPlayCurrentType');

  if (batchState.items.length === 0) {
    currentTextEl.textContent = '-';
    currentTypeEl.textContent = '-';
    return;
  }

  const item = batchState.items[batchState.currentIndex];
  currentTextEl.textContent = item.text;
  currentTypeEl.textContent = item.typeLabel;
}

// 播放当前项目
async function playCurrent() {
  if (batchState.isPlaying) {
    stopCurrentAudio();
    return;
  }

  const item = batchState.items[batchState.currentIndex];
  const level = state.currentLevel;
  const unit = state.unitKeys[state.currentUnitIndex];

  try {
    batchState.isPlaying = true;
    updatePlayButton();

    const onStop = () => {
      batchState.isPlaying = false;
      updatePlayButton();
      batchState.completed.add(batchState.currentIndex);
      renderLeftPanel();
    };

    const success = await audioManager.playAudio(
      level,
      unit,
      item.rootChar,
      item.text,
      item.type,
      item.wordIndex !== undefined ? item.wordIndex : item.index,
      onStop
    );

    if (!success) {
      showToast('暂无录音', 'info');
      onStop();
    }
  } catch (err) {
    showToast('播放失败: ' + err.message, 'error');
    batchState.isPlaying = false;
    updatePlayButton();
  }
}

// 停止当前音频
function stopCurrentAudio() {
  if (batchState.isPlaying) {
    audioManager.stopCurrentAudio();
    batchState.isPlaying = false;
    updatePlayButton();
  }
}

// 上一个项目
function prevItem() {
  if (batchState.currentIndex > 0) {
    selectItem(batchState.currentIndex - 1);
  } else {
    showToast('已经是第一个项目', 'info');
  }
}

// 下一个项目
function nextItem() {
  if (batchState.currentIndex < batchState.items.length - 1) {
    selectItem(batchState.currentIndex + 1);
  } else {
    showToast('已经是最后一个项目', 'info');
  }
}

// 开始队列播放
async function startQueuePlay() {
  if (batchState.isQueuePlaying) {
    stopQueuePlay();
    return;
  }

  batchState.isQueuePlaying = true;
  batchState.queueIndex = batchState.currentIndex;
  updateQueuePlayButton();

  // 标记所有已完成的播放为未完成（重新开始队列播放）
  batchState.completed.clear();

  await playQueueItem();
}

// 播放队列中的下一个项目
async function playQueueItem() {
  if (!batchState.isQueuePlaying) return;

  // 检查是否已播放完所有项目
  if (batchState.queueIndex >= batchState.items.length) {
    batchState.isQueuePlaying = false;
    updateQueuePlayButton();
    showToast('队列播放完成！', 'success');
    return;
  }

  // 选择当前队列项目
  selectItem(batchState.queueIndex);

  // 播放当前项目
  const item = batchState.items[batchState.queueIndex];
  const level = state.currentLevel;
  const unit = state.unitKeys[state.currentUnitIndex];

  try {
    const onStop = () => {
      batchState.completed.add(batchState.queueIndex);
      batchState.queueIndex++;
      // 延迟100ms播放下一个
      setTimeout(playQueueItem, 100);
    };

    const success = await audioManager.playAudio(
      level,
      unit,
      item.rootChar,
      item.text,
      item.type,
      item.wordIndex !== undefined ? item.wordIndex : item.index,
      onStop
    );

    if (!success) {
      showToast(`项目 ${item.text} 暂无录音，跳过`, 'info');
      batchState.queueIndex++;
      setTimeout(playQueueItem, 100);
    }
  } catch (err) {
    showToast(`项目 ${item.text} 播放失败，跳过`, 'error');
    batchState.queueIndex++;
    setTimeout(playQueueItem, 100);
  }
}

// 停止队列播放
function stopQueuePlay() {
  batchState.isQueuePlaying = false;
  stopCurrentAudio();
  updateQueuePlayButton();
  showToast('队列播放已停止', 'info');
}

// 上一单元
async function prevUnit() {
  if (state.currentUnitIndex > 0) {
    state.currentUnitIndex--;
    loadBatchUnit();
  } else {
    showToast('已经是第一个单元', 'info');
  }
}

// 下一单元
async function nextUnit() {
  if (state.currentUnitIndex < state.unitKeys.length - 1) {
    state.currentUnitIndex++;
    loadBatchUnit();
  } else {
    showToast('已经是最后一个单元', 'info');
  }
}

// 加载当前单元的批量播放数据
function loadBatchUnit() {
  batchState.items = getBatchItems();
  batchState.currentIndex = 0;
  batchState.completed.clear();
  batchState.isPlaying = false;
  batchState.isQueuePlaying = false;
  batchState.queueIndex = 0;

  renderLeftPanel();
  updateCurrentInfo();
  updatePlayButton();
  updateQueuePlayButton();

  // 更新单元标题
  const unitTitle = document.getElementById('batchPlayUnitTitle');
  if (unitTitle) {
    const unitName = state.unitKeys[state.currentUnitIndex];
    unitTitle.textContent = `(${unitName})`;
  }

  // 滚动到顶部
  const leftPanel = document.getElementById('batchPlayLeft');
  if (leftPanel) {
    leftPanel.scrollTop = 0;
  }
}

// 进入批量播放模式
export function enterBatchPlay() {
  const batchView = document.getElementById('batchPlayView');
  const navbar = document.querySelector('.navbar');
  const toolbar = document.querySelector('.toolbar');
  const app = document.getElementById('app');

  if (!batchView) return;

  navbar.style.display = 'none';
  toolbar.style.display = 'none';
  app.style.display = 'none';
  batchView.classList.add('active');

  loadBatchUnit();
}

// 退出批量播放模式
export function exitBatchPlay() {
  const batchView = document.getElementById('batchPlayView');
  const navbar = document.querySelector('.navbar');
  const toolbar = document.querySelector('.toolbar');
  const app = document.getElementById('app');

  if (!batchView) return;

  // 如果正在播放，先停止
  if (batchState.isPlaying) {
    audioManager.stopCurrentAudio().catch(err => showToast('停止播放失败: ' + (err?.message || err), 'error'));
    batchState.isPlaying = false;
  }

  if (batchState.isQueuePlaying) {
    batchState.isQueuePlaying = false;
  }

  batchView.classList.remove('active');
  navbar.style.display = 'flex';
  toolbar.style.display = 'flex';
  app.style.display = 'flex';

  // 确保返回后显示的是当前单元
  renderUnit();
}

// 设置批量播放事件监听
export function setupBatchPlayEvents() {
  // 关闭按钮
  document.getElementById('batchPlayClose').addEventListener('click', exitBatchPlay);

  // 播放按钮
  document.getElementById('batchPlayBtn').addEventListener('click', playCurrent);

  // 队列播放按钮
  document.getElementById('batchPlayQueueBtn').addEventListener('click', startQueuePlay);

  // 导航按钮
  document.getElementById('batchPlayPrevBtn').addEventListener('click', prevItem);
  document.getElementById('batchPlayNextBtn').addEventListener('click', nextItem);
  document.getElementById('batchPlayPrevUnitBtn').addEventListener('click', prevUnit);
  document.getElementById('batchPlayNextUnitBtn').addEventListener('click', nextUnit);

  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    // 只有在批量播放视图激活时才响应
    if (!document.getElementById('batchPlayView').classList.contains('active')) {
      return;
    }

    // 避免在输入框中触发
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    switch (e.key) {
      case ' ':
        e.preventDefault();
        playCurrent();
        break;
      case 'Enter':
        e.preventDefault();
        startQueuePlay();
        break;
      case 'ArrowUp':
        e.preventDefault();
        prevItem();
        break;
      case 'ArrowDown':
        e.preventDefault();
        nextItem();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        prevUnit();
        break;
      case 'ArrowRight':
        e.preventDefault();
        nextUnit();
        break;
      case 'Escape':
        e.preventDefault();
        exitBatchPlay();
        break;
    }
  });
}

// 批量播放按钮点击事件
document.addEventListener('click', (e) => {
  const btn = e.target.closest('#batchPlayBtnMain');
  if (btn) {
    e.stopPropagation();
    enterBatchPlay();
  }
});
