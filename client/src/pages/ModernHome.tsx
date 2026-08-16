import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Camera, ImagePlus, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getBeforePhotoValidationError, readFileAsDataUrl } from "@/lib/workOrderPhotos";
import { createWorkOrderWithBeforePhoto } from "@/lib/workOrderPhotoFlow";
import { selectWorkOrderDeepLinkTarget } from "@/lib/workOrderDeepLink";
import { PartsManager } from "@/components/PartsManager";
import LegacyModernHome from "./ModernHomeLegacy";

const MAX_BEFORE_PHOTOS = 5;

function CreateWorkOrderWithBeforePhoto({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const profile = trpc.profile.me.useQuery(undefined, { enabled: open && Boolean(user) });
  const create = trpc.workOrders.create.useMutation();
  const upload = trpc.workOrders.uploadAttachment.useMutation();
  const [beforePhotos, setBeforePhotos] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [expandedPreview, setExpandedPreview] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => () => { previewUrls.forEach(url => URL.revokeObjectURL(url)); }, [previewUrls]);

  const resetPhotos = () => {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setBeforePhotos([]);
    setPreviewUrls([]);
    setExpandedPreview(null);
  };

  const choosePhotos = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0) return;
    const valid = selected.filter(file => {
      const validationError = getBeforePhotoValidationError(file);
      if (validationError) toast.error(`${file.name}: ${validationError}`);
      return !validationError;
    });
    const remaining = MAX_BEFORE_PHOTOS - beforePhotos.length;
    if (remaining <= 0) {
      toast.error(`แนบรูปก่อนงานได้สูงสุด ${MAX_BEFORE_PHOTOS} รูป`);
      return;
    }
    const accepted = valid.slice(0, remaining);
    if (accepted.length < valid.length) toast.info(`เพิ่มได้อีก ${remaining} รูป ระบบเลือกเฉพาะรูปแรกตามจำนวนที่กำหนด`);
    if (accepted.length === 0) return;
    setBeforePhotos(current => [...current, ...accepted]);
    setPreviewUrls(current => [...current, ...accepted.map(file => URL.createObjectURL(file))]);
  };

  const removePhoto = (index: number) => {
    const url = previewUrls[index];
    if (url) URL.revokeObjectURL(url);
    setBeforePhotos(current => current.filter((_, currentIndex) => currentIndex !== index));
    setPreviewUrls(current => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    const data = new FormData(event.currentTarget);
    let created = false;
    try {
      await createWorkOrderWithBeforePhoto({
        draft: {
          locationId: String(data.get("locationId") ?? "").trim(),
          categoryCode: "UNSPECIFIED",
          priorityCode: String(data.get("priorityCode")),
          description: String(data.get("description")),
        },
        uploadedBy: user.openId,
        beforePhotos: await Promise.all(beforePhotos.map(async file => ({ fileName: file.name, mimeType: file.type, fileDataBase64: await readFileAsDataUrl(file) }))),
        createWorkOrder: async values => { created = true; return create.mutateAsync(values); },
        uploadAttachment: upload.mutateAsync,
      });
      await Promise.all([utils.workOrders.list.invalidate(), utils.workOrders.detail.invalidate(), utils.dashboard.stats.invalidate()]);
      toast.success(beforePhotos.length > 0 ? `สร้างใบงานและแนบรูปก่อนงาน ${beforePhotos.length} รูปแล้ว` : "สร้างใบงานแล้ว");
      resetPhotos();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(created ? "สร้างใบงานแล้ว แต่แนบรูปบางรายการไม่สำเร็จ กรุณาเพิ่มรูปจากรายละเอียดใบงาน" : "ไม่สามารถสร้างใบงานได้ กรุณาลองอีกครั้ง");
    }
  };

  return <>
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) resetPhotos(); }}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] overflow-y-auto rounded-3xl border-indigo-400/30 bg-card p-5 shadow-2xl shadow-black/45 sm:max-w-lg sm:p-6">
        <DialogHeader><DialogTitle className="text-xl">สร้างใบงาน</DialogTitle><DialogDescription>ระบบจะสร้างเลขใบงานอัตโนมัติ และแนบรูปสภาพก่อนเริ่มงานได้พร้อมกันหลายรูป</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="rounded-2xl border border-indigo-400/25 bg-indigo-500/10 p-3 text-sm text-indigo-100"><p className="text-xs font-medium text-indigo-200">ผู้แจ้ง</p><p className="mt-0.5 font-semibold">{profile.data?.profile?.displayName ?? user?.name ?? "กำลังโหลดชื่อผู้แจ้ง"}</p><p className="mt-0.5 text-xs text-indigo-200">แผนก: {profile.data?.profile?.department ?? "กำลังโหลดแผนก"}</p><p className="mt-0.5 text-xs text-indigo-200">บทบาท: {user?.role ?? "กำลังโหลดบทบาท"}</p></div>
          <label className="block text-sm font-semibold">Room / Location<Input required name="locationId" maxLength={40} placeholder="เช่น ห้อง 1208 / Lobby / ห้องครัว" className="mt-2 h-11 rounded-xl bg-secondary" /></label>
          <label className="block text-sm font-semibold">ความสำคัญ<select required name="priorityCode" defaultValue="MEDIUM" className="mt-2 h-11 w-full rounded-xl border border-input bg-secondary px-3 text-sm outline-none focus:ring-2 focus:ring-ring"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></label>
          <label className="block text-sm font-semibold">รายละเอียดปัญหา<Textarea required name="description" placeholder="อธิบายอาการหรือผลกระทบ เพื่อให้ช่างเตรียมงานได้ต้องตรง" className="mt-2 min-h-28 rounded-xl bg-secondary" /></label>
          <div className="rounded-2xl border border-dashed border-indigo-400/50 bg-indigo-500/10 p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-bold text-indigo-100"><Camera className="h-4 w-4" />รูปภาพก่อนงาน <span className="font-normal text-muted-foreground">(ไม่บังคับ)</span></p><p className="mt-1 text-xs leading-5 text-muted-foreground">เลือกได้สูงสุด {MAX_BEFORE_PHOTOS} รูป รองรับ JPG, PNG, WebP ขนาดรูปละไม่เกิน 8 MB</p></div>{beforePhotos.length > 0 && <span className="rounded-full bg-indigo-300/15 px-2 py-1 text-xs font-bold text-indigo-100">{beforePhotos.length}/{MAX_BEFORE_PHOTOS} รูป</span>}</div>
            {beforePhotos.length > 0 && <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{beforePhotos.map((photo, index) => <div key={`${photo.name}-${index}`} className="group relative overflow-hidden rounded-xl border border-indigo-300/20 bg-black/20"><button type="button" className="block h-24 w-full" onClick={() => setExpandedPreview({ url: previewUrls[index], name: photo.name })} aria-label={`ขยายรูป ${photo.name}`}><img src={previewUrls[index]} alt={`ตัวอย่างรูปก่อนงาน ${index + 1}`} className="h-full w-full object-cover" /></button><div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/70 px-2 py-1.5"><span className="max-w-[70%] truncate text-[10px] text-white">{photo.name}</span><div className="flex gap-1"><button type="button" onClick={() => setExpandedPreview({ url: previewUrls[index], name: photo.name })} className="rounded p-1 text-white hover:bg-white/15" aria-label="ดูรูปเต็มจอ"><Maximize2 className="h-3.5 w-3.5" /></button><button type="button" onClick={() => removePhoto(index)} className="rounded p-1 text-white hover:bg-white/15" aria-label="ลบรูป"><X className="h-3.5 w-3.5" /></button></div></div></div>)}</div>}
            {beforePhotos.length < MAX_BEFORE_PHOTOS && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-indigo-400/45 bg-background/30 px-4 text-center text-sm text-indigo-100 hover:bg-indigo-400/10"><Camera className="mb-2 h-5 w-5" />ถ่ายรูปด้วยกล้อง<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={choosePhotos} /></label><label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-indigo-400/45 bg-background/30 px-4 text-center text-sm text-indigo-100 hover:bg-indigo-400/10"><ImagePlus className="mb-2 h-5 w-5" />เลือกรูปจากเครื่อง<input type="file" accept="image/*" multiple className="sr-only" onChange={choosePhotos} /></label></div>}
          </div>
          <Button type="submit" disabled={create.isPending || upload.isPending} className="h-11 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 font-bold text-white hover:from-indigo-400 hover:to-violet-500">{create.isPending || upload.isPending ? "กำลังบันทึก..." : "สร้างใบงาน"}</Button>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(expandedPreview)} onOpenChange={(next) => { if (!next) setExpandedPreview(null); }}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-4xl border-indigo-300/30 bg-black p-2 sm:p-4"><DialogHeader className="sr-only"><DialogTitle>{expandedPreview?.name ?? "รูปภาพก่อนงาน"}</DialogTitle></DialogHeader>{expandedPreview && <img src={expandedPreview.url} alt={expandedPreview.name} className="max-h-[84vh] w-full rounded-xl object-contain" />}</DialogContent>
    </Dialog>
  </>;
}

export default function ModernHome() {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false);
  const [pendingWorkOrderId, setPendingWorkOrderId] = useState(() => new URLSearchParams(window.location.search).get("woId")?.trim() || null);

  useEffect(() => {
    if (!pendingWorkOrderId) return;
    const openMatchingWorkOrder = () => {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>("tr, button")).map(element => ({ kind: element.tagName === "BUTTON" ? "button" as const : "row" as const, text: element.textContent ?? "", element }));
      const trigger = selectWorkOrderDeepLinkTarget(candidates, pendingWorkOrderId)?.element;
      if (!trigger) return false;
      trigger.click();
      setPendingWorkOrderId(null);
      toast.info(`เปิดรายละเอียดใบงาน ${pendingWorkOrderId}`);
      return true;
    };
    if (openMatchingWorkOrder()) return;
    const observer = new MutationObserver(() => { openMatchingWorkOrder(); });
    observer.observe(document.body, { childList: true, subtree: true });
    const timeout = window.setTimeout(() => { observer.disconnect(); }, 15000);
    return () => { observer.disconnect(); window.clearTimeout(timeout); };
  }, [pendingWorkOrderId]);

  return <div className="hotel-ops-app">
    <LegacyModernHome onCreateWorkOrder={() => setCreateOpen(true)} onOpenPartsManager={() => setPartsOpen(true)} />
    <CreateWorkOrderWithBeforePhoto open={createOpen} onOpenChange={setCreateOpen} />
    <PartsManager open={partsOpen} onOpenChange={setPartsOpen} canManage={["ADMIN", "SUPERVISOR"].includes(user?.role ?? "")} />
  </div>;
}
