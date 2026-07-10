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

      // Check if the fmt fix is already present
      if (podfileContent.includes('FMT_USE_CONSTEVAL')) {
        console.log('ℹ️  fmt consteval fix already present in Podfile');
        return config;
      }

      // Patch that directly modifies fmt/base.h to disable FMT_USE_CONSTEVAL
      // This runs inside post_install (after pods are downloaded), so the files exist
      const fmtFix = `
  # ── Fix for Xcode 26: disable consteval in fmt library ──
  # Xcode 26's Clang incorrectly handles FMT_USE_CONSTEVAL with the bundled fmt version.
  # We patch the source header directly AND force C++17 as a belt-and-suspenders fix.
  fmt_base_paths = [
    File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h'),
    File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'core.h'),
  ]
  fmt_base_paths.each do |fmt_path|
    if File.exist?(fmt_path)
      content = File.read(fmt_path)
      # Replace FMT_USE_CONSTEVAL 1 with 0 to disable consteval
      patched = content.gsub(/^(\\s*#\\s*define FMT_USE_CONSTEVAL)\\s+1/, '\\\\1 0')
      if patched != content
        File.chmod(0644, fmt_path)
        File.write(fmt_path, patched)
        Pod::UI.puts "Patched \#{fmt_path} to disable FMT_USE_CONSTEVAL"
      end
    end
  end
  installer.pods_project.targets.each do |target|
    if target.name == 'fmt'
      target.build_configurations.each do |bc|
        bc.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        bc.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
        bc.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FMT_USE_CONSTEVAL=0'
      end
    end
  end
  # ── End fmt fix ──
`;

      // Find and inject into post_install block
      const postInstallPattern = /post_install\s+do\s+\|installer\|/;
      
      if (postInstallPattern.test(podfileContent)) {
        podfileContent = podfileContent.replace(
          postInstallPattern,
          (match) => `${match}${fmtFix}`
        );
        fs.writeFileSync(podfilePath, podfileContent);
        console.log('✅ Injected fmt consteval fix (source patch + C++17 + preprocessor) in Podfile');
      } else {
        console.error('❌ Could not find post_install block in Podfile!');
        // Log the first 500 chars of Podfile for debugging
        console.error('Podfile starts with:', podfileContent.substring(0, 500));
      }

      return config;
    },
  ]);
};

module.exports = withPodfileFmtFix;
