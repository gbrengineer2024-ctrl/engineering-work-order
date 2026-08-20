import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A throwaway 2048-bit RSA key generated solely for these tests (not a real
// service-account credential) -- needed so crypto.subtle.importKey("pkcs8", ...)
// actually succeeds when signing the JWT assertion.
const TEST_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCiBWDl54Xz72Mk
XUZu1JV4QsepG1Ll6svX2ejDNOvBMIPf5CnO7OHQzmF1YcJl3EiycXW5OgvLvwox
VoqKGenl7HSiolD90n30dL38sjWmURlboKDhh8D8Y4Py0ZOk9n4GVt85mH0QXvYK
bXF+1XS3AmGPayW9CctIyhkcbEgDwuvdCJkLo1kFhiVIkhpgNWVNebz5uKMT8TEz
EILoJ9ZaAvqdiKTUtEFMdebfX/2yTg8GgXmkkp8hK5FK/knuVbl3y/7o5B1rAlak
ZYsHdE77YxF85Tm+44qtAQ7Eaw1GaW7jt3E02Ln5Qo7NtA1jv9esDcELIjfNYgb1
3fXaPhd7AgMBAAECggEARIMju3RQ15sWAG2U+A7a+dS7W04bmu/TrP4PiGRbgQED
8uwnpcHTp5lt6tYg/zPMZfDGiEH8dPbe14gx4z4cA0ce9xrORtb4viOTp0SwnRjU
MUPWZCgkulVWmZp35Zz6I7IeiNtrnz2Yq0YmZSzcQvs1yBDWD38RwED9p2A+f6AE
IOoU4CYcSFk1dKaKcMojFu+7cUpU+r5iIRvQpETwt9pHYUUMq/AdskjdyfQAECZ6
Ew0JOgfl1QiVMwNk1/vGjSALn49cZ6jhlKDvR9DQTQB27Esf22ZSFe6Lrt8KhK6z
yGTQLzYmPUTLgfENx6A3srEO5HnJp/829t/hINX86QKBgQDMUswz9T8hsI04RHCY
gfdOoKeJObRCp13YJaTU+j6FzFxVapjFVeJduEOrTN7RT2J+xkkhUxTmIs+XZC1d
RUSGn9T7qMjA0ry9e4eRQkzPQpGHy9qrHmOxspPS9v7Zeh0ObhwMDaEGF6Wt+zmT
2BpckpLwRaFKXth4zuSlZ3S1dwKBgQDK/6cB3WoYsiy0PlYwKxM338bra37kRVcj
hC3RYdsK80qqOnYtng3Q+IUcevp/xbXv/jw9nKpCEfLCKCN2lSnuisn5BzHMzZQ+
lw6Vnndy4ir8VOov+Wi7Eu/yyPkEDT7W6VkQcdg4IZ6SHIyQgPVmrRkRU+c9w3DW
AqAnSdz/HQKBgHqJjX37rwj9YTRFl2FfUHoPT2q0+K6gwV9H9DrmeWi0zwtLCqQO
hdu/DpZFW7wb5+4v7NvXf8klR2p74dj2GcrDQHBNIVjDCf55fyxWnsoOGklesJ2/
c/q2JoF3MBAtdA+baaaw5clJlUtqR3WrPOQX45fFqp13lEufiPDJwuyxAoGAFFTu
wT0P91FBMPxdXY2y6xG6trGZj/tx8ti2ThZi/gHIJKyeUYtXDusVSfj3RfzjcBoi
pnkehGePzOqAQsxF2uKDwDF8R2r/whUXHN02UYddjtBidFOirboD1mlSp5k8BgJx
LTh504VqgG/jlEWWTqZfsGCa9JCyqHyy1byMKfECgYADFT8uagYutOCdntBk9qGD
cq9ZRaslKpiD2VawxcE2GMgwYTHknnnG9RMg/aGoeMPHzfFNeD84zg7mTbxPwl2j
Q4OTtwC7tvzrNenqT4mwN6mtbUdqQwWorGAQPLz/nTkAN0uN/InTA3UD2kGNGn2g
FBy0Xhmkclr1QYw4+TQ4fQ==
-----END PRIVATE KEY-----`;

async function loadFresh() {
  vi.resetModules();
  const env = await import("./_core/env");
  const googleDrive = await import("./googleDrive");
  return { ENV: env.ENV, driveStoragePut: googleDrive.driveStoragePut };
}

describe("Google Drive attachment storage", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal("crypto", crypto);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  it("throws a clear error when service account credentials are missing", async () => {
    const { ENV, driveStoragePut } = await loadFresh();
    ENV.googleServiceAccountEmail = "";
    ENV.googlePrivateKey = "";

    await expect(
      driveStoragePut("work-orders/WO-1/photo.jpg", new Uint8Array([1]), "image/jpeg", "folder-123"),
    ).rejects.toThrow(/not configured/i);
  });

  it("throws a clear error when no rootFolderId is configured", async () => {
    const { ENV, driveStoragePut } = await loadFresh();
    ENV.googleServiceAccountEmail = "svc@example.iam.gserviceaccount.com";
    ENV.googlePrivateKey = TEST_PRIVATE_KEY_PEM;

    await expect(
      driveStoragePut("work-orders/WO-1/photo.jpg", new Uint8Array([1]), "image/jpeg", ""),
    ).rejects.toThrow(/rootFolderId/i);
  });

  it("uploads the file into the given folder, makes it link-viewable, and returns a direct-view URL", async () => {
    const { ENV, driveStoragePut } = await loadFresh();
    ENV.googleServiceAccountEmail = "svc@example.iam.gserviceaccount.com";
    ENV.googlePrivateKey = TEST_PRIVATE_KEY_PEM;

    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "fake-token", expires_in: 3600 }), { status: 200 }),
    );
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: "drive-file-id-123" }), { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: "perm-1" }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await driveStoragePut(
      "work-orders/WO-1/1700000000-before.jpg",
      new Uint8Array([1, 2, 3]),
      "image/jpeg",
      "1ealFTh1rxz2Bt7D7Yij4KpnK0j9ZoC3K",
    );

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

    const uploadBody = String(await new Response(uploadCall[1].body).text());
    expect(uploadBody).toContain('"parents":["1ealFTh1rxz2Bt7D7Yij4KpnK0j9ZoC3K"]');
    expect(uploadBody).toContain('"name":"work-orders_WO-1_1700000000-before.jpg"');
  });
});
