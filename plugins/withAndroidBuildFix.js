// Config plugin: Fix Android build compatibility
// 1. Ensure compatible dependency resolution for Expo SDK 55
// 2. Pin Gradle version to 8.13 (Gradle 9.x has foojay-resolver incompatibility)
// 3. Remove foojay-resolver plugin from settings.gradle
const {
  withAppBuildGradle,
  withSettingsGradle,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/** Update the app-level build.gradle */
function updateAppBuildGradle(buildGradle) {
  // Force compatible versions that work with compileSdk 36
  const resolutionBlock = `
    configurations.all {
        resolutionStrategy {
            force 'androidx.activity:activity:1.11.0'
            force 'androidx.activity:activity-ktx:1.11.0'
            force 'androidx.core:core:1.17.0'
            force 'androidx.core:core-ktx:1.17.0'
        }
    }
  `;

  // Only add if not already present
  if (!buildGradle.includes("force 'androidx.activity:activity:1.11.0'")) {
    // Remove any old resolution blocks
    buildGradle = buildGradle.replace(
      /configurations\.all\s*\{\s*resolutionStrategy\s*\{[^}]*\}\s*\}/g,
      ''
    );

    // Insert after 'android {' declaration
    buildGradle = buildGradle.replace(
      /android\s*\{/,
      `android {\n${resolutionBlock}`
    );
  }

  return buildGradle;
}

/**
 * Remove the foojay-resolver plugin from settings.gradle
 * This plugin is incompatible with Gradle 9.x (missing IBM_SEMERU field)
 */
function updateSettingsGradle(settingsGradle) {
  // Remove the foojay-resolver plugin lines
  settingsGradle = settingsGradle.replace(
    /id\s*["']org\.gradle\.toolchains\.foojay-resolver-convention["']\s*version\s*["'][^"']*["'][^\n]*/g,
    ''
  );
  settingsGradle = settingsGradle.replace(
    /id\("org\.gradle\.toolchains\.foojay-resolver-convention"\)\s*version\s*\("[^"]*"\)[^\n]*/g,
    ''
  );
  return settingsGradle;
}

/**
 * Pin Gradle wrapper to 8.13 to avoid Gradle 9.x / foojay-resolver incompatibility.
 * The AGP used by React Native 0.83.x requires minimum Gradle 8.13.
 */
function pinGradleVersion(projectRoot) {
  // Try multiple possible paths for the gradle-wrapper.properties
  const possiblePaths = [
    path.join(projectRoot, 'gradle', 'wrapper', 'gradle-wrapper.properties'),
    path.join(projectRoot, 'android', 'gradle', 'wrapper', 'gradle-wrapper.properties'),
  ];

  for (const gradleWrapperPropsPath of possiblePaths) {
    if (fs.existsSync(gradleWrapperPropsPath)) {
      let content = fs.readFileSync(gradleWrapperPropsPath, 'utf8');
      // Replace any gradle version with 8.13
      content = content.replace(
        /distributionUrl=https\\:\/\/services\.gradle\.org\/distributions\/gradle-[0-9.]+-(bin|all)\.zip/,
        'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.13-bin.zip'
      );
      fs.writeFileSync(gradleWrapperPropsPath, content, 'utf8');
      break;
    }
  }
}

module.exports = function withAndroidBuildFix(config) {
  // 1. Fix app build.gradle
  config = withAppBuildGradle(config, (modConfig) => {
    modConfig.modResults.contents = updateAppBuildGradle(
      modConfig.modResults.contents
    );
    return modConfig;
  });

  // 2. Remove foojay-resolver from settings.gradle
  config = withSettingsGradle(config, (modConfig) => {
    modConfig.modResults.contents = updateSettingsGradle(
      modConfig.modResults.contents
    );
    return modConfig;
  });

  // 3. Pin Gradle version to 8.13 after prebuild creates android directory
  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      // platformProjectRoot points to the android directory inside the build
      const projectRoot = modConfig.platformProjectRoot || modConfig.modRequest.platformProjectRoot;
      if (projectRoot) {
        pinGradleVersion(projectRoot);
      }
      return modConfig;
    },
  ]);

  return config;
};
