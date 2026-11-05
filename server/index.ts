import { Hono } from "hono";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { bindDatabase } from "./db";
import { bindStorage, storageGetObject } from "./storage";
import { bindEnv, type WorkerEnv } from "./_core/env";
import { createContext, type TrpcContext } from "./_core/context";
import { registerLineLoginRoutes } from "./lineLogin";
import { appRouter } from "./routers";
import { sdk } from "./_core/sdk";
import { getWorkOrder, getTechnicianIdForUser } from "./db";

const app = new Hono<{ Bindings: WorkerEnv }>();

// Bind Cloudflare resources (D1, R2, secrets/vars) for the duration of this
// request. See the bindDatabase()/bindStorage()/bindEnv() comments for why
// this per-request-rebind pattern is safe on Workers.
app.use("*", async (c, next) => {
  bindDatabase(c.env.DB);
  bindStorage(c.env.BUCKET);
  bindEnv(c.env);
  await next();
});

// File uploads/downloads (before/after photos, etc.) -- replaces the old
// Manus "/manus-storage/*" Forge proxy with direct Cloudflare R2 access.
app.get("/files/*", async c => {
  const key = c.req.path.replace(/^\/files\//, "");
  const match = key.match(/^work-orders\/([^/]+)\/[^/]+$/);
  if (!match) return c.notFound();

  let user;
  try {
    user = await sdk.authenticateRequest(c.req.raw);
  } catch {
    return c.text("Unauthorized", 401);
  }

  const detail = await getWorkOrder(match[1]);
  if (!detail) return c.notFound();
  const order = detail.workOrder;
  const canRead =
    user.role === "ADMIN" ||
    user.role === "SUPERVISOR" ||
    (user.role === "REPORTER" && order.requesterUserId === user.openId) ||
    (user.role === "TECHNICIAN" && order.assignedTechId === await getTechnicianIdForUser(user.openId));
  if (!canRead) return c.text("Forbidden", 403);

  const object = await storageGetObject(key);
  if (!object) return c.notFound();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
});

registerLineLoginRoutes(app);

app.all("/api/trpc/*", c =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
    responseMeta(opts) {
      const ctx = opts.ctx as TrpcContext | undefined;
      const cookies = ctx?.responseCookies ?? [];
      if (cookies.length === 0) return {};
      const headers = new Headers();
      for (const value of cookies) headers.append("set-cookie", value);
      return { headers };
    },
    onError({ error, path }) {
      console.error(`[tRPC] ${path ?? "<no-path>"}:`, error);
    },
  }),
);

export default app;
