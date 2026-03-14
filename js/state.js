// 共享可变状态
const forceRefreshTokenKey = 'shizi_force_refresh_token';
const urlToken = new URLSearchParams(window.location.search).get('t');
const sessionToken = sessionStorage.getItem(forceRefreshTokenKey);
const refreshToken = urlToken || sessionToken || '';

if (sessionToken) {
  sessionStorage.removeItem(forceRefreshTokenKey);
}

export const cacheSuffix = refreshToken ? `?t=${encodeURIComponent(refreshToken)}` : '';

export const state = {
  LEVELS: [],
  currentLevel: 'L0',
  currentData: null,
  levelDataCache: {},
  unitKeys: [],
  currentUnitIndex: 0,
  appSection: 'home',
  homeCardIndex: 0,
  homeCardMotion: 'none',
  isTeachingMode: false,
  mainViewMode: 'study',
  isLoopingAudio: false,
  writer: null,
  currentMode: 'animate',
  currentStroke: 0,
  totalStrokes: 0,
  listenMode: {
    unitName: '',
    sequence: [],
    questions: [],
    currentIndex: 0,
    options: [],
    mistakeChars: [],
    firstTryCorrectChars: [],
    answeredChars: [],
    currentMistaken: false,
  },
  seeMode: {
    unitName: '',
    sequence: [],
    questions: [],
    currentIndex: 0,
    options: [],
    mistakeChars: [],
    firstTryCorrectChars: [],
    answeredChars: [],
    currentMistaken: false,
  },
};
