import mongoose from "mongoose";

let supportPromise: Promise<boolean> | null = null;

/** Transactions need a replica set or mongos; a standalone mongod rejects them. */
function transactionsSupported(): Promise<boolean> {
  if (!supportPromise) {
    supportPromise = (async () => {
      try {
        const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
        const supported = Boolean(hello.setName) || hello.msg === "isdbgrid";
        if (!supported) {
          // eslint-disable-next-line no-console
          console.warn(
            "[db] MongoDB is a standalone server — multi-document writes run without a transaction. " +
              "Run mongod as a replica set (--replSet) to make them atomic."
          );
        }
        return supported;
      } catch {
        supportPromise = null; // retry detection on the next call
        return false;
      }
    })();
  }
  return supportPromise;
}

/**
 * Runs `fn` inside a transaction when the server supports one; otherwise runs it with no session
 * so the writes still succeed (just not atomically) instead of failing every request.
 */
export async function runInTransaction<T>(
  fn: (session: mongoose.ClientSession | undefined) => Promise<T>
): Promise<T> {
  if (!(await transactionsSupported())) return fn(undefined);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
}
