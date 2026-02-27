// 批量录音功能模块
import { state } from './state.js';
import { showToast } from './toast.js';
import { showQuizToast } from './toast.js';
import { USER_KEY } from './constants.js';
import { escapeHtml, renderUnit } from './ui.js';

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
  const items = [];
  const unitData = state.currentData[state.unitKeys[state.currentUnitIndex]];

  if (!unitData) return items;

  for (const [char, info] of Object.entries(unitData)) {
    // 添加字
    items.push({
      char,
      text: char,
      type: 'char',
      typeLabel: '字',
      rootChar: char,
      index: null,
      groupChar: char
    });

    // 添加词
    if (info.词 && Array.isArray(info.词)) {
      info.词.forEach((word, idx) => {
        items.push({
          char,
          text: word,
          type: 'word',
          typeLabel: '词',
          rootChar: char,
          index: idx,
          groupChar: char
        });
      });
    }

    // 添加句
    if (info.句) {
      items.push({
        char,
        text: info.句,
        type: 'sentence',
        typeLabel: '句',
        rootChar: char,
        index: null,
        groupChar: char
      });
    }
  }

  return items;
}

// 渲染左侧列表（按字分组）
function renderLeftPanel() {
  const leftPanel = document.getElementById('batchRecordLeft');
  if (!leftPanel) return;

  leftPanel.innerHTML = '';

  // 按字分组
  const groups = {};
  batchState.items.forEach((item, index) => {
    const groupChar = item.groupChar;
    if (!groups[groupChar]) {
      groups[groupChar] = [];
    }
    groups[groupChar].push({ ...item, index });
  });

  // 渲染每个字分组
  for (const [groupChar, groupItems] of Object.entries(groups)) {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'batch-record-section';

    const title = document.createElement('div');
    title.className = 'batch-record-section-title';
    title.textContent = `「${groupChar}」`;
    sectionDiv.appendChild(title);

    groupItems.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'batch-record-item';
      itemDiv.dataset.index = item.index;

      if (item.index === batchState.currentIndex) {
        itemDiv.classList.add('active');
      }

      if (batchState.completed.has(item.index)) {
        itemDiv.classList.add('completed');
      }

      const textSpan = document.createElement('span');
      textSpan.className = 'batch-record-item-text';
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
        statusSpan.textContent = '待录音';
      }
      statusContainer.appendChild(statusSpan);
      
      itemDiv.appendChild(statusContainer);

      itemDiv.addEventListener('click', () => {
        selectItem(item.index);
      });

      sectionDiv.appendChild(itemDiv);
    });

    leftPanel.appendChild(sectionDiv);
  }

  updateProgress();
}

// 选择指定索引的项
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

// 更新当前内容显示
function updateCurrentInfo() {
  const currentTextEl = document.getElementById('batchRecordCurrentText');
  const currentTypeEl = document.getElementById('batchRecordCurrentType');

  if (batchState.items.length === 0) {
    currentTextEl.textContent = '-';
    currentTypeEl.textContent = '-';
    return;
  }

  const item = batchState.items[batchState.currentIndex];
  currentTextEl.textContent = item.text;
  currentTypeEl.textContent = item.typeLabel;
}

// 更新进度显示
function updateProgress() {
  const progressEl = document.getElementById('batchRecordProgress');
  const totalEl = document.getElementById('batchRecordTotal');

  progressEl.textContent = batchState.completed.size;
  totalEl.textContent = batchState.items.length;
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

  if (state.currentUnitIndex > 0) {
    state.currentUnitIndex--;
    loadBatchUnit();
  } else {
    showToast('已经是第一个单元', 'info');
  }
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

  if (state.currentUnitIndex < state.unitKeys.length - 1) {
    state.currentUnitIndex++;
    loadBatchUnit();
  } else {
    showToast('已经是最后一个单元', 'info');
  }
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
  const batchView = document.getElementById('batchRecordView');
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

// 退出批量录音模式
export function exitBatchRecord() {
  const batchView = document.getElementById('batchRecordView');
  const navbar = document.querySelector('.navbar');
  const toolbar = document.querySelector('.toolbar');
  const app = document.getElementById('app');

  if (!batchView) return;

  // 如果正在录音，先停止
  if (batchState.isRecording) {
    audioManager.stopRecording().catch(err => showToast('停止录音失败: ' + (err?.message || err), 'error'));
    batchState.isRecording = false;
  }

  batchView.classList.remove('active');
  navbar.style.display = 'flex';
  toolbar.style.display = 'flex';
  app.style.display = 'flex';

  // 确保返回后显示的是当前单元
  renderUnit();
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
  document.addEventListener('keydown', (e) => {
    // 只有在批量录音视图激活时才响应
    if (!document.getElementById('batchRecordView').classList.contains('active')) {
      return;
    }

    // 避免在输入框中触发
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    switch (e.key) {
      case ' ':
        e.preventDefault();
        toggleRecording();
        break;
      case 'Enter':
        e.preventDefault();
        uploadAll();
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
        exitBatchRecord();
        break;
    }
  });
}
