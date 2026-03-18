// 批量录音功能模块
import { state } from './state.js';
import { showToast } from './toast.js';
import {
  bindBatchKeyboard,
  buildBatchItemsFromUnit,
  hideBatchView,
  moveBatchUnit,
  renderBatchListPanel,
  selectBatchIndex,
  showBatchView,
  updateBatchCurrentInfo,
  updateBatchProgress,
} from './batch-shared.js';

// 批量录音状态
const batchState = {
  items: [],           // 当前单元的所有录音项
  currentIndex: 0,     // 当前选中的索引
  completed: new Set(), // 已完成录音的索引集合
  audioCache: {},      // 本地音频缓存 {index: Blob}
  isRecording: false,  // 是否正在录音
};

// 获取当前单元的录音项列表（按字分组）
function getBatchItems() {
  const unitData = state.currentData[state.unitKeys[state.currentUnitIndex]];
  return buildBatchItemsFromUnit(unitData, {
    buildCharItem: (rootChar) => ({
      char: rootChar,
      text: rootChar,
      type: 'char',
      typeLabel: '字',
      rootChar,
      index: null,
      groupChar: rootChar,
    }),
    buildWordItem: (rootChar, word, wordIndex) => ({
      char: rootChar,
      text: word,
      type: 'word',
      typeLabel: '词',
      rootChar,
      index: wordIndex,
      groupChar: rootChar,
    }),
    buildSentenceItem: (rootChar, sentence) => ({
      char: rootChar,
      text: sentence,
      type: 'sentence',
      typeLabel: '句',
      rootChar,
      index: null,
      groupChar: rootChar,
    }),
  });
}

// 渲染左侧列表（按字分组）
function renderLeftPanel() {
  renderBatchListPanel({
    panelId: 'batchRecordLeft',
    items: batchState.items,
    currentIndex: batchState.currentIndex,
    completedSet: batchState.completed,
    getGroupKey: (item) => item.groupChar,
    formatGroupTitle: (groupKey) => `「${groupKey}」`,
    getPendingStatusText: () => '待录音',
    onSelect: (index) => selectItem(index),
    itemTextClass: 'batch-record-item-text',
  });
  updateProgress();
}

// 选择指定索引的项
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

// 更新当前内容显示
function updateCurrentInfo() {
  updateBatchCurrentInfo({
    items: batchState.items,
    currentIndex: batchState.currentIndex,
    textId: 'batchRecordCurrentText',
    typeId: 'batchRecordCurrentType',
  });
}

// 更新进度显示
function updateProgress() {
  updateBatchProgress({
    progressId: 'batchRecordProgress',
    totalId: 'batchRecordTotal',
    completedCount: batchState.completed.size,
    totalCount: batchState.items.length,
  });
}

// 更新录音按钮状态
function updateRecordButton() {
  const btn = document.getElementById('batchRecordBtn');
  if (!btn) return;

  if (batchState.isRecording) {
    btn.classList.add('recording');
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <rect x="6" y="6" width="12" height="12" />
      </svg>
      停止录音
    `;
  } else {
    btn.classList.remove('recording');
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
      录音
    `;
  }
}

// 开始录音
async function startRecording() {
  if (batchState.isRecording) return;

  try {
    await audioManager.startRecording();
    batchState.isRecording = true;
    updateRecordButton();
    showToast('开始录音', 'info');
  } catch (err) {
    showToast('无法启动录音: ' + err.message, 'error');
  }
}

// 停止录音
async function stopRecording() {
  if (!batchState.isRecording) return;

  try {
    const blob = await audioManager.stopRecording();
    batchState.isRecording = false;
    updateRecordButton();

    if (blob) {
      // 缓存到本地（覆盖旧的）
      playRecordedBlob(blob).catch(err => {
        showToast('录音预览播放失败: ' + err.message, 'error');
      });
      batchState.audioCache[batchState.currentIndex] = blob;
      // 标记为已完成
      batchState.completed.add(batchState.currentIndex);
      renderLeftPanel();
      showToast('录音完成', 'success');
    } else {
      showToast('录音失败：未获取到音频数据', 'error');
    }
  } catch (err) {
    batchState.isRecording = false;
    updateRecordButton();
    showToast('录音失败: ' + err.message, 'error');
  }
}

