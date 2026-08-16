export type WorkOrderDraft = {
  woId?: string;
  locationId: string;
  categoryCode: string;
  priorityCode: string;
  description: string;
  subCategory?: string;
};

export type BeforePhotoPayload = {
  fileName: string;
  mimeType: string;
  fileDataBase64: string;
};

type CreatedWorkOrder = { woId?: string; workOrder?: { woId?: string } } | undefined | null;

export async function createWorkOrderWithBeforePhoto(input: {
  draft: WorkOrderDraft;
  uploadedBy: string;
  beforePhotos?: BeforePhotoPayload[];
  createWorkOrder: (values: WorkOrderDraft & { sourceChannel: string; customerVisible: boolean }) => Promise<CreatedWorkOrder>;
  uploadAttachment: (values: { woId: string; attachmentType: "BEFORE"; fileName: string; mimeType: string; fileDataBase64: string; uploadedBy: string }) => Promise<unknown>;
}) {
  const createdWorkOrder = await input.createWorkOrder({ ...input.draft, sourceChannel: "WEBAPP", customerVisible: false });
  const woId = createdWorkOrder?.woId ?? createdWorkOrder?.workOrder?.woId ?? input.draft.woId;
  const beforePhotos = input.beforePhotos ?? [];

  if (beforePhotos.length === 0) return { workOrderCreated: true, beforePhotosAttached: 0 };
  if (!woId) throw new Error("WORK_ORDER_ID_REQUIRED");

  await Promise.all(beforePhotos.map(photo => input.uploadAttachment({
    woId,
    attachmentType: "BEFORE",
    uploadedBy: input.uploadedBy,
    ...photo,
  })));
  return { workOrderCreated: true, beforePhotosAttached: beforePhotos.length };
}
