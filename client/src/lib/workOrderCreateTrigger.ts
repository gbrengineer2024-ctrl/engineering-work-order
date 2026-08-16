export type CreateWorkOrderTrigger = {
  buttonLabel?: string;
  isInsideForm: boolean;
  isWrapperTrigger: boolean;
};

export function shouldOpenWrappedCreateWorkOrder(trigger: CreateWorkOrderTrigger): boolean {
  return trigger.buttonLabel === "สร้างใบงาน" && !trigger.isInsideForm && !trigger.isWrapperTrigger;
}

export function shouldOpenPartsManager(buttonLabel?: string): boolean {
  return buttonLabel === "คลังอะไหล่" || buttonLabel === "อะไหล่";
}

export const COMPLETION_AFTER_PHOTO_INSTRUCTION = "แนบรูปภาพหลังงาน (AFTER) ในส่วนรูปภาพหลังงาน แล้วกดทำเครื่องหมายว่าเสร็จอีกครั้ง";

export function shouldBlockCompletionWithoutAfterPhoto(input: {
  buttonLabel?: string;
  dialogText?: string;
}): boolean {
  const afterPhotoText = input.dialogText?.split("รูปภาพหลังงาน")[1];
  return input.buttonLabel === "ทำเครื่องหมายว่าเสร็จ"
    && Boolean(afterPhotoText?.includes("ยังไม่มีรูปภาพ"));
}
