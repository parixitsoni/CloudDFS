import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import fs from "fs";

const rawUrl = process.env.DATABASE_URL || "file:./dev.db";
let dbPath = rawUrl.startsWith("file:") ? rawUrl.replace(/^file:/, "") : "./dev.db";
if (!path.isAbsolute(dbPath)) {
  dbPath = path.resolve(__dirname, "..", dbPath);
}

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const adapter = new PrismaBetterSqlite3({ url: dbPath });
export const db = new PrismaClient({ adapter });
export * from "@prisma/client";
