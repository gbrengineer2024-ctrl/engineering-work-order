import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A throwaway 2048-bit RSA key generated solely for these tests (not a real
// service-account credential) — needed so crypto.subtle.importKey("pkcs8", ...)
// actually succeeds when signing the JWT assertion.
const TEST_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC4vrH560P7Zxr/
8ericBRw3nhRdC99f/hHJbLpcAhGsn3P6cHpA7dG6bjwmIcUL1YNwYYtVwUspGQ5
yMQQLYkOm2qug4F85Jg9yzVr0q1csuvFryKU7xDVE+Bou5DYi8uws5PcMzeYqRSz
YDr1VWV6F/TxmJiLXxwoVqPrUhIzML1jLA5CsLsDKiqcLo1vmgdZc3m5udNl5bbT
0jwuoQC599ufiUlCei51yt5pIUSXv+45P/kzb0cMiz8rBWE22UJFXFOihUyFss1n
Kd9GKVjbj64yd/ZXEbWjfegQK8xNjAuwyziW9UqK2eNnmW6xLCHFKR+fQgGS3Fir
GKU/3R+dAgMBAAECggEADUAcKsUthJASFy5mPuR0Ct5h+dGgAFvX1l6FVQnkhhGS
RYHKFyjdkdf8nEEMWy3D+cuaEJFvvRJzX9OfAFwLuwD5p1emR2tr4e67v6aGKaJp
l62miNEWv3mj/E8LpgRs0RkoL0B7KdditTTfNa5wz099kYB03HYvYlNIgX3K8WHb
qMHcR1DXDh0gBGRqL7zLnq6cB3tODD3KN/7sWoRPKQhi38rWdajSBlRfjYYZy1Qj
jBIljl0iga4tysaLcmBZwr6bDvNeKARbYO/8zA2rTJAhVs8gOAjBYT9tqwmjrQXy
woWM1m72KuIKIXpNCAZAIwZ0V230omjKfYfFJ04b7wKBgQDy0mAIfuSV1y4BySqw
8zyv1d8xMAgSY1rIookzhpqIN9n6gp42ohvLtm6xc+czmL8uTiK74nXvqmCap6zd
mGrlrpafTz695p5JfZ6hH5cL3GvMas3IEx+KkRJSqAysqI5SoQJLaJz8ymynOMln
8BOfSDvM2hI2jxJ/zsbMYKXhQwKBgQDCxW8GtVTMUbC42U8mrrBSqwZQ3ZpAefXJ
ofy9h2S8PaC65d9gev4IKyWAe0AKOCoszelwX8b/fcvMTN14wgiCfVGFE4EZJwtm
Bg/taHkC1WYPGIsN0wwK4nMMrlV+GblpaYWXbllcOElz3p7fqO0mIdV54WjB0Wo3
f6NQDv39nwKBgQDTBVSDzZLlTR0kXCiHorrorFrMqks5f7KTjfziFGYTX0ZF2GGa
ZQL25FIKUQlp46KxoSG6WjHX2B8gB/vIj/7GIBWx2PJToimJAGxs5cEkg6gC/AZd
i5DroOtlfbmWCt20nUwbMIzNezU1lboiY5cJ44JkolcVpvySqaZGUu+VdQKBgQCV
5ekq2oemsAA4Y1adSLh/BwzXU5WRpctaIQcovnjyvuNis+OUl1PG6Z31IeYJd2xO
CzNrvuqiWyhr1YRlmb9+3f/NUVN8DiahoGzFpC/t1Fq1p4ftXc3Y2qr8yXcWk6m0
zPd5sf2oEdHGEUFolNPfEw7+vFIpSIhcqikARmmHtQKBgBu+f4kpYySvGpryZPqa
G19yX1aCFlwl43doZrYNLCMBOIAfSzGj72AZ9vn/jl/V8DY5b/Ovl4o8W8m78mGE
i73vaZ1QgTZr3Dtkq+D6K2v1FOmRt/r+W1s/70OEp4LJ1zan0MfbXm9KlOix7PxG
BanFGkIABvBsi4dG1gBiT+cM
-----END PRIVATE KEY-----`;

async function loadModule() {
  vi.resetModules();
  const googleDrive = await import("./googleDrive");
  return googleDrive;
}

describe("Google Drive attachment storage", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubGlobal("crypto", crypto);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("throws a clear error when service account credentials are missing", async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;
    const { driveStoragePut } = await loadModule();

    await expect(driveStoragePut("work-orders/WO-1/photo.jpg", new Uint8Array([1]), "image/jpeg")).rejects.toThrow(
      /not configured/i,
    );
  });

  it("uploads the file, makes it link-viewable, and returns a direct-view URL", async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "svc@example.iam.gserviceaccount.com";
    process.env.GOOGLE_PRIVATE_KEY = TEST_PRIVATE_KEY_PEM;
    process.env.GOOGLE_DRIVE_WORK_ORDERS_FOLDER_ID = "1ealFTh1rxz2Bt7D7Yij4KpnK0j9ZoC3K";

    const fetchMock = vi.fn();
    // 1. OAuth2 token exchange
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "fake-token", expires_in: 3600 }), { status: 200 }),
    );
    // 2. Multipart file upload
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: "drive-file-id-123" }), { status: 200 }));
    // 3. Permission update ("anyone with the link")
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: "perm-1" }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { driveStoragePut } = await loadModule();
    const result = await driveStoragePut("work-orders/WO-1/1700000000-before.jpg", new Uint8Array([1, 2, 3]), "image/jpeg");

    expect(result).toEqual({
      key: "drive-file-id-123",
      url: "https://drive.google.com/uc?export=view&id=drive-file-id-123",
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [tokenCall, uploadCall, permissionCall] = fetchMock.mock.calls;
    expect(String(tokenCall[0])).toBe("https://oauth2.googleapis.com/token");
    expect(String(uploadCall[0])).toContain("https://www.googleapis.com/upload/drive/v3/files");
    expect(String(permissionCall[0])).toBe(
      "https://www.googleapis.com/drive/v3/files/drive-file-id-123/permissions",
    );
    expect(JSON.parse(permissionCall[1].body)).toEqual({ role: "reader", type: "anyone" });
  });

  it("flattens nested storage keys into a single sanitized filename", async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "svc@example.iam.gserviceaccount.com";
    process.env.GOOGLE_PRIVATE_KEY = TEST_PRIVATE_KEY_PEM;
    process.env.GOOGLE_DRIVE_WORK_ORDERS_FOLDER_ID = "1ealFTh1rxz2Bt7D7Yij4KpnK0j9ZoC3K";

    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "fake-token", expires_in: 3600 }), { status: 200 }),
    );
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: "drive-file-id-456" }), { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: "perm-2" }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const { driveStoragePut } = await loadModule();
    await driveStoragePut("work-orders/WO-42/1700000000-ห้อง 101.jpg", new Uint8Array([1]), "image/jpeg");

    const uploadCall = fetchMock.mock.calls[1];
    const uploadBody = String(await new Response(uploadCall[1].body).text());
    expect(uploadBody).toContain('"name":"work-orders_WO-42_1700000000-_____101.jpg"');
    expect(uploadBody).toContain('"parents":["1ealFTh1rxz2Bt7D7Yij4KpnK0j9ZoC3K"]');
  });
});
