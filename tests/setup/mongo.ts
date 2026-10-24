import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

let replSet: MongoMemoryReplSet | undefined;

/** Vitest global setup: one in-memory replica set (transactions need one) per run. */
export async function setup(): Promise<void> {
  replSet = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" }, // match docker mongo:7
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  process.env.MONGODB_URI = replSet.getUri("learn_test");
}

export async function teardown(): Promise<void> {
  await mongoose.disconnect();
  await replSet?.stop();
  replSet = undefined;
}

/**
 * Empties every collection between tests. Documents are removed rather than
 * collections dropped so unique/other indexes survive for later tests.
 */
export async function resetDb(): Promise<void> {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI!);
  }
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}
