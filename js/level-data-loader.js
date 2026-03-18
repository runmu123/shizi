import { state, cacheSuffix } from './state.js';

function buildLevelYamlUrl(level) {
  return `yaml/contents_${level}.yaml${cacheSuffix}`;
}

function parseLevelYaml(text, level, throwOnError) {
  try {
    if (!window.jsyaml) {
      throw new Error('jsyaml 未加载');
    }
    const data = jsyaml.load(text);
    if (!data || typeof data !== 'object') {
      throw new Error('YAML 数据为空或无效');
    }
    return data;
  } catch (error) {
    if (throwOnError) throw error;
    console.warn('解析 YAML 失败:', level, error);
    return null;
  }
}

export async function loadLevelData(level, options = {}) {
  const {
    forceReload = false,
    throwOnError = false,
    fetchOptions = null,
  } = options;

  if (!level) return null;
  if (!forceReload && state.levelDataCache[level]) {
    return state.levelDataCache[level];
  }

  const requestOptions = fetchOptions || (forceReload ? { cache: 'no-store' } : undefined);
  const response = await fetch(buildLevelYamlUrl(level), requestOptions);
  if (!response.ok) {
    if (throwOnError) {
      throw new Error(`HTTP 错误! 状态码: ${response.status}`);
    }
    return null;
  }

  const text = await response.text();
  const data = parseLevelYaml(text, level, throwOnError);
  if (!data) return null;

  state.levelDataCache[level] = data;
  return data;
}
