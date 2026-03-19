// 批量播放功能模块
import { state } from '../app/state.js';
import { showToast } from '../utils/toast.js';
import {
  bindBatchKeyboard,
  buildBatchItemsFromUnit,
  enterBatchMode,
  exitBatchMode,
  loadBatchUnitView,
  renderBatchListPanel,
  selectBatchIndex,
  switchBatchUnit,
  updateBatchCurrentInfo,
  updateBatchProgress,
} from './batch-shared.js';

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
  const unitData = state.currentData[state.unitKeys[state.currentUnitIndex]];
  return buildBatchItemsFromUnit(unitData, {
    buildCharItem: (rootChar, _charData, listIndex) => ({
      index: listIndex,
      rootChar,
      text: rootChar,
      type: 'char',
      typeLabel: '字',
    }),
    buildWordItem: (rootChar, word, wordIndex, listIndex) => ({
      index: listIndex,
      rootChar,
      text: word,
      type: 'word',
      typeLabel: '词',
      wordIndex,
    }),
    buildSentenceItem: (rootChar, sentence, listIndex) => ({
      index: listIndex,
      rootChar,
      text: sentence,
      type: 'sentence',
      typeLabel: '句',
    }),
  });
}

// 渲染左侧列表
function renderLeftPanel() {
  renderBatchListPanel({
    panelId: 'batchPlayLeft',
    items: batchState.items,
    currentIndex: batchState.currentIndex,
    completedSet: batchState.completed,
    getGroupKey: (item) => item.rootChar,
    formatGroupTitle: (groupKey) => groupKey,
    getPendingStatusText: () => '待播放',
    onSelect: (index) => selectItem(index),
    itemTextClass: 'item-text',
  });
  updateProgress();
}

// 更新进度显示
function updateProgress() {
  updateBatchProgress({
    progressId: 'batchPlayProgress',
    totalId: 'batchPlayTotal',
    completedCount: batchState.completed.size,
    totalCount: batchState.items.length,
  });
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
  selectBatchIndex({
    index,
    itemsLength: batchState.items.length,
    onSelected: (selectedIndex) => {
      batchState.currentIndex = selectedIndex;
      renderLeftPanel();
      updateCurrentInfo();
    },
  });
}

// 更新当前内容信息
function updateCurrentInfo() {
  updateBatchCurrentInfo({
    items: batchState.items,
    currentIndex: batchState.currentIndex,
    textId: 'batchPlayCurrentText',
    typeId: 'batchPlayCurrentType',
  });
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
  await switchBatchUnit({
    delta: -1,
    onMoved: loadBatchUnit,
    onBoundary: () => showToast('已经是第一个单元', 'info'),
  });
}

// 下一单元
async function nextUnit() {
  await switchBatchUnit({
    delta: 1,
    onMoved: loadBatchUnit,
    onBoundary: () => showToast('已经是最后一个单元', 'info'),
  });
}

// 加载当前单元的批量播放数据
function loadBatchUnit() {
  loadBatchUnitView({
    batchState,
    getItems: getBatchItems,
    resetState: () => {
      batchState.completed.clear();
      batchState.isPlaying = false;
      batchState.isQueuePlaying = false;
      batchState.queueIndex = 0;
    },
    renderLeftPanel,
    updateCurrentInfo,
    updateControls: () => {
      updatePlayButton();
      updateQueuePlayButton();
    },
    unitTitleId: 'batchPlayUnitTitle',
    leftPanelId: 'batchPlayLeft',
  });
}

// 进入批量播放模式
export function enterBatchPlay() {
  enterBatchMode({
    viewId: 'batchPlayView',
    loadBatchUnit,
  });
}

// 退出批量播放模式
export async function exitBatchPlay() {
  await exitBatchMode({
    viewId: 'batchPlayView',
    beforeHide: async () => {
      if (batchState.isPlaying) {
        audioManager.stopCurrentAudio().catch(err => showToast('停止播放失败: ' + (err?.message || err), 'error'));
        batchState.isPlaying = false;
      }
      if (batchState.isQueuePlaying) {
        batchState.isQueuePlaying = false;
      }
    },
  });
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
  bindBatchKeyboard({
    viewId: 'batchPlayView',
    handlers: {
      ' ': playCurrent,
      Enter: startQueuePlay,
      ArrowUp: prevItem,
      ArrowDown: nextItem,
      ArrowLeft: prevUnit,
      ArrowRight: nextUnit,
      Escape: exitBatchPlay,
    },
  });
}

