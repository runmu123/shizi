export function renderDetailCardShell({ titleHtml, cardHtml, shellClassName = '', wrapperClassName = '' }) {
  const className = shellClassName || wrapperClassName;
  return `
    <div class="${['detail-card-shell', className].filter(Boolean).join(' ')}">
      ${titleHtml}
      ${cardHtml}
    </div>
  `;
}
