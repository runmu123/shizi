export function buildCompletionSummaryHtml({
  scopeLabel,
  totalCount,
  correctCount,
  wrongCount,
  allCorrectText,
}) {
  if (wrongCount === 0) {
    return allCorrectText;
  }

  return `
    <span class="listen-result-summary-line">${scopeLabel}共 ${totalCount} 个字</span>
    <span class="listen-result-summary-line">选对 ${correctCount} 个，未选对 ${wrongCount} 个。</span>
  `;
}
