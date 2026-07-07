const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withPodfileFmtFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return config;

      let podfileContent = fs.readFileSync(podfilePath, 'utf-8');

      // Check if the fmt post_install fix is already present
      if (!podfileContent.includes("target.name == 'fmt'")) {
        const fmtFix = `
  # Fix for Xcode fmt consteval build error (C++17 for fmt)
  installer.pods_project.targets.each do |target|
    if target.name == 'fmt'
      target.build_configurations.each do |config|
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
    end
  end
`;

        // Inject the fix right after post_install do |installer|
        if (podfileContent.includes('post_install do |installer|')) {
          podfileContent = podfileContent.replace(
            /post_install do \|installer\|/,
            `post_install do |installer|${fmtFix}`
          );
          fs.writeFileSync(podfilePath, podfileContent);
          console.log('✅ Injected C++17 language standard patch for fmt in Podfile');
        }
      }

      return config;
    },
  ]);
};

module.exports = withPodfileFmtFix;
