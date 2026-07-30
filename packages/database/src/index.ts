import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const defaultDbPath = path.resolve(__dirname, "../dev.db");
const dbPath = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace(/^file:/, "")
  : defaultDbPath;

const adapter = new PrismaBetterSqlite3({ url: dbPath });

export const db = new PrismaClient({ adapter });
export * from "@prisma/client";
