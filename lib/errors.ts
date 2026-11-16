import mongoose from "mongoose";

export function publicMessage(error: unknown, fallback: string): string {
  if (error instanceof mongoose.mongo.MongoError || error instanceof mongoose.Error) {
    console.error(`${fallback}: ${error.name}: ${error.message}`);
    return fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
