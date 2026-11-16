import mongoose from "mongoose";

/**
 * A message safe to show an admin: our own thrown errors keep theirs, while database errors (which
 * can quote collection names, indexes and values) are logged and replaced by `fallback`.
 */
export function publicMessage(error: unknown, fallback: string): string {
  if (error instanceof mongoose.mongo.MongoError || error instanceof mongoose.Error) {
    console.error(`${fallback}: ${error.name}: ${error.message}`);
    return fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
