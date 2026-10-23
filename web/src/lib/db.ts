import mongoose from "mongoose";
import { getEnv } from "@/lib/env";

type Cache = { conn?: typeof mongoose; promise?: Promise<typeof mongoose> };

const globalForMongoose = globalThis as typeof globalThis & { _mongooseCache?: Cache };
const cache: Cache = (globalForMongoose._mongooseCache ??= {});

/** Connects once per process; cached on `globalThis` so hot reload reuses the connection. */
export async function connectDb(): Promise<typeof mongoose> {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;
  cache.promise = mongoose.connect(getEnv().MONGODB_URI);
  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = undefined;
    throw error;
  }
  return cache.conn;
}

const isDuplicateKey = (error: unknown) => error instanceof mongoose.mongo.MongoServerError && error.code === 11000;

/**
 * Runs an upsert keyed on a unique index, once more if it loses a race: two first writes can
 * both miss and both insert, and the loser's E11000 retry then matches the winner's doc.
 */
export async function retryOnDuplicateKey<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    return write();
  }
}
