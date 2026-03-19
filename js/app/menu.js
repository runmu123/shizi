// 菜单和弹窗：登录、统计、进度、下载、缓存
import { state, cacheSuffix } from './state.js';
import { showToast } from '../utils/toast.js';
import { USER_KEY, AUDIO_CACHE_NAME } from './constants.js';
import { renderUnit, updateAppShell } from '../ui/ui.js';
import { clearProfilePageDataAfterLogout, refreshProfilePageDataAfterLogin, refreshProfilePageDataOnStartup } from './app.js';

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

    if (value && value >= 1 && value <= 500) {
      batchSize = value;
      modal.classList.remove('active');
      unlockScroll();
      startDownload(window.selectedDownloadLevels);
    } else {
      showToast('请输入1-500之间的数字', 'error');
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
            const cacheApi = window.ShiziAudioCache;
            const requestUrl = cacheApi?.buildRequestUrl
              ? cacheApi.buildRequestUrl(baseUrl, cacheSuffix)
              : baseUrl;
            const forceRefresh = !!cacheSuffix;

            if (cacheApi?.ensureCachedResponse) {
              await cacheApi.ensureCachedResponse({
                cacheName: AUDIO_CACHE_NAME,
                baseUrl,
                requestUrl,
                forceRefresh,
                fetchOptions: { cache: forceRefresh ? 'reload' : 'no-store' },
              });
            } else {
              await fetch(requestUrl, { cache: forceRefresh ? 'reload' : 'no-store' });
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
        status: '下载完成，语音已写入缓存',
      });
      hideTaskProgress(900);
      showToast('语音数据已下载至缓存', 'success');
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
        const cacheApi = window.ShiziAudioCache;
        const clearResult = cacheApi?.clearAudioCache
          ? await cacheApi.clearAudioCache({
            cacheName: AUDIO_CACHE_NAME,
            onInspectProgress: ({ current, total, percent }) => {
              setCacheClearProgress({
                percent,
                status: `正在统计缓存大小 ${current}/${total}`,
              });
            },
            onClearProgress: ({ current, total, percent }) => {
              setCacheClearProgress({
                percent,
                status: `正在清理缓存文件 ${current}/${total}`,
              });
            },
          })
          : { cleared: false, fileCount: 0, totalBytes: 0 };

        if (!clearResult.fileCount) {
          setCacheClearProgress({ percent: 100, status: '未发现可清理的语音缓存' });
          hideCacheClearProgress();
          showToast('未发现语音缓存', 'info');
          return;
        }

        const mb = (clearResult.totalBytes / 1024 / 1024).toFixed(2);
        setCacheClearProgress({ percent: 100, status: `清理完成，共清理 ${clearResult.fileCount} 个文件` });
        hideCacheClearProgress(900);
        showToast(`语音缓存已清理，共 ${clearResult.fileCount} 个文件，${mb} MB`, 'success');
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
      await refreshProfilePageDataOnStartup();

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
    openDownloadDialog,
    clearAudioCache,
    hardRefresh: handleHardRefresh,
  };
}
