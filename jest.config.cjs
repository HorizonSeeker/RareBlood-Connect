module.exports = {
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { configFile: './babel.jest.config.cjs' }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  testEnvironment: 'node',
  transformIgnorePatterns: ['/node_modules/']
};
