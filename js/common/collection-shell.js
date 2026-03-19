export function renderCollectionShell({ toggleAttrs, icon, label, count, expanded, bodyHtml }) {
  return `
    <div class="profile-progress-card-wrap">
      <button class="section-action-card profile-progress-toggle" type="button" ${toggleAttrs}>
        <span class="section-action-icon">${icon}</span>
        <span class="section-action-label">${label}</span>
        <span class="section-action-count">${count}</span>
        <span class="notebook-section-arrow${expanded ? ' expanded' : ''}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </span>
      </button>
      <div class="notebook-collapse${expanded ? ' expanded' : ''}">
        ${bodyHtml}
      </div>
    </div>
  `;
}
