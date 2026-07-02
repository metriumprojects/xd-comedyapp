export default ({ config }) => {
  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyCQ1Fe55xOwt9fFfAiGIDVoEt01i2hL-zs"
        }
      }
    },
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyCQ1Fe55xOwt9fFfAiGIDVoEt01i2hL-zs"
      }
    }
  };
};
