import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AudioSpeed = 1 | 1.5 | 2;

const STORAGE_KEY = 'chat_voice_playback_speed';
let currentGlobalSpeed: AudioSpeed = 1;
const listeners = new Set<(speed: AudioSpeed) => void>();

// Initialize from AsyncStorage if available
AsyncStorage.getItem(STORAGE_KEY).then((val) => {
  if (val) {
    const parsed = parseFloat(val);
    if (parsed === 1 || parsed === 1.5 || parsed === 2) {
      currentGlobalSpeed = parsed as AudioSpeed;
      listeners.forEach((fn) => fn(currentGlobalSpeed));
    }
  }
}).catch(() => {});

export function getGlobalAudioSpeed(): AudioSpeed {
  return currentGlobalSpeed;
}

export function setGlobalAudioSpeed(speed: AudioSpeed): void {
  currentGlobalSpeed = speed;
  listeners.forEach((fn) => fn(speed));
  AsyncStorage.setItem(STORAGE_KEY, String(speed)).catch(() => {});
}

export function cycleAudioSpeed(current: AudioSpeed = currentGlobalSpeed): AudioSpeed {
  let next: AudioSpeed = 1;
  if (current === 1) next = 1.5;
  else if (current === 1.5) next = 2;
  else next = 1;

  setGlobalAudioSpeed(next);
  return next;
}

export function formatAudioSpeed(speed: AudioSpeed): string {
  if (speed === 1.5) return '1.5x';
  if (speed === 2) return '2x';
  return '1x';
}

export function useAudioSpeed() {
  const [speed, setSpeedState] = useState<AudioSpeed>(getGlobalAudioSpeed);

  useEffect(() => {
    const handler = (newSpeed: AudioSpeed) => {
      setSpeedState(newSpeed);
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const cycleSpeed = useCallback(() => {
    return cycleAudioSpeed(currentGlobalSpeed);
  }, []);

  const setSpeed = useCallback((newSpeed: AudioSpeed) => {
    setGlobalAudioSpeed(newSpeed);
  }, []);

  return {
    speed,
    speedLabel: formatAudioSpeed(speed),
    cycleSpeed,
    setSpeed,
  };
}
