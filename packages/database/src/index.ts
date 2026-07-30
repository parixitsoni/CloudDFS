import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import fs from "fs";

let dbPath = path.resolve(__dirname, "../dev.db");

if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("file:")) {
  dbPath = process.env.DATABASE_URL.replace(/^file:/, "");
}

// Ensure the directory exists before initializing SQLite
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const adapter = new PrismaBetterSqlite3({ url: dbPath });

export const db = new PrismaClient({ adapter });
export * from "@prisma/client";
