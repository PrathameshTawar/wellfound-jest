import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer | null = null;

/**
 * Connect to either an in-memory MongoDB instance or specified MONGO_URI
 */
export const connectDB = async (): Promise<void> => {
  // If already connected, skip
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // Use external Mongo URI only if specifically flagged
  if (process.env.USE_LIVE_DB && process.env.MONGO_URI) {
    await mongoose.connect(process.env.MONGO_URI);
    return;
  }

  // Spin up in-memory MongoDB instance for hermetic testing
  if (!mongod) {
    mongod = await MongoMemoryServer.create();
  }
  const uri = mongod.getUri();
  await mongoose.connect(uri);
};

/**
 * Disconnect and stop the in-memory MongoDB instance
 */
export const closeDB = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
};

/**
 * Clear all data from all collections to guarantee isolation between tests
 */
export const clearDB = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  }
};