// 切换录音状态
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

function toggleRecording() {
  if (batchState.isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

// 上传当前录音
async function uploadCurrent() {
  if (!batchState.completed.has(batchState.currentIndex)) {
    showToast('请先完成录音', 'error');
    return;
  }

  const blob = batchState.audioCache[batchState.currentIndex];
  if (!blob) {
    showToast('没有可上传的录音', 'error');
    return;
  }

  const item = batchState.items[batchState.currentIndex];
  const level = state.currentLevel;
  const unit = state.unitKeys[state.currentUnitIndex];

  try {
    await audioManager.uploadAudio(
      blob,
      level,
      unit,
      item.rootChar,
      item.text,
      item.type,
      item.index
    );
    showToast('上传成功！', 'success');
  } catch (err) {
    showToast('上传失败: ' + err.message, 'error');
  }
}

// 上一个
function prevItem() {
  if (batchState.currentIndex > 0) {
    selectItem(batchState.currentIndex - 1);
  }
}

// 下一个
function nextItem() {
  if (batchState.currentIndex < batchState.items.length - 1) {
    selectItem(batchState.currentIndex + 1);
  }
}

// 显示上传中弹窗
function showUploadingModal(current, total) {
  const modal = document.getElementById('uploadingModal');
  const text = document.getElementById('uploadingText');
  if (modal && text) {
    text.textContent = `正在上传 ${current}/${total}`;
    modal.classList.add('active');
  }
}

// 隐藏上传中弹窗
function hideUploadingModal() {
  const modal = document.getElementById('uploadingModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// 上传所有缓存的录音
async function uploadCachedAudio() {
  const cacheKeys = Object.keys(batchState.audioCache);
  if (cacheKeys.length === 0) {
    return { success: true, uploaded: 0, failed: 0 };
  }

  const level = state.currentLevel;
  const unit = state.unitKeys[state.currentUnitIndex];
  let uploadedCount = 0;
  let failedCount = 0;

  showUploadingModal(0, cacheKeys.length);

  // 按 rootChar 分组
  const groups = {};
  for (const key of cacheKeys) {
    const index = parseInt(key);
    const blob = batchState.audioCache[index];
    if (!blob) continue;

    const item = batchState.items[index];
    const rootChar = item.rootChar;

    if (!groups[rootChar]) {
      groups[rootChar] = [];
    }
    groups[rootChar].push({ index, blob, item });
  }

  // 并行处理每个分组
  const groupPromises = Object.values(groups).map(async (groupItems) => {
    // 组内串行处理
    // 为了保证字、词、句的顺序，可以先按 index 排序（可选，但通常 item.index 是线性的）
    groupItems.sort((a, b) => a.index - b.index);

    for (const { item, blob } of groupItems) {
      try {
        await audioManager.uploadAudio(
          blob,
          level,
          unit,
          item.rootChar,
          item.text,
          item.type,
          item.index
        );
        uploadedCount++;
        showUploadingModal(uploadedCount, cacheKeys.length);
      } catch (err) {
        showToast('上传失败: ' + (err?.message || err), 'error');
        failedCount++;
      }
    }
  });

  await Promise.all(groupPromises);

  hideUploadingModal();

  if (failedCount === 0) {
    showToast(`成功上传 ${uploadedCount} 个录音`, 'success');
    // 清空缓存
    batchState.audioCache = {};
  } else {
    showToast(`上传完成：成功 ${uploadedCount} 个，失败 ${failedCount} 个`, 'info');
  }

  return { success: failedCount === 0, uploaded: uploadedCount, failed: failedCount };
}

// 批量上传所有已完成的录音
async function uploadAll() {
  const cacheKeys = Object.keys(batchState.audioCache);
  if (cacheKeys.length === 0) {
    showToast('没有已完成的录音', 'error');
    return;
  }

  const result = await uploadCachedAudio();
  return result;
}

// 上一单元
async function prevUnit() {
  // 检查是否有缓存的录音
  const cacheKeys = Object.keys(batchState.audioCache);
  if (cacheKeys.length > 0) {
    const result = await uploadCachedAudio();
    if (!result.success) {
      // 如果有失败，询问用户是否继续切换
      const confirmSwitch = confirm(`部分录音上传失败，是否继续切换单元？\n成功：${result.uploaded}，失败：${result.failed}`);
      if (!confirmSwitch) return;
    }
  }

  moveBatchUnit(-1, loadBatchUnit, () => showToast('已经是第一个单元', 'info'));
}

// 下一单元
async function nextUnit() {
  // 检查是否有缓存的录音
  const cacheKeys = Object.keys(batchState.audioCache);
  if (cacheKeys.length > 0) {
    const result = await uploadCachedAudio();
    if (!result.success) {
      // 如果有失败，询问用户是否继续切换
      const confirmSwitch = confirm(`部分录音上传失败，是否继续切换单元？\n成功：${result.uploaded}，失败：${result.failed}`);
      if (!confirmSwitch) return;
    }
  }

  moveBatchUnit(1, loadBatchUnit, () => showToast('已经是最后一个单元', 'info'));
}

// 加载当前单元的批量录音数据
function loadBatchUnit() {
  batchState.items = getBatchItems();
  batchState.currentIndex = 0;
  batchState.completed.clear();
  batchState.audioCache = {};
  batchState.isRecording = false;

  renderLeftPanel();
  updateCurrentInfo();
  updateRecordButton();

  // 更新单元标题
  const unitTitle = document.getElementById('batchRecordUnitTitle');
  if (unitTitle) {
    const unitName = state.unitKeys[state.currentUnitIndex];
    unitTitle.textContent = `(${unitName})`;
  }

  // 滚动到顶部
  const leftPanel = document.getElementById('batchRecordLeft');
  if (leftPanel) {
    leftPanel.scrollTop = 0;
  }
}

// 进入批量录音模式
export function enterBatchRecord() {
  if (!showBatchView('batchRecordView')) return;
  loadBatchUnit();
}

// 退出批量录音模式
export function exitBatchRecord() {
  // 如果正在录音，先停止
  if (batchState.isRecording) {
    audioManager.stopRecording().catch(err => showToast('停止录音失败: ' + (err?.message || err), 'error'));
    batchState.isRecording = false;
  }
  hideBatchView('batchRecordView');
}

// 设置批量录音事件监听
export function setupBatchRecordEvents() {
  // 关闭按钮
  document.getElementById('batchRecordClose').addEventListener('click', exitBatchRecord);

  // 录音按钮
  document.getElementById('batchRecordBtn').addEventListener('click', toggleRecording);

  // 上传按钮
  document.getElementById('batchRecordUploadBtn').addEventListener('click', uploadAll);

  // 导航按钮
  document.getElementById('batchRecordPrevBtn').addEventListener('click', prevItem);
  document.getElementById('batchRecordNextBtn').addEventListener('click', nextItem);
  document.getElementById('batchRecordPrevUnitBtn').addEventListener('click', prevUnit);
  document.getElementById('batchRecordNextUnitBtn').addEventListener('click', nextUnit);

  // 键盘快捷键
  bindBatchKeyboard({
    viewId: 'batchRecordView',
    handlers: {
      ' ': toggleRecording,
      Enter: uploadAll,
      ArrowUp: prevItem,
      ArrowDown: nextItem,
      ArrowLeft: prevUnit,
      ArrowRight: nextUnit,
      Escape: exitBatchRecord,
    },
  });
}
