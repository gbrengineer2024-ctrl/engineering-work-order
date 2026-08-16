export const MAX_WORK_ORDER_PHOTO_BYTES = 8 * 1024 * 1024;

export type PhotoFileInfo = {
  type: string;
  size: number;
};

export function getBeforePhotoValidationError(file: PhotoFileInfo) {
  if (!file.type.startsWith("image/")) return "กรุณาเลือกไฟล์รูปภาพเท่านั้น";
  if (file.size > MAX_WORK_ORDER_PHOTO_BYTES) return "รูปภาพต้องมีขนาดไม่เกิน 8 MB";
  return null;
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์รูปภาพได้"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}
