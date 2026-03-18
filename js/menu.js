// 菜单和弹窗：登录、统计、进度、下载、缓存
import { state, cacheSuffix } from './state.js';
import { showToast } from './toast.js';
import { USER_KEY, AUDIO_CACHE_NAME } from './constants.js';
import { escapeHtml, renderUnit, updateAppShell } from './ui.js';
import { navigateToUnit, clearProfilePageDataAfterLogout, refreshProfilePageDataAfterLogin } from './app.js';

export function setupMenuAndModals() {
  audioManager.init();

  let scrollPosition = 0;
  let batchSize = 100; // 默认批次大小

  function emitAuthStateChanged(user) {
    window.dispatchEvent(new CustomEvent('shizi-auth-changed', {
      detail: { user: user || '' },
    }));
  }

  function refreshAuthDependentUi(user = localStorage.getItem(USER_KEY) || '') {
    const menuLoginBtn = document.getElementById('menuLogin');
    if (menuLoginBtn) {
      menuLoginBtn.textContent = user ? `注销 (${user})` : '登录';
    }
    renderUnit();
    updateAppShell();
  }

  function lockScroll() {
    scrollPosition = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollPosition}px`;
    document.body.style.width = '100%';
  }

  function unlockScroll() {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollPosition);
  }

  const loginReminder = document.getElementById('loginReminder');
  const loginModal = document.getElementById('loginModal');
  const loginInput = document.getElementById('loginInput');
  const loginError = document.getElementById('loginError');
  const loginLoadingModal = document.getElementById('loginLoadingModal');

  // ===== 确认弹窗 =====
  const confirmModal = document.getElementById('confirmModal');
  const confirmTitle = document.getElementById('confirmTitle');
  const confirmMessage = document.getElementById('confirmMessage');
  let confirmCallback = null;

  function bindClick(id, handler) {
    const element = document.getElementById(id);
    if (!element) return;
    element.addEventListener('click', handler);
  }

  // 中文单元号解析（统一走共享模块）
  const getCnNum = (str) => {
    const parsed = window.ShiziUnitNumber?.parseUnitNumber?.(str);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // 格式化单元数字为3字符宽度
  const formatUnitNumber = (unit) => {
    const num = getCnNum(unit);
    if (num === 0) return unit;

    // 一位数前后各加空格，两位数后加空格
    return num < 10 ? ` ${num} ` : `${num} `;
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

        // 格式化单元名称
        const formattedUnit = unit.replace(/第(.+)单元/, (match, p1) => {
          const num = getCnNum(unit);
          const formattedNum = formatUnitNumber(unit);
          return `第${formattedNum}单元`;
        });

        html += `
          <div class="progress-unit-row">
            <div class="progress-unit-info">
              <span class="progress-unit-name">${escapeHtml(formattedUnit)}:</span>
              <span class="progress-char-list">
                ${displayChars.map(c => `<span class="progress-char learned">${escapeHtml(c)}</span>`).join(',')}
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
    if (!confirmModal || !confirmTitle || !confirmMessage) {
      callback?.();
      return;
    }
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmCallback = callback;
    confirmModal.classList.add('active');
    lockScroll();
  }

  function setCacheClearProgress({ percent = 0, status = '准备中...' } = {}) {
    const modal = document.getElementById('cacheClearModal');
    const fill = document.getElementById('cacheClearFill');
    const percentText = document.getElementById('cacheClearPercent');
    const statusText = document.getElementById('cacheClearStatus');
    if (!modal || !fill || !percentText || !statusText) return;

    modal.classList.add('active');
    fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    percentText.textContent = `${Math.round(Math.max(0, Math.min(100, percent)))}%`;
    statusText.textContent = status;
  }

  function hideCacheClearProgress(delay = 600) {
    const modal = document.getElementById('cacheClearModal');
    if (!modal) return;
    setTimeout(() => {
      modal.classList.remove('active');
      unlockScroll();
    }, delay);
  }

  function setTaskProgress({ title = '正在处理', percent = 0, status = '准备中...' } = {}) {
    const modal = document.getElementById('taskProgressModal');
    const titleEl = document.getElementById('taskProgressTitle');
    const fill = document.getElementById('taskProgressFill');
    const percentText = document.getElementById('taskProgressPercent');
    const statusText = document.getElementById('taskProgressStatus');
    if (!modal || !titleEl || !fill || !percentText || !statusText) return;

    modal.classList.add('active');
    titleEl.textContent = title;
    fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    percentText.textContent = `${Math.round(Math.max(0, Math.min(100, percent)))}%`;
    statusText.textContent = status;
  }

  function hideTaskProgress(delay = 600) {
    const modal = document.getElementById('taskProgressModal');
    if (!modal) return;
    setTimeout(() => {
      modal.classList.remove('active');
      unlockScroll();
    }, delay);
  }

  bindClick('cancelConfirm', () => {
    if (!confirmModal) return;
    confirmModal.classList.remove('active');
    confirmCallback = null;
    unlockScroll();
  });

  bindClick('confirmConfirm', () => {
    if (!confirmModal) return;
    confirmModal.classList.remove('active');
    unlockScroll();
    if (confirmCallback) {
      confirmCallback();
      confirmCallback = null;
    }
  });

  // ===== 登录状态检测 =====
  function checkLoginStatus() {
    if (!loginModal || !loginReminder) return;
    const user = localStorage.getItem(USER_KEY);
    if (!user) {
      if (!loginModal.classList.contains('active')) {
        loginModal.classList.add('active');
        lockScroll();
      }
      loginReminder.style.display = 'none';
    } else {
      loginReminder.style.display = 'none';
      if (loginModal.classList.contains('active')) {
        loginModal.classList.remove('active');
        unlockScroll();
      }
    }
  }

  if (loginReminder) {
    loginReminder.addEventListener('click', () => {
      if (!loginModal) return;
      loginModal.classList.add('active');
      lockScroll();
      loginReminder.style.display = 'none';
      loginInput?.focus();
    });
  }

  if (loginModal) {
    loginModal.addEventListener('click', (e) => {
      if (e.target === loginModal) {
        loginModal.classList.remove('active');
        unlockScroll();
        const user = localStorage.getItem(USER_KEY);
        if (!user && loginReminder) {
          loginReminder.style.display = 'flex';
        }
      }
    });
  }

  // ===== 登录/注销 =====
  const handleLoginToggle = () => {
    const user = localStorage.getItem(USER_KEY);
    if (user) {
      showConfirm('注销确认', `当前已登录为「${user}」\n确定要注销吗？`, () => {
        localStorage.removeItem(USER_KEY);
        clearProfilePageDataAfterLogout();
        showToast('已注销', 'info');
        checkLoginStatus();
        refreshAuthDependentUi('');
        emitAuthStateChanged('');
      });
    } else {
      if (!loginModal || !loginInput || !loginError) return;
      loginModal.classList.add('active');
      lockScroll();
      loginInput.value = '';
      loginError.style.display = 'none';
    }
  };

  bindClick('menuLogin', handleLoginToggle);

  bindClick('cancelLogin', () => {
    if (!loginModal) return;
    loginModal.classList.remove('active');
    unlockScroll();
    const user = localStorage.getItem(USER_KEY);
    if (!user && loginReminder) {
      loginReminder.style.display = 'flex';
    }
  });

  async function handleLogin() {
    if (!loginInput || !loginError || !loginModal || !loginLoadingModal) return;
    const username = loginInput.value.trim();
    if (!username) {
      loginError.textContent = '请输入用户名';
      loginError.style.display = 'block';
      return;
    }

    loginModal.classList.remove('active');
    loginLoadingModal.classList.add('active');

    if (audioManager.supabase) {
      const { data, error } = await audioManager.supabase
        .from('app_users')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (error) {
        console.error(error);
        loginLoadingModal.classList.remove('active');
        loginModal.classList.add('active');
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
          loginLoadingModal.classList.remove('active');
          showToast('创建用户失败', 'error');
          return;
        }

        showToast(`欢迎新用户 ${username}`, 'success');
      } else {
        showToast(`欢迎回来，${username}`, 'success');
      }

      localStorage.setItem(USER_KEY, username);
      loginLoadingModal.classList.remove('active');
      unlockScroll();
      checkLoginStatus();
      refreshAuthDependentUi(username);
      emitAuthStateChanged(username);
      await refreshProfilePageDataAfterLogin();
    } else {
      loginLoadingModal.classList.remove('active');
      unlockScroll();
      showToast('数据库未连接', 'error');
    }
  }

  if (loginInput) {
    loginInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleLogin();
      }
    });
  }

  bindClick('confirmLogin', handleLogin);

  // 加载时更新登录菜单文字
  const currentUser = localStorage.getItem(USER_KEY);
  if (currentUser) {
    const menuLoginBtn = document.getElementById('menuLogin');
    if (menuLoginBtn) {
      menuLoginBtn.textContent = '注销 (' + currentUser + ')';
    }
  }

  window.addEventListener('shizi-auth-changed', (event) => {
    refreshAuthDependentUi(event.detail?.user || '');
  });

  window.addEventListener('storage', (event) => {
    if (event.key === USER_KEY) {
      refreshAuthDependentUi(event.newValue || '');
    }
  });

  checkLoginStatus();

  // ===== 统计弹窗 =====
  const statsModal = document.getElementById('statsModal');
  const statsAudioListContainer = document.getElementById('statsAudioListContainer');

  // 统计列表交互
  if (statsAudioListContainer) {
    statsAudioListContainer.addEventListener('click', (e) => {
      const header = e.target.closest('.progress-level-header');
      if (header) {
        header.classList.toggle('active');
        header.nextElementSibling.classList.toggle('show');
      }
    });
  }

  const showStatsModal = async () => {
    if (!statsModal || !statsAudioListContainer) return;
    statsModal.classList.add('active');
    lockScroll();
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
  };

  bindClick('menuStats', showStatsModal);

  bindClick('closeStats', () => {
    if (!statsModal) return;
    statsModal.classList.remove('active');
    unlockScroll();
  });

  // ===== 学习进度弹窗 =====
  const progressModal = document.getElementById('progressModal');
  const progressLevelsContainer = document.getElementById('progressLevelsContainer');

  // 使用事件委托处理进度面板交互

  if (progressLevelsContainer) {
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
  }

  const showProgressModal = async () => {
    if (!progressModal || !progressLevelsContainer) return;
    const user = localStorage.getItem(USER_KEY);
    if (!user) {
      showToast('请先登录查看进度', 'info');
      return;
    }

    progressModal.classList.add('active');
    lockScroll();
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
  };

  bindClick('menuProgress', showProgressModal);

  bindClick('closeProgress', () => {
    if (!progressModal) return;
    progressModal.classList.remove('active');
    unlockScroll();
  });

  // ===== 下载语音数据 =====
  const openDownloadDialog = () => {
    // 显示等级选择弹窗
    const modal = document.getElementById('levelSelectModal');
    const levelCheckboxes = document.getElementById('levelCheckboxes');
    if (modal && levelCheckboxes) {
      // 动态生成等级复选框
      levelCheckboxes.innerHTML = '';
      state.LEVELS.forEach(level => {
        const div = document.createElement('div');
        div.style.marginBottom = '8px';
        div.innerHTML = `
          <input type="checkbox" id="level-${level}" name="level" value="${level}" style="margin-right: 8px;">
          <label for="level-${level}">${level}</label>
        `;
        levelCheckboxes.appendChild(div);
      });
      modal.classList.add('active');
      lockScroll();
    }
  };
  bindClick('menuDownload', openDownloadDialog);

  // ===== 等级选择弹窗事件 =====
  bindClick('confirmLevelSelect', () => {
    const modal = document.getElementById('levelSelectModal');
    const checkboxes = document.querySelectorAll('input[name="level"]:checked');
    const selectedLevels = Array.from(checkboxes).map(checkbox => checkbox.value);

    if (selectedLevels.length === 0) {
      showToast('请至少选择一个等级', 'error');
      return;
    }

    modal.classList.remove('active');
    unlockScroll();

    // 显示批次大小输入弹窗
    const batchModal = document.getElementById('batchSizeModal');
    const input = document.getElementById('batchSizeInput');
    if (batchModal && input) {
      input.value = batchSize;
      batchModal.classList.add('active');
      lockScroll();
      input.focus();

      // 保存选择的等级
      window.selectedDownloadLevels = selectedLevels;
    }
  });

  bindClick('cancelLevelSelect', () => {
    const modal = document.getElementById('levelSelectModal');
    if (!modal) return;
    modal.classList.remove('active');
    unlockScroll();
  });

  // ===== 批次大小弹窗事件 =====
  bindClick('confirmBatchSize', () => {
    const input = document.getElementById('batchSizeInput');
    const modal = document.getElementById('batchSizeModal');
    if (!input || !modal) return;
    const value = parseInt(input.value);

    if (value && value >= 1 && value <= 100) {
      batchSize = value;
      modal.classList.remove('active');
      unlockScroll();
      startDownload(window.selectedDownloadLevels);
    } else {
      showToast('请输入1-100之间的数字', 'error');
    }
  });

  bindClick('cancelBatchSize', () => {
    const modal = document.getElementById('batchSizeModal');
    if (!modal) return;
    modal.classList.remove('active');
    unlockScroll();

    // 清除选择的等级
    window.selectedDownloadLevels = null;
  });

  // 开始下载
  async function startDownload(selectedLevels = null) {
    if (!audioManager.supabase) {
      showToast('数据库未连接', 'error');
      return;
    }
    lockScroll();
    setTaskProgress({ title: '正在下载语音数据', percent: 2, status: '准备中...' });

    try {
      let files = await audioManager.getAllAudioRecords();

      // 如果选择了等级，则过滤文件
      if (selectedLevels && selectedLevels.length > 0) {
        files = files.filter(file => selectedLevels.includes(file.level));
      }

      if (!files || files.length === 0) {
        setTaskProgress({ title: '正在下载语音数据', percent: 100, status: '没有可下载的语音文件' });
        hideTaskProgress();
        showToast('没有可下载的语音文件', 'info');
        return;
      }

      let downloaded = 0;
      const total = files.length;
      setTaskProgress({ title: '正在下载语音数据', percent: 3, status: `已找到 ${total} 个语音文件` });

      let cache = null;
      if ('caches' in window) {
        try {
          cache = await caches.open(AUDIO_CACHE_NAME);
        } catch (e) {
          console.warn('打开缓存失败:', e);
        }
      }

      // 分批下载，每批用户指定的数量
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);

        await Promise.all(batch.map(async (file) => {
          try {
            // 获取文件 URL
            const { data } = audioManager.supabase.storage
              .from(SUPABASE_CONFIG.bucket)
              .getPublicUrl(file.path);

            const baseUrl = data.publicUrl;

            // 构造实际请求 URL（处理强制刷新后缀）
            const suffix = cacheSuffix ? cacheSuffix.replace('?', '') : '';
            const url = suffix
              ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${suffix}`
              : baseUrl;

            // 确保缓存对象存在
            if (!cache && 'caches' in window) {
              try {
                cache = await caches.open(AUDIO_CACHE_NAME);
              } catch (e) {
                console.warn('打开缓存失败:', e);
              }
            }

            if (cache) {
              // 1. 检查是否存在有效缓存
              // 如果设置了强制刷新后缀，则视为无效，需要重新下载
              const matchReq = new Request(baseUrl);
              const cachedRes = await cache.match(matchReq);

              if (cachedRes && !cacheSuffix) {
                // 有缓存且非强制刷新，跳过下载
                return;
              }

              // 2. 强制刷新模式下，先清理旧缓存
              if (cacheSuffix) {
                await cache.delete(matchReq);
              }

              // 3. 执行网络请求下载
              // cache: 'reload' 确保从网络获取，不读取 HTTP 缓存
              const fetchOpts = { cache: 'reload' };
              const res = await fetch(url, fetchOpts);

              if (res.ok) {
                // 4. 存入 Cache API
                // 注意：这里使用 baseUrl (不带后缀) 作为 key，确保后续播放时能命中
                // 响应必须 clone，因为 put 会消耗 body
                await cache.put(matchReq, res.clone());
              }
            } else {
              // 浏览器不支持缓存 API，仍然下载但不缓存（仅预热 HTTP 缓存）
              const res = await fetch(url);
              if (res.ok) await res.blob(); // 消耗流
            }
          } catch (e) {
            console.warn('下载失败', file.path, e);
          }
        }));

        // 更新进度条（每批次更新一次 DOM，减少重绘）
        downloaded = Math.min(downloaded + batch.length, total);
        const pct = (downloaded / total) * 100;
        setTaskProgress({
          title: '正在下载语音数据',
          percent: pct,
          status: `正在下载 ${downloaded}/${total}`,
        });
      }

      setTaskProgress({
        title: '正在下载语音数据',
        percent: 100,
        status: cache ? '下载完成，语音已写入缓存' : '下载完成',
      });
      hideTaskProgress(900);
      showToast(cache ? '语音数据已下载至缓存' : '语音数据下载完成', 'success');
    } catch (e) {
      console.error(e);
      setTaskProgress({ title: '正在下载语音数据', percent: 100, status: '下载失败，请稍后重试' });
      hideTaskProgress(900);
      showToast('下载出错', 'error');
    }
  }

  // ===== 清除缓存 =====
  const clearAudioCache = async () => {
    if ('caches' in window) {
      try {
        lockScroll();
        setCacheClearProgress({ percent: 3, status: '正在检查缓存项目...' });

        const cache = await caches.open(AUDIO_CACHE_NAME);
        const keys = await cache.keys();
        if (keys.length === 0) {
          setCacheClearProgress({ percent: 100, status: '未发现可清理的语音缓存' });
          hideCacheClearProgress();
          showToast('未发现语音缓存', 'info');
          return;
        }

        let totalBytes = 0;
        for (let i = 0; i < keys.length; i++) {
          const req = keys[i];
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
          const inspectPercent = 5 + (((i + 1) / keys.length) * 25);
          setCacheClearProgress({
            percent: inspectPercent,
            status: `正在统计缓存大小 ${i + 1}/${keys.length}`,
          });
        }

        for (let i = 0; i < keys.length; i++) {
          await cache.delete(keys[i]);
          const clearPercent = 30 + (((i + 1) / keys.length) * 70);
          setCacheClearProgress({
            percent: clearPercent,
            status: `正在清理缓存文件 ${i + 1}/${keys.length}`,
          });
        }

        await caches.delete(AUDIO_CACHE_NAME);
        const mb = (totalBytes / 1024 / 1024).toFixed(2);
        setCacheClearProgress({ percent: 100, status: `清理完成，共清理 ${keys.length} 个文件` });
        hideCacheClearProgress(900);
        showToast(`语音缓存已清理，共 ${keys.length} 个文件，${mb} MB`, 'success');
      } catch (e) {
        console.error(e);
        setCacheClearProgress({ percent: 100, status: '清理失败，请稍后重试' });
        hideCacheClearProgress(900);
        showToast('清理缓存失败', 'error');
      }
    } else {
      showToast('浏览器不支持缓存清理', 'error');
    }
  };
  bindClick('menuClearCache', clearAudioCache);

  // ===== 刷新页面 =====
  const handleHardRefresh = async () => {
    lockScroll();
    setTaskProgress({ title: '正在刷新页面', percent: 10, status: '准备刷新...' });

    try {
      setTaskProgress({ title: '正在刷新页面', percent: 50, status: '正在更新资源...' });
      await new Promise(r => setTimeout(r, 200));

      setTaskProgress({ title: '正在刷新页面', percent: 100, status: '刷新中...' });

      await new Promise(r => setTimeout(r, 200));

      const token = window.ShiziRefresh?.createRefreshToken?.() || Date.now().toString();
      if (window.ShiziRefresh?.storeRefreshToken) {
        window.ShiziRefresh.storeRefreshToken(token);
      } else {
        const refreshTokenKey = window.ShiziRefresh?.FORCE_REFRESH_TOKEN_KEY || 'shizi_force_refresh_token';
        sessionStorage.setItem(refreshTokenKey, token);
      }
      const nextUrl = window.ShiziRefresh?.buildHardRefreshUrl?.(token)
        || `${window.location.pathname}?t=${encodeURIComponent(token)}${window.location.hash || ''}`;
      window.location.replace(nextUrl);
    } catch (e) {
      console.error('刷新出错:', e);
      const token = window.ShiziRefresh?.createRefreshToken?.() || Date.now().toString();
      if (window.ShiziRefresh?.storeRefreshToken) {
        window.ShiziRefresh.storeRefreshToken(token);
      } else {
        const refreshTokenKey = window.ShiziRefresh?.FORCE_REFRESH_TOKEN_KEY || 'shizi_force_refresh_token';
        sessionStorage.setItem(refreshTokenKey, token);
      }
      const nextUrl = window.ShiziRefresh?.buildHardRefreshUrl?.(token)
        || `${window.location.pathname}?t=${encodeURIComponent(token)}${window.location.hash || ''}`;
      window.location.replace(nextUrl);
    }
  };

  const refreshEntryIds = ['menuRefresh'];
  refreshEntryIds.forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', handleHardRefresh);
    }
  });

  window.shiziActions = {
    toggleLogin: handleLoginToggle,
    showStatsModal,
    showProgressModal,
    openDownloadDialog,
    clearAudioCache,
    hardRefresh: handleHardRefresh,
  };
}
