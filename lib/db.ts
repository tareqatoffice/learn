import mongoose, { type ClientSession } from "mongoose";
import { getEnv } from "@/lib/env";

type Cache = { promise?: Promise<typeof mongoose> };

const globalForMongoose = globalThis as typeof globalThis & { _mongooseCache?: Cache };
const cache: Cache = (globalForMongoose._mongooseCache ??= {});

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

export async function inTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

const isDuplicateKey = (error: unknown) => error instanceof mongoose.mongo.MongoServerError && error.code === 11000;

export async function retryOnDuplicateKey<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    return write();
  }
}
