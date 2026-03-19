import { renderPracticeProgressCard } from './practice-progress-card.js';

export function renderPracticePageShell({
  titleText,
  backActionAttr,
  progressTitle,
  currentStep,
  total,
  progressPercent,
  completedCount,
  bodyHtml,
  headerClassName = 'notebook-group-header',
}) {
  return `
    <div class="${headerClassName}">
      <button class="back-inline-btn" type="button" ${backActionAttr}>返回</button>
      <span class="notebook-group-title">${titleText}</span>
    </div>
    ${renderPracticeProgressCard({ progressTitle, currentStep, total, progressPercent, completedCount })}
    ${bodyHtml}
  `;
}
