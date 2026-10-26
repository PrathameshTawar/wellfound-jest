import { connectDB, closeDB, clearDB } from './helpers/dbHandler';

// Connect to in-memory database before all tests
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_jwt_secret_key_67890';
  await connectDB();
});

// Clear collections after each test to ensure test isolation
afterEach(async () => {
  await clearDB();
});

// Clean up and disconnect database after all tests complete
afterAll(async () => {
  await closeDB();
});
