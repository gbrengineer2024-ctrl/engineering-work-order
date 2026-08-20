import { describe, expect, it } from "vitest";
import { getLineCallbackUri } from "./lineLogin";

function requestLike({ host, protocol = "http", forwardedProto }: { host: string; protocol?: string; forwardedProto?: string }) {
  const headers: Record<string, string> = {};
  if (forwardedProto) headers["x-forwarded-proto"] = forwardedProto;
  return new Request(`${protocol}://${host}/`, { headers });
}

describe("LINE Login callback URI", () => {
  it("uses HTTPS for a public host even when the Worker sees plain HTTP internally", () => {
    expect(getLineCallbackUri(requestLike({ host: "hotel.example.workers.dev" })))
      .toBe("https://hotel.example.workers.dev/api/auth/line/callback");
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
