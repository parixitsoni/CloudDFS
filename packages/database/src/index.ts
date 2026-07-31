import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import fs from "fs";

let dbInstance: PrismaClient;

const connectionUrl = process.env.DATABASE_URL || "file:./dev.db";

if (connectionUrl.startsWith("file:")) {
  let dbPath = connectionUrl.replace(/^file:/, "");
  if (!path.isAbsolute(dbPath)) {
    dbPath = path.resolve(__dirname, "..", dbPath);
  }
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  dbInstance = new PrismaClient({ adapter });
} else {
  // Direct connection for live remote database (e.g. PostgreSQL)
  dbInstance = new PrismaClient();
}

export const db = dbInstance;
export * from "@prisma/client";

