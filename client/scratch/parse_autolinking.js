const { execSync } = require('child_process');

try {
  const output = execSync('npx expo-modules-autolinking resolve --platform android --json', { encoding: 'utf8' });
  const hasExpoSentry = output.includes('sentry-react-native-expo');
  console.log('Is sentry-react-native-expo in output?', hasExpoSentry);
  
  if (hasExpoSentry) {
    const data = JSON.parse(output);
    // Find where it is
    console.log('Searching JSON keys...');
    for (const key of Object.keys(data)) {
      const items = data[key];
      if (Array.isArray(items)) {
        const found = items.filter(item => JSON.stringify(item).includes('sentry-react-native-expo'));
        if (found.length > 0) {
          console.log(`Found in key "${key}":`, JSON.stringify(found, null, 2));
        }
      }
    }
  }
} catch (error) {
  console.error('Error running script:', error.message);
}
