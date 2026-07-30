import { defineConfig } from "@prisma/config";

const rawUrl = process.env.DATABASE_URL || "file:./dev.db";
const url = rawUrl.startsWith("file:") ? rawUrl : "file:./dev.db";

export default defineConfig({
  datasource: {
    url,
  },
});
