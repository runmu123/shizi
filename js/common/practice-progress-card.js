export function renderPracticeProgressCard({
  progressTitle,
  currentStep,
  total,
  progressPercent,
  completedCount,
}) {
  return `
    <div class="listen-progress-card">
      <div class="listen-progress-header">
        <span>${progressTitle}</span>
        <span>${currentStep}/${total}</span>
      </div>
      <div class="progress-track listen-progress-track">
        <div class="progress-fill" style="width:${progressPercent}%"></div>
      </div>
      <div class="listen-progress-caption">已完成 ${completedCount} / ${total}</div>
    </div>
  `;
}
