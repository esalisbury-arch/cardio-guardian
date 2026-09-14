// Covers the pure, RN-free signal-processing core in src/signal/*.
// Once native modules (camera/sensors/UI) are added under src/sensors,
// src/services, and src/screens, add the standard `react-native` preset
// and mock native modules for those suites separately.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['babel-jest', { configFile: './babel.jest.config.js' }],
  },
};
