import { defineConfig } from "drizzle-kit";

// Cloudflare D1 is SQLite. Migration SQL is generated locally with
// `pnpm db:generate` and then applied to D1 with:
//   wrangler d1 migrations apply <DB_NAME> --local   (dev)
//   wrangler d1 migrations apply <DB_NAME> --remote   (production)
export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
});
