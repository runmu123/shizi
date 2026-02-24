// 菜单和弹窗：登录、统计、进度、下载、缓存
import { state, cacheSuffix } from './state.js';
import { showToast } from './toast.js';
import { USER_KEY, AUDIO_CACHE_NAME } from './constants.js';
import { escapeHtml } from './ui.js';
import { navigateToUnit } from './app.js';

export function setupMenuAndModals() {
  audioManager.init();

  const menuBtn = document.getElementById('menuBtn');
  const menuDropdown = document.getElementById('menuDropdown');
  const loginReminder = document.getElementById('loginReminder');
  const loginModal = document.getElementById('loginModal');
  const loginInput = document.getElementById('loginInput');
  const loginError = document.getElementById('loginError');

  // ===== 确认弹窗 =====
  const confirmModal = document.getElementById('confirmModal');
  const confirmTitle = document.getElementById('confirmTitle');
  const confirmMessage = document.getElementById('confirmMessage');
  let confirmCallback = null;

  // 中文数字转换
  const getCnNum = (str) => {
    // 增加对阿拉伯数字的支持
    const numMatch = str.match(/\d+/);
    if (numMatch) return parseInt(numMatch[0], 10);

    const m = str.match(/第(.+)单元/);
    if (!m) return 0;

    const s = m[1];
    const map = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
    const units = { '十': 10, '百': 100, '千': 1000 };

    let result = 0;
    let temp = 0;
    let hasNum = false;

    for (let i = 0; i < s.length; i++) {
      const char = s[i];
      if (map[char] !== undefined) {
        temp = map[char];
        hasNum = true;
      } else if (units[char]) {
        if (char === '十' && temp === 0 && result === 0) temp = 1;
        result += temp * units[char];
        temp = 0;
        hasNum = true;
      }
    }
    result += temp;
    return hasNum ? result : 0;
  };

  // 排序辅助函数
  const sortLevels = (levels) => {
    return levels.sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, '')) || 0;
      const nb = parseInt(b.replace(/\D/g, '')) || 0;
      return nb - na;
    });
  };

  const sortUnits = (units) => units.sort((a, b) => getCnNum(b) - getCnNum(a));

  // 加载 YAML 数据
  const loadLevelYamls = async (levels) => {
    await Promise.all(levels.map(async (lvl) => {
      if (!state.levelDataCache[lvl]) {
        try {
          const res = await fetch(`yaml/contents_${lvl}.yaml${cacheSuffix}`);
          if (res.ok) {
            const text = await res.text();
            state.levelDataCache[lvl] = jsyaml.load(text);
          }
        } catch (e) { console.warn('加载YAML失败', lvl); }
      }
    }));
  };

  // 对汉字进行排序
  const sortChars = (lvl, unit, chars) => {
    if (state.levelDataCache[lvl] && state.levelDataCache[lvl][unit]) {
      const standardOrder = Object.keys(state.levelDataCache[lvl][unit]);
      // 按标准顺序排序已学习的汉字，保留重复项
      const sorted = [];
      const charCount = {};
      chars.forEach(c => {
        charCount[c] = (charCount[c] || 0) + 1;
      });
      standardOrder.forEach(c => {
        if (charCount[c]) {
          for (let i = 0; i < charCount[c]; i++) {
            sorted.push(c);
          }
          delete charCount[c];
        }
      });
      // 追加未在标准顺序中的字符
      Object.keys(charCount).forEach(c => {
        for (let i = 0; i < charCount[c]; i++) {
          sorted.push(c);
        }
      });
      return sorted;
    }
    return chars;
  };

  // 通用列表渲染函数
  const renderContentList = async (container, groupedData, options = {}) => {
    const { showNav = false, emptyText = '暂无记录' } = options;
    const levels = sortLevels(Object.keys(groupedData));

    if (levels.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:20px; color:#6b7280;">${emptyText}</div>`;
      return;
    }

    // 确保 YAML 加载用于排序
    await loadLevelYamls(levels);

    let html = '';
    levels.forEach((lvl, index) => {
      const isExpanded = index === 0;
      const headerClass = isExpanded ? 'progress-level-header active' : 'progress-level-header';
      const contentClass = isExpanded ? 'progress-level-content show' : 'progress-level-content';

      html += `
        <div class="progress-level-item">
          <div class="${headerClass}">
            <span>${escapeHtml(lvl)}</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
          <div class="${contentClass}">
      `;

      const units = sortUnits(Object.keys(groupedData[lvl]));

      units.forEach(unit => {
        let displayChars = Array.from(groupedData[lvl][unit]);
        displayChars = sortChars(lvl, unit, displayChars);

        const navBtnHtml = showNav ? `
          <button class="progress-nav-btn" data-level="${escapeHtml(lvl)}" data-unit="${escapeHtml(unit)}" title="前往该单元">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>` : '';

        html += `
          <div class="progress-unit-row">
            <div class="progress-unit-info">
              <span class="progress-unit-name">${escapeHtml(unit)}: </span>
              <span class="progress-char-list">
                ${displayChars.map(c => `<span class="progress-char learned">${escapeHtml(c)}</span>`).join(', ')}
              </span>
            </div>
            ${navBtnHtml}
          </div>
        `;
      });
      html += `</div></div>`;
    });

    container.innerHTML = html;
  };

  function showConfirm(title, message, callback) {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmCallback = callback;
    confirmModal.classList.add('active');
  }

  document.getElementById('cancelConfirm').addEventListener('click', () => {
    confirmModal.classList.remove('active');
    confirmCallback = null;
  });

  document.getElementById('confirmConfirm').addEventListener('click', () => {
    confirmModal.classList.remove('active');
    if (confirmCallback) {
      confirmCallback();
      confirmCallback = null;
    }
  });

  // ===== 登录状态检测 =====
  function checkLoginStatus() {
    const user = localStorage.getItem(USER_KEY);
    if (!user) {
      if (!loginModal.classList.contains('active')) {
        loginModal.classList.add('active');
      }
      loginReminder.style.display = 'none';
    } else {
      loginReminder.style.display = 'none';
      if (loginModal.classList.contains('active')) {
        loginModal.classList.remove('active');
      }
    }
  }

  loginReminder.addEventListener('click', () => {
    loginModal.classList.add('active');
    loginReminder.style.display = 'none';
    loginInput.focus();
  });

  loginModal.addEventListener('click', (e) => {
    if (e.target === loginModal) {
      loginModal.classList.remove('active');
      const user = localStorage.getItem(USER_KEY);
      if (!user) {
        loginReminder.style.display = 'flex';
      }
    }
  });

  // ===== 菜单切换 =====
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menuDropdown.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    menuDropdown.classList.remove('show');
  });

  // ===== 登录/注销 =====
  document.getElementById('menuLogin').addEventListener('click', () => {
    const user = localStorage.getItem(USER_KEY);
    if (user) {
      showConfirm('注销确认', `当前已登录为「${user}」\n确定要注销吗？`, () => {
        localStorage.removeItem(USER_KEY);
        showToast('已注销', 'info');
        document.getElementById('menuLogin').textContent = '登录';
        checkLoginStatus();
      });
    } else {
      loginModal.classList.add('active');
      loginInput.value = '';
      loginError.style.display = 'none';
    }
  });

  document.getElementById('cancelLogin').addEventListener('click', () => {
    loginModal.classList.remove('active');
    const user = localStorage.getItem(USER_KEY);
    if (!user) {
      loginReminder.style.display = 'flex';
    }
  });

  document.getElementById('confirmLogin').addEventListener('click', async () => {
    const username = loginInput.value.trim();
    if (!username) {
      loginError.textContent = '请输入用户名';
      loginError.style.display = 'block';
      return;
    }

    if (audioManager.supabase) {
      const { data, error } = await audioManager.supabase
        .from('app_users')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (error) {
        console.error(error);
        loginError.textContent = '登录出错，请重试';
        loginError.style.display = 'block';
        return;
      }

      if (!data) {
        const { error: insertError } = await audioManager.supabase
          .from('app_users')
          .insert([{ username: username }]);

        if (insertError) {
          console.error('创建用户失败:', insertError);
          showToast('创建用户失败', 'error');
          return;
        }

        showToast(`欢迎新用户 ${username}`, 'success');
      } else {
        showToast(`欢迎回来，${username}`, 'success');
      }

      localStorage.setItem(USER_KEY, username);
      loginModal.classList.remove('active');
      document.getElementById('menuLogin').textContent = '注销 (' + username + ')';
      checkLoginStatus();
    } else {
      showToast('数据库未连接', 'error');
    }
  });

  // 加载时更新登录菜单文字
  const currentUser = localStorage.getItem(USER_KEY);
  if (currentUser) {
    document.getElementById('menuLogin').textContent = '注销 (' + currentUser + ')';
  }

  checkLoginStatus();

  // ===== 统计弹窗 =====
  const statsModal = document.getElementById('statsModal');
  const statsAudioListContainer = document.getElementById('statsAudioListContainer');

  // 统计列表交互
  statsAudioListContainer.addEventListener('click', (e) => {
    const header = e.target.closest('.progress-level-header');
    if (header) {
      header.classList.toggle('active');
      header.nextElementSibling.classList.toggle('show');
    }
  });

  document.getElementById('menuStats').addEventListener('click', async () => {
    statsModal.classList.add('active');
    statsAudioListContainer.innerHTML = '<div class="loading">加载中...</div>';

    let totalChars = 0;
    for (const lvl of state.LEVELS) {
      try {
        let data = state.levelDataCache[lvl];
        if (!data) {
          const res = await fetch(`yaml/contents_${lvl}.yaml${cacheSuffix}`);
          if (res.ok) {
            const text = await res.text();
            data = jsyaml.load(text);
            state.levelDataCache[lvl] = data;
          }
        }
        if (data) {
          Object.values(data).forEach(unitChars => {
            if (unitChars) totalChars += Object.keys(unitChars).length;
          });
        }
      } catch (e) { console.warn('统计汉字数量出错:', lvl); }
    }
    document.getElementById('statsTotalChars').textContent = totalChars;

    if (audioManager) {
      try {
        const records = await audioManager.getAllAudioRecords();

        // 统计去重后的字数
        const uniqueChars = new Set(records.map(r => `${r.level}-${r.unit}-${r.char}`));
        document.getElementById('statsAudioCount').textContent = uniqueChars.size;

        // 分组
        const grouped = {};
        records.forEach(r => {
          const lvl = r.level || '未知等级';
          const unit = r.unit || '未知单元';
          if (!grouped[lvl]) grouped[lvl] = {};
          if (!grouped[lvl][unit]) grouped[lvl][unit] = new Set();
          grouped[lvl][unit].add(r.char);
        });

        await renderContentList(statsAudioListContainer, grouped, { emptyText: '暂无录音记录' });

      } catch (e) {
        console.error(e);
        statsAudioListContainer.innerHTML = '<div class="error-msg">加载失败</div>';
      }
    }
  });

  document.getElementById('closeStats').addEventListener('click', () => {
    statsModal.classList.remove('active');
  });

  // ===== 学习进度弹窗 =====
  const progressModal = document.getElementById('progressModal');
  const progressLevelsContainer = document.getElementById('progressLevelsContainer');

  // 使用事件委托处理进度面板交互

  progressLevelsContainer.addEventListener('click', (e) => {
    // 折叠/展开等级
    const header = e.target.closest('.progress-level-header');
    if (header) {
      header.classList.toggle('active');
      header.nextElementSibling.classList.toggle('show');
      return;
    }

    // 导航到单元
    const navBtn = e.target.closest('.progress-nav-btn');
    if (navBtn) {
      const level = navBtn.dataset.level;
      const unit = navBtn.dataset.unit;
      if (level && unit) {
        navigateToUnit(level, unit);
      }
    }
  });

  document.getElementById('menuProgress').addEventListener('click', async () => {
    const user = localStorage.getItem(USER_KEY);
    if (!user) {
      showToast('请先登录查看进度', 'info');
      return;
    }

    progressModal.classList.add('active');
    progressLevelsContainer.innerHTML = '<div class="loading">加载中...</div>';

    if (audioManager.supabase) {
      const { data: records, error } = await audioManager.supabase
        .from('user_progress')
        .select('*')
        .eq('username', user);

      if (error) {
        progressLevelsContainer.innerHTML = '<div class="error-msg">加载失败</div>';
        return;
      }

      // 获取所有去重的汉字数量用于统计
      const uniqueChars = new Set(records.map(r => r.char));
      document.getElementById('progressTotalCount').textContent = uniqueChars.size;

      // 按级别和单元分组（不去重）
      const grouped = {};
      records.forEach(r => {
        const lvl = r.level || '未知等级';
        const unit = r.unit || '未知单元';
        if (!grouped[lvl]) grouped[lvl] = {};
        if (!grouped[lvl][unit]) grouped[lvl][unit] = [];
        grouped[lvl][unit].push(r.char);
      });

      await renderContentList(progressLevelsContainer, grouped, { showNav: true, emptyText: '暂无学习记录' });
    }
  });

  document.getElementById('closeProgress').addEventListener('click', () => {
    progressModal.classList.remove('active');
  });

  // ===== 下载语音数据 =====
  document.getElementById('menuDownload').addEventListener('click', async () => {
    if (!audioManager.supabase) {
      showToast('数据库未连接', 'error');
      return;
    }

    const progressDiv = document.getElementById('downloadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    progressDiv.style.display = 'flex';
    progressFill.style.width = '0%';
    progressText.textContent = '准备中...';

    try {
      const files = await audioManager.getAllAudioRecords();
      if (!files || files.length === 0) {
        showToast('没有可下载的语音文件', 'info');
        progressDiv.style.display = 'none';
        return;
      }

      let downloaded = 0;
      const total = files.length;
      progressText.textContent = `0/${total}`;

      let cache = null;
      if ('caches' in window) {
        try {
          cache = await caches.open(AUDIO_CACHE_NAME);
        } catch (e) {
          console.warn('打开缓存失败:', e);
        }
      }

      await Promise.all(files.map(async (file) => {
        try {
          const { data } = audioManager.supabase.storage
            .from(SUPABASE_CONFIG.bucket)
            .getPublicUrl(file.path);

          const baseUrl = data.publicUrl;
          const url = cacheSuffix
            ? `${baseUrl}${baseUrl.includes('?') ? '&' : ''}${cacheSuffix.replace('?', '')}`
            : baseUrl;

          if (cache) {
            // 如果是强制刷新，先删除旧缓存
            if (cacheSuffix) {
              await cache.delete(baseUrl);
            }
            const cachedRes = await cache.match(baseUrl);
            if (cachedRes) return;

            const fetchOpts = cacheSuffix ? { cache: 'reload' } : {};
            const res = await fetch(url, fetchOpts);
            if (res.ok) await cache.put(baseUrl, res.clone()); // 存入 clone 后的响应
          } else {
            const fetchOpts = cacheSuffix ? { cache: 'reload' } : {};
            const res = await fetch(url, fetchOpts);
            if (res.ok) await res.blob();
          }
        } catch (e) {
          console.warn('下载失败', file.path, e);
        } finally {
          downloaded++;
          const pct = (downloaded / total) * 100;
          progressFill.style.width = `${pct}%`;
          progressText.textContent = `${downloaded}/${total}`;
        }
      }));

      showToast(cache ? '语音数据已下载至缓存' : '语音数据下载完成', 'success');
    } catch (e) {
      console.error(e);
      showToast('下载出错', 'error');
    } finally {
      setTimeout(() => {
        progressDiv.style.display = 'none';
      }, 2000);
    }
  });

  // ===== 清除缓存 =====
  document.getElementById('menuClearCache').addEventListener('click', async () => {
    if ('caches' in window) {
      try {
        const cache = await caches.open(AUDIO_CACHE_NAME);
        const keys = await cache.keys();
        if (keys.length === 0) {
          showToast('未发现语音缓存', 'info');
          return;
        }

        let totalBytes = 0;
        for (const req of keys) {
          const res = await cache.match(req);
          if (res) {
            const cl = res.headers.get('content-length');
            if (cl) {
              totalBytes += parseInt(cl, 10);
            } else {
              const buf = await res.arrayBuffer();
              totalBytes += buf.byteLength;
            }
          }
        }

        await caches.delete(AUDIO_CACHE_NAME);
        const mb = (totalBytes / 1024 / 1024).toFixed(2);
        showToast(`语音缓存已清理，共 ${keys.length} 个文件，${mb} MB`, 'success');
      } catch (e) {
        console.error(e);
        showToast('清理缓存失败', 'error');
      }
    } else {
      showToast('浏览器不支持缓存清理', 'error');
    }
  });

  // ===== 刷新页面 =====
  document.getElementById('menuRefresh').addEventListener('click', async () => {
    const progressDiv = document.getElementById('downloadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    progressDiv.style.display = 'flex';
    progressFill.style.width = '10%';
    progressText.textContent = '准备刷新...';

    try {
      progressFill.style.width = '50%';
      await new Promise(r => setTimeout(r, 200));

      progressFill.style.width = '100%';
      progressText.textContent = '刷新中...';

      await new Promise(r => setTimeout(r, 200));

      sessionStorage.setItem('shizi_force_refresh', 'true');
      window.location.reload(true);
    } catch (e) {
      console.error('刷新出错:', e);
      sessionStorage.setItem('shizi_force_refresh', 'true');
      window.location.reload(true);
    }
  });
}
