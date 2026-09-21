import { Platform } from 'react-native';
import { useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context';

/**
 * Hook to provide synchronous, rock-solid safe area insets.
 * Prevents the notorious iOS navigation transition glitch where native `RNCSafeAreaView`
 * delays insets by ~300-1000ms until UIKit completes layoutSubviews, causing screen
 * headers to slide underneath the iPhone notch / Dynamic Island and then jump down.
 */
export function useSafeHeaderInsets() {
  const insets = useSafeAreaInsets();

  const fallbackTop = (initialWindowMetrics?.insets?.top && initialWindowMetrics.insets.top > 0)
    ? initialWindowMetrics.insets.top
    : (Platform.OS === 'ios' ? 47 : 0);

  const fallbackBottom = (initialWindowMetrics?.insets?.bottom && initialWindowMetrics.insets.bottom > 0)
    ? initialWindowMetrics.insets.bottom
    : (Platform.OS === 'ios' ? 34 : 0);

  const safeTop = insets.top > 0 ? insets.top : fallbackTop;
  const safeBottom = insets.bottom > 0 ? insets.bottom : fallbackBottom;

  return {
    top: safeTop,
    bottom: safeBottom,
    left: insets.left,
    right: insets.right,
    insets,
  };
}
