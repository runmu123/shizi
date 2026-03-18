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
  profileView: 'main',
  homeCardIndex: 0,
  homeCardMotion: 'none',
  notebook: {
    items: [],
    loading: false,
    error: '',
    loadedUser: '',
    expandedSections: {
      listen: false,
      see: false,
    },
    expandedLevels: {
      listen: {},
      see: {},
    },
    reviewMode: 'listen',
    reviewLevel: '',
    reviewGroupIndex: 0,
    reviewCardIndex: 0,
    reviewMotion: 'none',
    practice: {
      mode: 'listen',
      level: '',
      groupIndex: 0,
      allowRemoval: true,
      title: '',
      sourceItems: [],
      sequence: [],
      questions: [],
      currentIndex: 0,
      answeredChars: [],
      currentMistaken: false,
    },
  },
  profileProgress: {
    expanded: false,
    loading: false,
    error: '',
    loadedUser: '',
    total: 0,
    grouped: {},
  },
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
