export function renderCardStageShell({
  headerHtml = '',
  stripHtml = '',
  cardHtml = '',
  prevDisabled = false,
  nextDisabled = false,
  prevAction = '',
  nextAction = '',
  stageAttrs = '',
  shellClassName = '',
  prevAriaLabel = '上一项',
  nextAriaLabel = '下一项',
  prevLabel = '',
  nextLabel = '',
}) {
  const shellClass = ['home-stage-shell', shellClassName].filter(Boolean).join(' ');
  const resolvedPrevLabel = prevLabel || prevAriaLabel;
  const resolvedNextLabel = nextLabel || nextAriaLabel;

  return `
    ${headerHtml}
    ${stripHtml}
    <div class="${shellClass}">
      <button class="home-card-nav prev" type="button" ${prevAction} ${prevDisabled ? 'disabled' : ''} aria-label="${resolvedPrevLabel}">‹</button>
      <div class="home-card-stage" ${stageAttrs}>
        ${cardHtml}
      </div>
      <button class="home-card-nav next" type="button" ${nextAction} ${nextDisabled ? 'disabled' : ''} aria-label="${resolvedNextLabel}">›</button>
    </div>
  `;
}
