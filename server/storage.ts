// File storage backed by Cloudflare R2 (replaces the old Manus "Forge"
// presigned-S3 proxy). Uploaded files are written straight to the R2
// binding and served back through the /files/:key route in server/index.ts.

let _bucket: R2Bucket | null = null;

export function bindStorage(bucket: R2Bucket) {
  _bucket = bucket;
}

function getBucket(): R2Bucket {
  if (!_bucket) {
    throw new Error("Storage not configured: R2 bucket binding (BUCKET) is missing");
  }
  return _bucket;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const bucket = getBucket();
  const key = appendHashSuffix(normalizeKey(relKey));

  await bucket.put(key, data as any, {
    httpMetadata: { contentType },
  });

  return { key, url: `/files/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/files/${key}` };
}

/** Used by the GET /files/:key route to stream an object back to the browser. */
export async function storageGetObject(relKey: string): Promise<R2ObjectBody | null> {
  const bucket = getBucket();
  return bucket.get(normalizeKey(relKey));
}
