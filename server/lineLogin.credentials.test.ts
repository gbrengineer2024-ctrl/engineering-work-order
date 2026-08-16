import { describe, expect, it } from "vitest";

describe("LINE Login credentials", () => {
  const liveCredentialCheck = process.env.RUN_LIVE_LINE_CREDENTIAL_TESTS === "true" ? it : it.skip;

  liveCredentialCheck("are accepted by LINE's token endpoint before the app enables LINE Login", async () => {
    const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
    const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;

    expect(channelId, "LINE_LOGIN_CHANNEL_ID must be configured").toBeTruthy();
    expect(channelSecret, "LINE_LOGIN_CHANNEL_SECRET must be configured").toBeTruthy();

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: "credential-validation-code",
      redirect_uri: "https://hotelmaintai-e5vycneh.manus.space/api/auth/line/callback",
      client_id: channelId!,
      client_secret: channelSecret!,
    });

    const response = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    // A deliberately invalid authorization code must produce an invalid-grant style error.
    // An invalid channel credential instead yields invalid_client/unauthorized_client.
    expect(payload.error).not.toMatch(/invalid_client|unauthorized_client/i);
    expect(response.status).toBe(400);
  }, 20_000);
});
