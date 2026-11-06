import { afterEach, describe, expect, it, vi } from "vitest";

async function loadClient() {
  vi.resetModules();
  const env = await import("./_core/env");
  const client = await import("./googleAppsScript");
  return { ENV: env.ENV, ...client };
}

describe("Google Apps Script Drive bridge", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requires the Apps Script URL and token", async () => {
    const { ENV, appsScriptStoragePut } = await loadClient();
    ENV.googleAppsScriptUrl = "";
    ENV.googleAppsScriptToken = "";
    await expect(appsScriptStoragePut("photo.jpg", new Uint8Array([1]), "image/jpeg", "folder123456")).rejects.toThrow(/GOOGLE_APPS_SCRIPT_URL/);
  });

  it("sends attachment data to Apps Script and returns the Drive URL", async () => {
    const { ENV, appsScriptStoragePut } = await loadClient();
    ENV.googleAppsScriptUrl = "https://script.google.com/macros/s/deployment/exec";
    ENV.googleAppsScriptToken = "test-token";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true, key: "drive-file-1", url: "https://drive.google.com/uc?export=view&id=drive-file-1"
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await appsScriptStoragePut("work-orders/WO-1/photo.jpg", new Uint8Array([1, 2, 3]), "image/jpeg", "folder123456");
    expect(result.key).toBe("drive-file-1");
    const request = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(request).toMatchObject({
      action: "upload", token: "test-token", folderId: "folder123456",
      fileName: "work-orders_WO-1_photo.jpg", mimeType: "image/jpeg", fileDataBase64: "AQID"
    });
  });
});
