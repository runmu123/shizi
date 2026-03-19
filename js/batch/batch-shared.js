import { state } from '../app/state.js';
import { renderUnit } from '../ui/ui.js';

export function buildBatchItemsFromUnit(unitData, builders = {}) {
  const {
    buildCharItem,
    buildWordItem,
    buildSentenceItem,
  } = builders;
  const items = [];
  if (!unitData) return items;

  Object.entries(unitData).forEach(([rootChar, charData]) => {
    if (buildCharItem) {
      items.push(buildCharItem(rootChar, charData, items.length));
    }
    if (Array.isArray(charData?.词) && buildWordItem) {
      charData.词.forEach((word, wordIndex) => {
        items.push(buildWordItem(rootChar, word, wordIndex, items.length));
      });
    }
    if (charData?.句 && buildSentenceItem) {
      items.push(buildSentenceItem(rootChar, charData.句, items.length));
    }
  });

  return items;
}

export function renderBatchListPanel({
  panelId,
  items,
  currentIndex,
  completedSet,
  getGroupKey,
  formatGroupTitle,
  getPendingStatusText,
  onSelect,
  itemTextClass = 'item-text',
}) {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  panel.innerHTML = '';
  const groups = {};
  items.forEach((item, listIndex) => {
    const groupKey = getGroupKey(item);
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push({ item, listIndex });
  });

  Object.entries(groups).forEach(([groupKey, groupedItems]) => {
    const section = document.createElement('div');
    section.className = 'batch-record-section';

    const title = document.createElement('div');
    title.className = 'batch-record-section-title';
    title.textContent = formatGroupTitle(groupKey);
    section.appendChild(title);

    groupedItems.forEach(({ item, listIndex }) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'batch-record-item';
      itemEl.dataset.index = listIndex;
      if (listIndex === currentIndex) itemEl.classList.add('active');
      if (completedSet.has(listIndex)) itemEl.classList.add('completed');

      const textEl = document.createElement('span');
      textEl.className = itemTextClass;
      textEl.textContent = item.text;
      itemEl.appendChild(textEl);

      const statusContainer = document.createElement('div');
      statusContainer.style.display = 'flex';
      statusContainer.style.alignItems = 'center';

      const typeEl = document.createElement('span');
      typeEl.className = 'item-type';
      typeEl.textContent = item.typeLabel;
      statusContainer.appendChild(typeEl);

      const statusEl = document.createElement('span');
      statusEl.className = 'item-status';
      if (completedSet.has(listIndex)) {
        statusEl.textContent = '✓ 已完成';
        statusEl.classList.add('completed');
      } else {
        statusEl.textContent = getPendingStatusText(item);
      }
      statusContainer.appendChild(statusEl);

      itemEl.appendChild(statusContainer);
      itemEl.addEventListener('click', () => onSelect(listIndex));
      section.appendChild(itemEl);
    });

    panel.appendChild(section);
  });
}

export function updateBatchProgress({
  progressId,
  totalId,
  completedCount,
  totalCount,
}) {
  const progressEl = document.getElementById(progressId);
  const totalEl = document.getElementById(totalId);
  if (!progressEl || !totalEl) return;
  progressEl.textContent = completedCount;
  totalEl.textContent = totalCount;
}

export function updateBatchCurrentInfo({
  items,
  currentIndex,
  textId,
  typeId,
}) {
  const textEl = document.getElementById(textId);
  const typeEl = document.getElementById(typeId);
  if (!textEl || !typeEl) return;

  if (!items.length) {
    textEl.textContent = '-';
    typeEl.textContent = '-';
    return;
  }

  const currentItem = items[currentIndex];
  textEl.textContent = currentItem?.text || '-';
  typeEl.textContent = currentItem?.typeLabel || '-';
}

export function selectBatchIndex({
  index,
  itemsLength,
  onSelected,
  selector = '.batch-record-item',
}) {
  if (index < 0 || index >= itemsLength) return false;
  onSelected(index);

  setTimeout(() => {
    const element = document.querySelector(`${selector}[data-index="${index}"]`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 50);

  return true;
}

export function showBatchView(viewId) {
  const view = document.getElementById(viewId);
  const navbar = document.querySelector('.navbar');
  const toolbar = document.querySelector('.toolbar');
  const app = document.getElementById('app');
  if (!view || !navbar || !toolbar || !app) return false;

  navbar.style.display = 'none';
  toolbar.style.display = 'none';
  app.style.display = 'none';
  view.classList.add('active');
  return true;
}

export function hideBatchView(viewId) {
  const view = document.getElementById(viewId);
  const navbar = document.querySelector('.navbar');
  const toolbar = document.querySelector('.toolbar');
  const app = document.getElementById('app');
  if (!view || !navbar || !toolbar || !app) return false;

  view.classList.remove('active');
  navbar.style.display = 'flex';
  toolbar.style.display = 'flex';
  app.style.display = 'flex';
  renderUnit();
  return true;
}

export function enterBatchMode({ viewId, loadBatchUnit }) {
  if (!showBatchView(viewId)) return false;
  loadBatchUnit();
  return true;
}

export async function exitBatchMode({ viewId, beforeHide }) {
  if (typeof beforeHide === 'function') {
    await beforeHide();
  }
  return hideBatchView(viewId);
}

export function bindBatchKeyboard({ viewId, handlers }) {
  document.addEventListener('keydown', (e) => {
    const view = document.getElementById(viewId);
    if (!view?.classList.contains('active')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const handler = handlers[e.key];
    if (!handler) return;
    e.preventDefault();
    handler();
  });
}

export function moveBatchUnit(delta, onMoved, onBoundary) {
  const nextIndex = state.currentUnitIndex + delta;
  if (nextIndex < 0 || nextIndex >= state.unitKeys.length) {
    onBoundary?.(delta);
    return false;
  }
  state.currentUnitIndex = nextIndex;
  onMoved?.();
  return true;
}

export async function switchBatchUnit({
  delta,
  beforeMove,
  onMoved,
  onBoundary,
}) {
  if (typeof beforeMove === 'function') {
    const shouldContinue = await beforeMove(delta);
    if (shouldContinue === false) return false;
  }
  return moveBatchUnit(delta, onMoved, onBoundary);
}

export function loadBatchUnitView({
  batchState,
  getItems,
  resetState,
  renderLeftPanel,
  updateCurrentInfo,
  updateControls,
  unitTitleId,
  leftPanelId,
}) {
  batchState.items = getItems();
  batchState.currentIndex = 0;
  resetState?.();

  renderLeftPanel();
  updateCurrentInfo();
  updateControls?.();

  const unitTitle = document.getElementById(unitTitleId);
  if (unitTitle) {
    const unitName = state.unitKeys[state.currentUnitIndex];
    unitTitle.textContent = `(${unitName})`;
  }

  const leftPanel = document.getElementById(leftPanelId);
  if (leftPanel) {
    leftPanel.scrollTop = 0;
  }
}
