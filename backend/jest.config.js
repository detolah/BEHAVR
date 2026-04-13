module.exports = {
  testEnvironment: 'node',
  setupFilesAfterFramework: ['./tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  coverageDirectory: 'coverage',
};
