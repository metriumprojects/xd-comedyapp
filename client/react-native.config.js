// Disable React Native CLI autolinking for @sentry/react-native on Android.
// Sentry is excluded from BOTH autolinking systems to avoid conflicts:
//   1. RN CLI autolinking: disabled here (prevents duplicate Gradle projects)
//   2. Expo autolinking: excluded in app.json (expo-handler/SentryExpoPackage is for SDK 53+)
// Sentry's native setup is handled by the config plugin (@sentry/react-native/expo)
// and sentry.gradle.kts applied in android/app/build.gradle.
module.exports = {
  dependencies: {
    '@sentry/react-native': {
      platforms: {
        android: null, // Disable RN CLI autolinking on Android; Expo handles it
      },
    },
  },
};
