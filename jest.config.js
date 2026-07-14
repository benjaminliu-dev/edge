/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // This stops Jest from scanning your compiled build output
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};
