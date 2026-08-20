import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: Request;
  /** Set-Cookie headers accumulated during this request; applied to the final Response in server/index.ts. */
  responseCookies: string[];
  user: User | null;
};

export async function createContext(opts: FetchCreateContextFnOptions): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    responseCookies: [],
    user,
  };
}
