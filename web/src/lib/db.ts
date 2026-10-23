import mongoose, { type ClientSession } from "mongoose";
import { getEnv } from "@/lib/env";

type Cache = { promise?: Promise<typeof mongoose> };

const globalForMongoose = globalThis as typeof globalThis & { _mongooseCache?: Cache };
const cache: Cache = (globalForMongoose._mongooseCache ??= {});

/**
 * Connects once per process; cached on `globalThis` so hot reload reuses the connection. After a
 * dropped connection the driver reconnects on its own, and calling `mongoose.connect()` again would
 * open a second client and leak the first, so only a failed connect or an explicit close (scripts,
 * tests) clears the cache.
 */
export function connectDb(): Promise<typeof mongoose> {
  cache.promise ??= mongoose.connect(getEnv().MONGODB_URI).then(
    (connected) => {
      connected.connection.once("close", () => {
        cache.promise = undefined;
      });
      return connected;
    },
    (error: unknown) => {
      cache.promise = undefined;
      throw error;
    },
  );
  return cache.promise;
}

/** Runs `work` in one transaction (the database is a replica set) and returns its result. */
export async function inTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    // The driver may retry the callback on a transient error; the last run's result wins.
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
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
