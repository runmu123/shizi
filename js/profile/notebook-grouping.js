export function chunkNotebookItems(items, size = 5) {
  const groups = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}

export function getNotebookGroupsByLevel(items, mode) {
  const filteredItems = (items || [])
    .filter((item) => item.mistake_mode === mode)
    .sort((a, b) => new Date(a.created_at || a.last_wrong_at || 0) - new Date(b.created_at || b.last_wrong_at || 0));

  const grouped = {};
  filteredItems.forEach((item) => {
    const level = item.level || '未分级';
    if (!grouped[level]) grouped[level] = [];
    grouped[level].push(item);
  });

  const levels = Object.keys(grouped).sort((a, b) => {
    const na = parseInt(String(a).replace(/\D/g, ''), 10) || 0;
    const nb = parseInt(String(b).replace(/\D/g, ''), 10) || 0;
    return nb - na;
  });

  return Object.fromEntries(levels.map((level) => [level, chunkNotebookItems(grouped[level], 5)]));
}
