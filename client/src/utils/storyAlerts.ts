import { Alert } from 'react-native';

/** Prevent stacked "unavailable" dialogs from one tap (re-renders, dual handlers, retries). */
let lastShownAt = 0;
let lastKey = '';

const DEDUPE_MS = 3500;

function shouldShow(keyRaw: string): boolean {
  const key = String(keyRaw || '').trim() || '_';
  const now = Date.now();
  if (key === lastKey && now - lastShownAt < DEDUPE_MS) return false;
  if (now - lastShownAt < 800) return false;
  lastKey = key;
  lastShownAt = now;
  return true;
}

export function showStoryUnavailableAlert(storyOrKey?: string | null) {
  if (!shouldShow(`story:${storyOrKey || '_'}`)) return;
  Alert.alert(
    'Story Expired',
    'This story has expired and is no longer available.',
    [{ text: 'OK' }]
  );
}

export function showPostUnavailableAlert(
  postOrKey?: string | null,
  onOk?: () => void
) {
  if (!shouldShow(`post:${postOrKey || '_'}`)) return;
  Alert.alert(
    'Post Unavailable',
    'This post is no longer available or has been deleted.',
    [{ text: 'OK', onPress: () => { try { onOk?.(); } catch {} } }]
  );
}
