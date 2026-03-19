export function isHomeStudyStage(state) {
  return state.appSection === 'home' && state.mainViewMode === 'study';
}

export function handleHomeCardSelection({ state, chars, targetChar, navigateHomeCard }) {
  if (!targetChar || !Array.isArray(chars) || !chars.length) return false;
  const nextIndex = chars.indexOf(targetChar);
  if (nextIndex === -1) return false;
  navigateHomeCard(nextIndex, nextIndex > state.homeCardIndex ? 'next' : 'prev');
  return true;
}

export function handleHomeCardKeyboard({ event, isActive, navigateHomeCardByOffset }) {
  if (!isActive) return false;
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    navigateHomeCardByOffset(-1);
    return true;
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    navigateHomeCardByOffset(1);
    return true;
  }
  return false;
}

export function handleHomeCardSwipe({ deltaX, deltaY, navigateHomeCardByOffset, threshold = 40 }) {
  if (Math.abs(deltaX) < threshold || Math.abs(deltaX) <= Math.abs(deltaY)) return false;
  navigateHomeCardByOffset(deltaX > 0 ? -1 : 1);
  return true;
}
