export function sortProgressLevels(levels) {
  return [...levels].sort((a, b) => {
    const na = parseInt(String(a).replace(/\D/g, ''), 10) || 0;
    const nb = parseInt(String(b).replace(/\D/g, ''), 10) || 0;
    return nb - na;
  });
}

export function sortProgressUnits(units, parseUnitNumber) {
  return [...units].sort((a, b) => parseUnitNumber(b) - parseUnitNumber(a));
}

export function renderGroupedLevelSections({
  escapeHtml,
  levels,
  expandedState,
  headerDataBuilder,
  getRows,
  renderRow,
  rowRenderer,
  emptyHtml = '',
}) {
  if (!levels.length) return emptyHtml;

  return levels.map((level, index) => {
    const expanded = typeof expandedState === 'function'
      ? !!expandedState(level, index)
      : !!expandedState?.[level];
    const headerData = headerDataBuilder(level, index, expanded);
    const toggleAttr = headerData.toggleAttr || headerData.headerAttrs || '';
    const contentClassName = headerData.contentClassName || 'progress-level-scroll';
    const rows = typeof getRows === 'function' ? getRows(level, index, expanded) : [];
    const contentHtml = typeof rowRenderer === 'function'
      ? rowRenderer(level, index, expanded)
      : `
        <div class="${contentClassName}">
          ${rows.map((row, rowIndex) => renderRow({ level, row, rowIndex, expanded })).join('')}
        </div>
      `;

    return `
      <div class="progress-level-item${headerData.itemClassName ? ` ${headerData.itemClassName}` : ''}">
        <div class="progress-level-header${expanded ? ' active' : ''}" ${toggleAttr}>
          <span>${escapeHtml(headerData.label || level)}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
        <div class="progress-level-content${expanded ? ' show' : ''}">
          ${contentHtml}
        </div>
      </div>
    `;
  }).join('');
}
