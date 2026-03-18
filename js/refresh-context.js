(function initShiziRefresh(global) {
  const FORCE_REFRESH_TOKEN_KEY = 'shizi_force_refresh_token';

  function buildCacheSuffix(token) {
    const normalizedToken = String(token || '').trim();
    return normalizedToken ? `?t=${encodeURIComponent(normalizedToken)}` : '';
  }

  function getRefreshContext(options) {
    const { ensureLocalDevToken = false, consumeSessionToken = false } = options || {};
    const isLocalDev = ['localhost', '127.0.0.1'].includes(global.location.hostname);
    const urlToken = new URLSearchParams(global.location.search).get('t');

    let sessionToken = '';
    try {
      sessionToken = global.sessionStorage.getItem(FORCE_REFRESH_TOKEN_KEY) || '';
      if (!urlToken && !sessionToken && ensureLocalDevToken && isLocalDev) {
        sessionToken = `${Date.now()}`;
        global.sessionStorage.setItem(FORCE_REFRESH_TOKEN_KEY, sessionToken);
      }
      if (consumeSessionToken && sessionToken) {
        global.sessionStorage.removeItem(FORCE_REFRESH_TOKEN_KEY);
      }
    } catch (error) {
      console.warn('读取刷新 token 失败:', error);
    }

    const refreshToken = urlToken || sessionToken || '';
    return {
      forceRefreshTokenKey: FORCE_REFRESH_TOKEN_KEY,
      urlToken,
      sessionToken,
      refreshToken,
      shouldForceRefresh: !!refreshToken,
      cacheSuffix: buildCacheSuffix(refreshToken),
    };
  }

  function createRefreshToken() {
    return `${Date.now()}`;
  }

  function storeRefreshToken(token) {
    global.sessionStorage.setItem(FORCE_REFRESH_TOKEN_KEY, String(token || ''));
  }

  function buildHardRefreshUrl(token) {
    return `${global.location.pathname}?t=${encodeURIComponent(token)}${global.location.hash || ''}`;
  }

  global.ShiziRefresh = {
    FORCE_REFRESH_TOKEN_KEY,
    buildCacheSuffix,
    getRefreshContext,
    createRefreshToken,
    storeRefreshToken,
    buildHardRefreshUrl,
  };
})(window);
