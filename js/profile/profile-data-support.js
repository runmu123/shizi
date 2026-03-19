export function createProfileDataSupport({
  state,
  normalizeWrongCharEntries,
  renderUnit,
  renderUnitPreservingScroll,
  showPersistentToast,
  showToast,
  getUserKey,
}) {
  function renderProfileShell() {
    if (state.appSection === 'profile' && state.profileView === 'main') {
      renderUnitPreservingScroll();
    } else {
      renderUnit();
    }
  }

  async function loadNotebookData(force = false) {
    const user = getUserKey();
    if (!user) {
      state.notebook.items = [];
      state.notebook.loading = false;
      state.notebook.error = '';
      state.notebook.loadedUser = '';
      renderProfileShell();
      return;
    }

    if (!force && state.notebook.loadedUser === user && state.notebook.items.length > 0) {
      return;
    }

    state.notebook.loading = true;
    state.notebook.error = '';
    renderProfileShell();

    if (!window.audioManager?.supabase) {
      state.notebook.items = [];
      state.notebook.loading = false;
      state.notebook.error = '数据库未连接';
      state.notebook.loadedUser = user;
      renderProfileShell();
      return;
    }

    try {
      const { data, error } = await audioManager.supabase
        .from('user_mistakes')
        .select('*')
        .eq('username', user)
        .order('last_wrong_at', { ascending: false });

      if (error) throw error;

      state.notebook.items = (data || []).map((item) => ({
        ...item,
        wrong_chars: normalizeWrongCharEntries(
          Array.isArray(item.wrong_chars)
            ? item.wrong_chars
            : (typeof item.wrong_chars === 'string' ? JSON.parse(item.wrong_chars || '[]') : []),
          item.level,
          item.unit,
        ),
      }));
      state.notebook.loadedUser = user;
      state.notebook.error = '';
    } catch (error) {
      console.error('加载生字本失败:', error);
      state.notebook.items = [];
      state.notebook.error = '生字本加载失败';
      state.notebook.loadedUser = user;
    } finally {
      state.notebook.loading = false;
      renderProfileShell();
    }
  }

  async function loadProfileProgressData(force = false) {
    const user = getUserKey();
    if (!user) {
      state.profileProgress.grouped = {};
      state.profileProgress.total = 0;
      state.profileProgress.loading = false;
      state.profileProgress.error = '';
      state.profileProgress.loadedUser = '';
      renderProfileShell();
      return;
    }

    if (!force && state.profileProgress.loadedUser === user && Object.keys(state.profileProgress.grouped || {}).length > 0) {
      return;
    }

    state.profileProgress.loading = true;
    state.profileProgress.error = '';
    renderProfileShell();

    if (!window.audioManager?.supabase) {
      state.profileProgress.grouped = {};
      state.profileProgress.total = 0;
      state.profileProgress.loading = false;
      state.profileProgress.error = '数据库未连接';
      state.profileProgress.loadedUser = user;
      renderProfileShell();
      return;
    }

    try {
      const { data, error } = await audioManager.supabase
        .from('user_progress')
        .select('*')
        .eq('username', user);

      if (error) throw error;

      const records = data || [];
      const uniqueChars = new Set(records.map((record) => record.char));
      const grouped = {};
      records.forEach((record) => {
        const level = record.level || '未知等级';
        const unit = record.unit || '未知单元';
        if (!grouped[level]) grouped[level] = {};
        if (!grouped[level][unit]) grouped[level][unit] = [];
        grouped[level][unit].push(record.char);
      });

      state.profileProgress.grouped = grouped;
      state.profileProgress.total = uniqueChars.size;
      state.profileProgress.loadedUser = user;
      state.profileProgress.error = '';
    } catch (error) {
      console.error('加载学习进度失败:', error);
      state.profileProgress.grouped = {};
      state.profileProgress.total = 0;
      state.profileProgress.error = '学习进度加载失败';
      state.profileProgress.loadedUser = user;
    } finally {
      state.profileProgress.loading = false;
      renderProfileShell();
    }
  }

  async function loadAudioProgressData(force = false) {
    if (!force && state.audioProgress.loaded && Object.keys(state.audioProgress.grouped || {}).length > 0) {
      return;
    }

    state.audioProgress.loading = true;
    state.audioProgress.error = '';
    renderProfileShell();

    if (!window.audioManager?.supabase) {
      state.audioProgress.grouped = {};
      state.audioProgress.total = 0;
      state.audioProgress.loading = false;
      state.audioProgress.error = '数据库未连接';
      state.audioProgress.loaded = true;
      renderProfileShell();
      return;
    }

    try {
      const records = await audioManager.getAllAudioRecords();
      const grouped = {};
      const uniqueChars = new Set();

      (records || []).forEach((record) => {
        const level = record.level || '未知等级';
        const unit = record.unit || '未知单元';
        const char = record.char || '';

        if (!grouped[level]) grouped[level] = {};
        if (!grouped[level][unit]) grouped[level][unit] = [];
        if (char && !grouped[level][unit].includes(char)) {
          grouped[level][unit].push(char);
        }
        if (char) {
          uniqueChars.add(`${level}__${unit}__${char}`);
        }
      });

      state.audioProgress.grouped = grouped;
      state.audioProgress.total = uniqueChars.size;
      state.audioProgress.loaded = true;
      state.audioProgress.error = '';
    } catch (error) {
      console.error('加载录音进度失败:', error);
      state.audioProgress.grouped = {};
      state.audioProgress.total = 0;
      state.audioProgress.error = '录音进度加载失败';
      state.audioProgress.loaded = true;
    } finally {
      state.audioProgress.loading = false;
      renderProfileShell();
    }
  }

  async function loadProfilePageData(force = false, { showQueryToasts = true } = {}) {
    const dismissToast = showQueryToasts
      ? showPersistentToast('正在查询数据中...', 'info')
      : () => {};
    const queryToastStart = showQueryToasts ? Date.now() : 0;
    try {
      const tasks = [
        loadNotebookData(force),
        loadProfileProgressData(force),
      ];
      if (state.isTeachingMode) {
        tasks.push(loadAudioProgressData(force));
      }
      await Promise.all(tasks);
    } finally {
      if (showQueryToasts) {
        const elapsed = Date.now() - queryToastStart;
        const minVisibleMs = 500;
        if (elapsed < minVisibleMs) {
          await new Promise((resolve) => setTimeout(resolve, minVisibleMs - elapsed));
        }
      }
      dismissToast();
      if (showQueryToasts) {
        showToast('查询完毕！', 'success');
      }
    }
  }

  function resetProfilePageData() {
    state.profileProgress.expanded = false;
    state.profileProgress.loading = false;
    state.profileProgress.error = '';
    state.profileProgress.loadedUser = '';
    state.profileProgress.total = 0;
    state.profileProgress.grouped = {};

    state.audioProgress.expanded = false;
    state.audioProgress.loading = false;
    state.audioProgress.error = '';
    state.audioProgress.loaded = false;
    state.audioProgress.total = 0;
    state.audioProgress.grouped = {};

    state.notebook.loading = false;
    state.notebook.error = '';
    state.notebook.loadedUser = '';
    state.notebook.items = [];
    state.notebook.expandedSections.listen = false;
    state.notebook.expandedSections.see = false;
    state.notebook.expandedLevels.listen = {};
    state.notebook.expandedLevels.see = {};
  }

  return {
    loadNotebookData,
    loadProfilePageData,
    resetProfilePageData,
  };
}
