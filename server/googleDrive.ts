// Google Drive storage backend for work-order attachments (before/after photos).
//
// Uses a Google Cloud service account and signs its own OAuth2 JWT assertion
// with the Web Crypto API (RSASSA-PKCS1-v1_5 / SHA-256) — no `googleapis` or
// `google-auth-library` SDK dependency, so this runs fine in the Workers
// runtime as well as in local Node dev.
//
// Setup required before GOOGLE_DRIVE_ENABLED can actually work in production:
//   1. Create (or reuse) a Google Cloud service account and download its JSON key.
//   2. Share the target Drive folder with the service account's client_email
//      (Editor access) — a service account has zero access to any folder
//      until it is explicitly shared with it.
//   3. Set two Cloudflare secrets:
//        wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
//        wrangler secret put GOOGLE_PRIVATE_KEY   (paste the private_key value; keep the \n's)
//   4. Enable the integration from the admin “Google Drive” settings panel
//      (this flips `google_drive_integration_settings.isEnabled`), which is
//      what routers.ts checks before routing uploads here instead of Forge.

import { ENV } from "./_core/env";

const DRIVE_UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

// --- JWT signing -----------------------------------------------------------

function base64UrlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeString(input: string): string {
  return base64UrlEncode(new TextEncoder().encode(input));
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const normalized = pem.includes("\\n") ? pem.replace(/\\n/g, "\n") : pem;
  const body = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), c => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

async function createSignedJwt(serviceAccountEmail: string, privateKeyPem: string): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const nowSeconds = Math.floor(Date.now() / 1000);
  const claims = {
    iss: serviceAccountEmail,
    scope: DRIVE_SCOPE,
    aud: TOKEN_ENDPOINT,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };
  const signingInput = `${base64UrlEncodeString(JSON.stringify(header))}.${base64UrlEncodeString(JSON.stringify(claims))}`;
  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

// --- Access token cache (isolate-scoped) -----------------------------------

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.accessToken;

  if (!ENV.googleServiceAccountEmail || !ENV.googlePrivateKey) {
    throw new Error(
      "Google Drive is not configured: set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY",
    );
  }

  const assertion = await createSignedJwt(ENV.googleServiceAccountEmail, ENV.googlePrivateKey);
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.accessToken;
}

/** Exposed for tests: clears the cached Drive access token between test cases. */
export function __resetGoogleDriveTokenCacheForTests(): void {
  cachedToken = null;
}

// --- Upload ------------------------------------------------------------------

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

interface DriveUploadResult {
  /** Google Drive file ID — stored as the attachment "key". */
  key: string;
  /** Direct-view URL usable straight in an <img src>. */
  url: string;
}

/**
 * Uploads a file to the configured Google Drive folder, makes it viewable by
 * anyone with the link (same trust model as the previous Forge/S3 flow, which
 * also returned an unauthenticated link), and returns a { key, url } pair
 * with the same shape as `storagePut` so callers don't need to branch.
 */
export async function driveStoragePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<DriveUploadResult> {
  const folderId = ENV.googleDriveWorkOrdersFolderId;
  if (!folderId) {
    throw new Error("Google Drive is not configured: set GOOGLE_DRIVE_WORK_ORDERS_FOLDER_ID");
  }

  const accessToken = await getAccessToken();

  // Flatten "work-orders/{woId}/{timestamp}-{name}" style keys into a single
  // readable filename, since we store everything in one shared Drive folder
  // rather than mirroring the nested path as real Drive subfolders.
  const fileName = sanitizeFileName(relKey.replace(/\//g, "_"));

  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const metadata = { name: fileName, parents: [folderId] };

  const boundary = `-------${crypto.randomUUID()}`;
  const metadataPart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const mediaPartHeader = `--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`;
  const closingBoundary = `\r\n--${boundary}--`;

  const body = new Blob([metadataPart, mediaPartHeader, bytes as BlobPart, closingBoundary]);

  const uploadResponse = await fetch(`${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Google Drive upload failed (${uploadResponse.status}): ${await uploadResponse.text()}`);
  }

  const { id: fileId } = (await uploadResponse.json()) as { id: string };

  // Service accounts have no Drive quota of their own for files they don't
  // own; sharing "anyone with the link can view" lets the hotel-side viewer
  // load the photo without needing its own Drive session.
  const permissionResponse = await fetch(`${DRIVE_FILES_ENDPOINT}/${fileId}/permissions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });

  if (!permissionResponse.ok) {
    throw new Error(
      `Google Drive permission update failed (${permissionResponse.status}): ${await permissionResponse.text()}`,
    );
  }

  return { key: fileId, url: `https://drive.google.com/uc?export=view&id=${fileId}` };
}
