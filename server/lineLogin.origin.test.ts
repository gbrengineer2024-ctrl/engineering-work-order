import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { getLineCallbackUri } from "./lineLogin";

function requestLike({ host, protocol = "http", forwardedProto }: { host: string; protocol?: string; forwardedProto?: string }) {
  return {
    protocol,
    headers: forwardedProto ? { "x-forwarded-proto": forwardedProto } : {},
    get: (name: string) => name.toLowerCase() === "host" ? host : undefined,
  } as unknown as Request;
}

describe("LINE Login callback URI", () => {
  it("uses HTTPS for a public proxy host even when Express receives HTTP internally", () => {
    expect(getLineCallbackUri(requestLike({ host: "3000-example.sg1.manus.computer" })))
      .toBe("https://3000-example.sg1.manus.computer/api/auth/line/callback");
  });

  it("uses the forwarded public protocol when it is supplied", () => {
    expect(getLineCallbackUri(requestLike({ host: "hotel.example.com", forwardedProto: "https" })))
      .toBe("https://hotel.example.com/api/auth/line/callback");
  });

  it("preserves HTTP for local development", () => {
    expect(getLineCallbackUri(requestLike({ host: "localhost:3000" })))
      .toBe("http://localhost:3000/api/auth/line/callback");
  });
});
