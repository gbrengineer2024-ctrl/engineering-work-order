import { ENV } from "./_core/env";

interface AppsScriptResult { key: string; url: string; }

/** Calls the authenticated Apps Script web app. The shared token is sent only server-to-server. */
async function callAppsScript(payload: Record<string, unknown>): Promise<AppsScriptResult> {
  if (!ENV.googleAppsScriptUrl || !ENV.googleAppsScriptToken) {
    throw new Error("Google Drive is not configured: set GOOGLE_APPS_SCRIPT_URL and GOOGLE_APPS_SCRIPT_TOKEN");
  }
  const response = await fetch(ENV.googleAppsScriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, token: ENV.googleAppsScriptToken }),
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`Google Apps Script request failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  const result = await response.json() as { success?: boolean; key?: string; url?: string; error?: string };
  if (!result.success || !result.key || !result.url) {
    throw new Error(`Google Apps Script error: ${result.error || "Invalid response"}`);
  }
  return { key: result.key, url: result.url };
}

export async function appsScriptStoragePut(relKey: string, data: Buffer | Uint8Array | string, contentType: string, folderId: string): Promise<AppsScriptResult> {
  if (!folderId) throw new Error("Google Drive is not configured: missing rootFolderId");
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const fileDataBase64 = btoa(binary);
  const fileName = relKey.replace(/\\/g, "/").split("/").filter(Boolean).join("_").replace(/[^a-zA-Z0-9._-]/g, "_");
  return callAppsScript({ action: "upload", folderId, fileName, mimeType: contentType, fileDataBase64 });
}

export async function appsScriptStoragePutPdfFromHtml(relKey: string, html: string, folderId: string): Promise<AppsScriptResult> {
  if (!folderId) throw new Error("Google Drive is not configured: missing rootFolderId");
  const fileName = relKey.replace(/\\/g, "/").split("/").filter(Boolean).join("_").replace(/[^a-zA-Z0-9._-]/g, "_") + ".pdf";
  return callAppsScript({ action: "createPdf", folderId, fileName, html });
}
