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
