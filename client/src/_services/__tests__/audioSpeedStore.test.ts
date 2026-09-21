import {
  getGlobalAudioSpeed,
  setGlobalAudioSpeed,
  cycleAudioSpeed,
  formatAudioSpeed,
} from '../../media/audioSpeedStore';

describe('audioSpeedStore', () => {
  beforeEach(() => {
    setGlobalAudioSpeed(1);
  });

  describe('formatAudioSpeed', () => {
    it('formats 1 as 1x', () => {
      expect(formatAudioSpeed(1)).toBe('1x');
    });

    it('formats 1.5 as 1.5x', () => {
      expect(formatAudioSpeed(1.5)).toBe('1.5x');
    });

    it('formats 2 as 2x', () => {
      expect(formatAudioSpeed(2)).toBe('2x');
    });
  });

  describe('cycleAudioSpeed', () => {
    it('cycles from 1x to 1.5x', () => {
      expect(cycleAudioSpeed(1)).toBe(1.5);
    });

    it('cycles from 1.5x to 2x', () => {
      expect(cycleAudioSpeed(1.5)).toBe(2);
    });

    it('cycles from 2x back to 1x', () => {
      expect(cycleAudioSpeed(2)).toBe(1);
    });

    it('uses currentGlobalSpeed when no argument is passed', () => {
      setGlobalAudioSpeed(1);
      const next1 = cycleAudioSpeed();
      expect(next1).toBe(1.5);
      expect(getGlobalAudioSpeed()).toBe(1.5);

      const next2 = cycleAudioSpeed();
      expect(next2).toBe(2);
      expect(getGlobalAudioSpeed()).toBe(2);

      const next3 = cycleAudioSpeed();
      expect(next3).toBe(1);
      expect(getGlobalAudioSpeed()).toBe(1);
    });
  });

  describe('getGlobalAudioSpeed and setGlobalAudioSpeed', () => {
    it('updates and returns the global audio speed', () => {
      expect(getGlobalAudioSpeed()).toBe(1);
      setGlobalAudioSpeed(1.5);
      expect(getGlobalAudioSpeed()).toBe(1.5);
      setGlobalAudioSpeed(2);
      expect(getGlobalAudioSpeed()).toBe(2);
    });
  });
});
