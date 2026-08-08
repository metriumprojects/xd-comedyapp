import { lightTheme } from './colors';

/**
 * Global Theme Hook
 * Single hook for components to access central theme tokens.
 */
export function useTheme() {
  return {
    colors: lightTheme,
    isDark: false,
  };
}

export default useTheme;
