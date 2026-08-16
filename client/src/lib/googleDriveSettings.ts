export function extractGoogleDriveFolderId(value: string): string {
  const trimmed = value.trim();
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch?.[1]) return folderMatch[1];
  return /^[a-zA-Z0-9_-]{10,}$/.test(trimmed) ? trimmed : "";
}
