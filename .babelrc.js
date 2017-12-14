const { NODE_ENV = 'development' } = process.env
const __PROD__ = NODE_ENV === 'production'
const __TEST__ = NODE_ENV === 'test'

module.exports = {
  comments: !__PROD__,
  compact: __PROD__,
  ignore: __TEST__ ? undefined : [ /\.spec\.js$/ ],
  plugins: [
    '@babel/plugin-proposal-decorators',
    '@babel/plugin-proposal-export-default-from',
    '@babel/plugin-proposal-export-namespace-from',
    '@babel/plugin-proposal-function-bind',
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-proposal-pipeline-operator',
    'lodash',
  ],
  presets: [
    [
      '@babel/env',
      {
        debug: !__TEST__,
        loose: true,
        shippedProposals: true,
        targets: __PROD__
          ? { node: '6' }
          : { node: 'current' },
        useBuiltIns: 'usage',
      },
    ],
    '@babel/flow',
  ],
}
