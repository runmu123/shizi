// Toast 通知组件
const ICONS = {
  success: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  error: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
  info: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
};

function createToastElement(message, type) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  if (ICONS[type]) {
    const iconWrapper = document.createElement('span');
    iconWrapper.innerHTML = ICONS[type]; // 安全：硬编码的 SVG 字符串
    toast.appendChild(iconWrapper);
  }

  const span = document.createElement('span');
  span.textContent = message; // 使用 textContent 防止 XSS
  toast.appendChild(span);

  return toast;
}

export function showToast(message, type = 'default') {
  const container = document.getElementById('toastContainer');
  container.innerHTML = '';

  const toast = createToastElement(message, type);
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

export function showQuizToast(message, type = 'success') {
  const container = document.getElementById('quizToastContainer');
  if (!container) return;
  container.innerHTML = '';

  const toast = createToastElement(message, type);
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 2000);
}
