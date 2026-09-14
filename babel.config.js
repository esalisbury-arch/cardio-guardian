// Used by Metro to bundle the actual app. The worklets-core plugin is
// required for VisionCamera's 'worklet' frame processor functions
// (src/sensors/ppgCamera.ts) to compile correctly.
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-worklets-core/plugin'],
};
