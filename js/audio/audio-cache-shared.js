(function initShiziAudioCache(global) {
  const DEFAULT_AUDIO_CACHE_NAME = 'shizi-audio-cache';

  function getConfiguredDefaultCacheName() {
    return global.ShiziConstants?.AUDIO_CACHE_NAME || DEFAULT_AUDIO_CACHE_NAME;
  }

  function resolveCacheName(cacheName) {
    return cacheName || getConfiguredDefaultCacheName();
  }

  function buildRequestUrl(baseUrl, suffix = '') {
    const normalizedSuffix = suffix ? String(suffix).replace(/^\?/, '') : '';
    if (!normalizedSuffix) return baseUrl;
    return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${normalizedSuffix}`;
  }

  async function openCache(cacheName) {
    if (!('caches' in global)) return null;
    try {
      return await caches.open(resolveCacheName(cacheName));
    } catch (error) {
      console.warn('打开音频缓存失败:', error);
      return null;
    }
  }

  async function ensureCachedResponse({
    cacheName,
    baseUrl,
    requestUrl,
    forceRefresh = false,
    fetchOptions = null,
  }) {
    if (!baseUrl) return null;

    const finalRequestUrl = requestUrl || baseUrl;
    const cache = await openCache(cacheName);
    const request = new Request(baseUrl);

    if (cache && !forceRefresh) {
      const cached = await cache.match(request);
      if (cached) {
        return { response: cached.clone(), fromCache: true };
      }
    } else if (cache && forceRefresh) {
      await cache.delete(request);
    }

    try {
      const response = await fetch(
        finalRequestUrl,
        fetchOptions || { cache: forceRefresh ? 'reload' : 'no-store' },
      );
      if (!response.ok) return null;

      if (cache) {
        await cache.put(request, response.clone());
      }

      return { response: response.clone(), fromCache: false };
    } catch (error) {
      console.warn('写入音频缓存失败:', error);
      return null;
    }
  }

  async function clearAudioCache({
    cacheName,
    onInspectProgress,
    onClearProgress,
  } = {}) {
    const targetCacheName = resolveCacheName(cacheName);
    const cache = await openCache(targetCacheName);
    if (!cache) {
      return { cleared: false, fileCount: 0, totalBytes: 0 };
    }

    const keys = await cache.keys();
    if (!keys.length) {
      return { cleared: true, fileCount: 0, totalBytes: 0 };
    }

    let totalBytes = 0;
    for (let index = 0; index < keys.length; index += 1) {
      const request = keys[index];
      const response = await cache.match(request);
      if (response) {
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          totalBytes += parseInt(contentLength, 10);
        } else {
          const buffer = await response.arrayBuffer();
          totalBytes += buffer.byteLength;
        }
      }

      onInspectProgress?.({
        current: index + 1,
        total: keys.length,
        percent: 5 + (((index + 1) / keys.length) * 25),
      });
    }

    for (let index = 0; index < keys.length; index += 1) {
      await cache.delete(keys[index]);
      onClearProgress?.({
        current: index + 1,
        total: keys.length,
        percent: 30 + (((index + 1) / keys.length) * 70),
      });
    }

    await caches.delete(targetCacheName);
    return {
      cleared: true,
      fileCount: keys.length,
      totalBytes,
    };
  }

  global.ShiziAudioCache = {
    DEFAULT_AUDIO_CACHE_NAME,
    buildRequestUrl,
    openCache,
    ensureCachedResponse,
    clearAudioCache,
  };
})(window);
