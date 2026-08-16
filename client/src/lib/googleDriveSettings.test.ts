import { describe, expect, it } from "vitest";
import { extractGoogleDriveFolderId } from "./googleDriveSettings";

describe("extractGoogleDriveFolderId", () => {
  it("อ่าน Folder ID จาก Google Drive folder URL", () => {
    expect(extractGoogleDriveFolderId("https://drive.google.com/drive/folders/abcDE_fg-123?usp=sharing")).toBe("abcDE_fg-123");
  });

  it("ยอมรับ Folder ID โดยตรงและปฏิเสธข้อความที่ไม่ใช่ ID", () => {
    expect(extractGoogleDriveFolderId("  abcDE_fg-123  ")).toBe("abcDE_fg-123");
    expect(extractGoogleDriveFolderId("not a drive folder")).toBe("");
  });
});
