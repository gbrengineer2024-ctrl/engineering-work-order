import { useEffect, useMemo, useState } from "react";
import { CircleAlert, PackagePlus, Power, Settings2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GoogleDriveSettings } from "@/components/GoogleDriveSettings";

const availabilityOptions = [
  { value: "ON_DUTY" as const, label: "เข้าเวร / พร้อมรับงาน", tone: "bg-emerald-500/15 text-emerald-100 ring-emerald-400/30" },
  { value: "OFF_DUTY" as const, label: "ออกเวร", tone: "bg-slate-300/15 text-slate-100 ring-slate-300/25" },
  { value: "ON_LEAVE" as const, label: "หยุด / ลางาน", tone: "bg-amber-400/15 text-amber-100 ring-amber-300/30" },
];

function availabilityLabel(status?: string | null) {
  return availabilityOptions.find(option => option.value === status)?.label ?? "ยังไม่กำหนดสถานะ";
}

export function TechnicianWorkTools() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isOperationsUser = ["TECHNICIAN", "SUPERVISOR", "ADMIN"].includes(user?.role ?? "");
  const technicians = trpc.technicians.list.useQuery(undefined, { enabled: isOperationsUser });
  const workOrders = trpc.workOrders.list.useQuery(undefined, { enabled: isOperationsUser });
  const parts = trpc.parts.list.useQuery(undefined, { enabled: isOperationsUser });
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState("");
  const [partId, setPartId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [driveSettingsOpen, setDriveSettingsOpen] = useState(false);
  const partIssues = trpc.partIssues.list.useQuery(selectedWorkOrderId ? { woId: selectedWorkOrderId } : undefined, { enabled: isOperationsUser && Boolean(selectedWorkOrderId) });
  const ownTechnician = useMemo(() => technicians.data?.find(technician => technician.userId === user?.openId), [technicians.data, user?.openId]);
  const availability = trpc.technicians.setAvailability.useMutation({
    onSuccess: async () => { await utils.technicians.list.invalidate(); toast.success("บันทึกสถานะเวรช่างแล้ว"); },
    onError: error => toast.error(`เปลี่ยนสถานะเวรไม่สำเร็จ: ${error.message}`),
  });
  const requestPart = trpc.partIssues.request.useMutation({
    onSuccess: async () => { setPartId(""); setQuantity("1"); setNote(""); await Promise.all([utils.partIssues.list.invalidate(), utils.parts.list.invalidate()]); toast.success("ส่งคำขอเบิกอะไหล่แล้ว"); },
    onError: error => toast.error(`ส่งคำขอเบิกไม่สำเร็จ: ${error.message}`),
  });
  const pendingParts = trpc.workOrders.setPendingParts.useMutation({
    onSuccess: async () => { await Promise.all([utils.workOrders.list.invalidate(), utils.workOrders.detail.invalidate(), utils.dashboard.stats.invalidate()]); toast.success("เปลี่ยนสถานะเป็น Pending Parts แล้ว"); },
    onError: error => toast.error(`เปลี่ยนสถานะไม่สำเร็จ: ${error.message}`),
  });

  useEffect(() => {
    if (selectedWorkOrderId || !workOrders.data?.length) return;
    const assignedToCurrentUser = workOrders.data.find(workOrder => workOrder.assignedTechId === ownTechnician?.techId);
    setSelectedWorkOrderId((assignedToCurrentUser ?? workOrders.data[0]).woId);
  }, [ownTechnician?.techId, selectedWorkOrderId, workOrders.data]);

  if (!isOperationsUser) return null;

  const selectedWorkOrder = workOrders.data?.find(workOrder => workOrder.woId === selectedWorkOrderId);
  const selectableWorkOrders = workOrders.data?.filter(workOrder => !["COMPLETED", "CLOSED"].includes(workOrder.statusCode)) ?? [];
  const canChangeOwnAvailability = Boolean(ownTechnician || user?.role === "ADMIN" || user?.role === "SUPERVISOR");
  const isAdmin = user?.role === "ADMIN";

  return <section className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8" aria-label="เครื่องมือช่าง">
    <Card className="overflow-hidden border-indigo-400/30 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 text-white shadow-xl shadow-indigo-950/20">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-400/15 text-indigo-100"><Wrench className="h-5 w-5" /></div><div><h2 className="font-bold">เครื่องมือปฏิบัติงานช่าง</h2><p className="text-xs text-indigo-200">อัปเดตเวรช่าง เบิกอะไหล่โดยผูกกับเลขใบงาน และระบุงานที่กำลังรออะไหล่</p></div></div><div className="flex flex-wrap items-center gap-2"><span className="w-fit rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-100">Pending Parts: {workOrders.data?.filter(workOrder => workOrder.statusCode === "PENDING_PARTS").length ?? 0} งาน</span>{isAdmin && <Button type="button" variant="outline" onClick={() => setDriveSettingsOpen(true)} className="h-8 border-sky-300/35 bg-sky-400/10 px-3 text-xs text-sky-100 hover:bg-sky-400/20 hover:text-white"><Settings2 className="mr-1.5 h-3.5 w-3.5" />ตั้งค่า Google Drive</Button>}</div></div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[.85fr_1.4fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">สถานะเวรของฉัน</p><p className="mt-1 text-sm font-bold text-white">{ownTechnician?.techName ?? "ยังไม่มีระเบียนช่าง"}</p><p className="mt-1 text-xs text-indigo-200">{availabilityLabel(ownTechnician?.availabilityStatus)}</p></div><Power className="h-5 w-5 text-indigo-200" /></div>{canChangeOwnAvailability ? <div className="mt-3 grid gap-2">{availabilityOptions.map(option => <Button key={option.value} type="button" variant="outline" disabled={!ownTechnician || availability.isPending || ownTechnician.availabilityStatus === option.value} onClick={() => ownTechnician && availability.mutate({ techId: ownTechnician.techId, availabilityStatus: option.value })} className={`h-auto justify-start whitespace-normal border-0 px-3 py-2 text-left text-xs ring-1 ${option.tone}`}>{option.label}</Button>)}</div> : <p className="mt-3 rounded-xl bg-amber-400/10 p-3 text-xs text-amber-100">บัญชีนี้ยังไม่ได้เชื่อมกับข้อมูลช่าง โปรดให้ ADMIN กำหนดบทบาท TECHNICIAN ก่อน</p>}</div>
          <form className="rounded-2xl border border-white/10 bg-white/5 p-4" onSubmit={event => { event.preventDefault(); if (!selectedWorkOrderId || !partId) return; requestPart.mutate({ woId: selectedWorkOrderId, partId, qtyRequested: Number(quantity), notes: note.trim() || null }); }}><div className="flex items-center gap-2"><PackagePlus className="h-4 w-4 text-indigo-200" /><p className="text-sm font-bold">เบิกอะไหล่ในใบงาน</p></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-indigo-100">เลขใบงาน<select required value={selectedWorkOrderId} onChange={event => setSelectedWorkOrderId(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-300"><option value="" disabled>เลือกใบงาน</option>{selectableWorkOrders.map(workOrder => <option key={workOrder.woId} value={workOrder.woId}>{workOrder.woId} — {workOrder.locationId}</option>)}</select></label><label className="text-xs font-medium text-indigo-100">อะไหล่<select required value={partId} onChange={event => setPartId(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-white/15 bg-slate-950/65 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-300"><option value="" disabled>เลือกรายการอะไหล่</option>{parts.data?.filter(part => part.isActive).map(part => <option key={part.partId} value={part.partId}>{part.partNameTh} (คงเหลือ {part.currentStockQty})</option>)}</select></label><label className="text-xs font-medium text-indigo-100">จำนวน<Input required type="number" min="1" value={quantity} onChange={event => setQuantity(event.target.value)} className="mt-1 h-10 border-white/15 bg-slate-950/65 text-white" /></label><label className="text-xs font-medium text-indigo-100">หมายเหตุ<Textarea value={note} onChange={event => setNote(event.target.value)} placeholder="ระบุเหตุผลหรือขนาด" className="mt-1 min-h-10 border-white/15 bg-slate-950/65 text-white placeholder:text-slate-400" /></label></div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Button type="submit" disabled={!selectedWorkOrderId || !partId || requestPart.isPending} className="bg-indigo-400 text-slate-950 hover:bg-indigo-300">ส่งคำขอเบิก</Button><Button type="button" variant="outline" disabled={!selectedWorkOrderId || pendingParts.isPending || selectedWorkOrder?.statusCode === "PENDING_PARTS"} onClick={() => pendingParts.mutate({ woId: selectedWorkOrderId, comment: note.trim() || undefined })} className="border-amber-300/35 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20"><CircleAlert className="mr-1.5 h-4 w-4" />รออะไหล่ (Pending Parts)</Button></div>{selectedWorkOrderId && <p className="mt-3 text-xs text-indigo-200">คำขอเบิกในใบงานนี้: {partIssues.data?.length ?? 0} รายการ {partIssues.data?.length ? `(${partIssues.data?.map(issue => issue.issueStatus).join(", ")})` : ""}</p>}</form>
        </div>
      </CardContent>
    </Card>
    <Dialog open={driveSettingsOpen} onOpenChange={setDriveSettingsOpen}><DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto rounded-3xl border-sky-300/30 bg-slate-50 p-4 sm:p-6"><DialogHeader><DialogTitle>การตั้งค่า Google Drive</DialogTitle></DialogHeader><GoogleDriveSettings /></DialogContent></Dialog>
  </section>;
}
