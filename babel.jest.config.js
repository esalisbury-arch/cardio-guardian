// Separate, minimal babel config for the pure src/signal/* unit tests only.
// Deliberately does NOT use module:@react-native/babel-preset — those tests
// have no RN/JSX/worklet code, so a plain TS-to-Node transform is enough
// and keeps `npm test` runnable without a full RN native environment.
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }], '@babel/preset-typescript'],
};
