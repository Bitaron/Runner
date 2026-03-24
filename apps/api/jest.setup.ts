// Jest setup file for API tests
// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.COUCHDB_URL = 'http://localhost:5984';
process.env.COUCHDB_DATABASE = 'apiforge_test';

// Suppress console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Increase timeout for database operations
jest.setTimeout(10000);

// Clean up after all tests
afterAll(async () => {
  // Allow pending async operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});
