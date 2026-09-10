/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {}],
  },
  testEnvironment: 'node',
  // This stops Jest from scanning your compiled build output
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};
