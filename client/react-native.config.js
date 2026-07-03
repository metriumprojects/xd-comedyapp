// Disable React Native CLI autolinking for @sentry/react-native on Android.
// Expo autolinking already includes this package via expo-module.config.json.
// Having BOTH creates two Gradle projects (:sentry-react-native and :sentry_react-native)
// that share the same android/build directory, causing file lock conflicts.
module.exports = {
  dependencies: {
    '@sentry/react-native': {
      platforms: {
        android: null, // Disable RN CLI autolinking on Android; Expo handles it
      },
    },
  },
};
