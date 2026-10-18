import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { MongoClient, type Db } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

const DB_NAME = "attendanceapp";

type Cached = {
  client: MongoClient;
  db: Db;
  ready: Promise<void>;
};

declare global {
  var __attendanceDb: Cached | undefined;
  var __attendanceMemoryServer: MongoMemoryServer | undefined;
  var __attendanceShutdownHooked: boolean | undefined;
}

/**
 * Kill the mongod child when the Next.js server exits. Without this, a
 * server that is stopped (Ctrl+C, restart) can leave mongod running and the
 * next start fails with `DBPathInUse` on the lock file.
 */
function registerShutdownHook() {
  if (globalThis.__attendanceShutdownHooked) return;
  globalThis.__attendanceShutdownHooked = true;
  const stop = () => {
    const instance = globalThis.__attendanceMemoryServer;
    if (instance) {
      globalThis.__attendanceMemoryServer = undefined;
      void instance.stop();
    }
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  process.once("exit", stop);
}

async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("groups").createIndex({ nameKey: 1 }, { unique: true }),
    db.collection("users").createIndex({ nicknameKey: 1 }, { unique: true }),
    db.collection("users").createIndex({ groupId: 1 }),
    db
      .collection("attendance")
      .createIndex({ userId: 1, date: 1 }, { unique: true }),
    db.collection("attendance").createIndex({ date: 1, createdAt: 1 }),
    db.collection("admins").createIndex({ usernameKey: 1 }, { unique: true }),
  ]);
}

async function resolveUri(): Promise<string> {
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }
  // Local-only fallback: a real mongod process managed by mongodb-memory-server.
  // Default location is outside the project (and outside OneDrive sync) —
  // MongoDB data files must not be touched by a sync engine.
  if (!globalThis.__attendanceMemoryServer) {
    const dbPath =
      process.env.MONGODB_DB_PATH ??
      path.join(os.homedir(), ".attendanceapp", "db");
    await mkdir(dbPath, { recursive: true });
    globalThis.__attendanceMemoryServer = await MongoMemoryServer.create({
      instance: {
        dbPath,
        storageEngine: "wiredTiger",
      },
    });
    registerShutdownHook();
  }
  return globalThis.__attendanceMemoryServer.getUri(DB_NAME);
}

export async function getDb(): Promise<Db> {
  if (!globalThis.__attendanceDb) {
    const uri = await resolveUri();
    const client = new MongoClient(uri);
    const db = client.db(DB_NAME);
    const ready = client
      .connect()
      .then(() => ensureIndexes(db))
      .catch((err) => {
        // Drop the cached connection so the next request can retry cleanly.
        globalThis.__attendanceDb = undefined;
        throw err;
      });
    globalThis.__attendanceDb = { client, db, ready };
  }

  const cached = globalThis.__attendanceDb;
  await cached.ready;
  return cached.db;
}
