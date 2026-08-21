import mongoose from "mongoose";
import { env } from "./env";

export async function connectMongo() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongodbUri);
  // eslint-disable-next-line no-console
  console.log("Connected to MongoDB");
}

export async function disconnectMongo() {
  await mongoose.disconnect();
}

export { mongoose };
