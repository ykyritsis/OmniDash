/**
 * Metro config for the demo bundle.
 *
 * The Xbox app is React Native Windows 0.76.5, so the bundle is built with the
 * matching react-native preset and with 'windows' added to the platform list so
 * Metro resolves any .windows.js overrides.
 */
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const base = getDefaultConfig(__dirname);

const config = {
  resolver: {
    platforms: [...new Set([...(base.resolver.platforms || []), 'windows', 'native'])],
  },
};

module.exports = mergeConfig(base, config);
