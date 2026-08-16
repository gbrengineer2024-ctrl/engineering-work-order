import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, PackagePlus, Search, Send, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PartsManagerProps = { open: boolean; onOpenChange: (next: boolean) => void; canManage: boolean };

const THB = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 });

function stockTone(available: number, minimum: number) {
  return available < minimum ? "border-rose-400/35 bg-rose-500/10 text-rose-100" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100";
}

export function PartsManager({ open, onOpenChange, canManage }: PartsManagerProps) {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [showAddPart, setShowAddPart] = useState(false);
  const parts = trpc.parts.list.useQuery({ search: search || undefined, lowStockOnly: lowOnly });
  const issues = trpc.partIssues.list.useQuery();
  const createPart = trpc.parts.create.useMutation();
  const approveIssue = trpc.partIssues.approve.useMutation();
  const issuePart = trpc.partIssues.issue.useMutation();

  const refresh = async () => {
    await Promise.all([utils.parts.list.invalidate(), utils.partIssues.list.invalidate()]);
  };
  const summary = useMemo(() => {
    const rows = parts.data ?? [];
    return { total: rows.length, low: rows.filter(row => row.availableQty < row.minStockQty).length, units: rows.reduce((sum, row) => sum + row.availableQty, 0) };
  }, [parts.data]);

  const submitPart = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await createPart.mutateAsync({
        partCode: String(data.get("partCode")).trim(), partNameTh: String(data.get("partNameTh")).trim(), categoryCode: String(data.get("categoryCode")).trim(), unit: String(data.get("unit")).trim(),
        storageLocation: String(data.get("storageLocation")).trim() || null, minStockQty: Number(data.get("minStockQty") || 0), currentStockQty: Number(data.get("currentStockQty") || 0),
        unitCostThb: Number(data.get("unitCostThb") || 0), supplierName: String(data.get("supplierName")).trim() || null,
      });
      await refresh(); setShowAddPart(false); toast.success("เพิ่มอะไหล่เข้าคลังแล้ว");
    } catch (error) { toast.error(error instanceof Error ? error.message : "ไม่สามารถเพิ่มอะไหล่ได้"); }
  };

  const approve = async (issueId: string, max: number) => {
    const raw = window.prompt(`อนุมัติจำนวน (ไม่เกิน ${max})`, String(max));
    if (raw === null) return;
    try { await approveIssue.mutateAsync({ issueId, qtyApproved: Number(raw) }); await refresh(); toast.success("อนุมัติและกันจำนวนในคลังแล้ว"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "ไม่สามารถอนุมัติได้"); }
  };
  const dispatch = async (issueId: string, max: number) => {
    const raw = window.prompt(`จ่ายจำนวน (ไม่เกิน ${max})`, String(max));
    if (raw === null) return;
    try { await issuePart.mutateAsync({ issueId, qtyIssued: Number(raw) }); await refresh(); toast.success("บันทึกการจ่ายอะไหล่แล้ว"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "ไม่สามารถจ่ายอะไหล่ได้"); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] !w-[calc(100%-1rem)] !max-w-[calc(100%-1rem)] min-w-0 overflow-x-hidden overflow-y-auto rounded-3xl border-indigo-400/25 bg-[#10162e] p-4 text-slate-100 shadow-2xl shadow-black/50 sm:!max-w-[72rem] sm:p-6">
      <DialogHeader className="pr-8"><DialogTitle className="flex items-center gap-2 text-xl text-white"><Wrench className="h-5 w-5 text-violet-300" />คลังอะไหล่และรายการเบิก</DialogTitle><DialogDescription className="text-slate-300">ตรวจสต็อก อนุมัติ และจ่ายอะไหล่ได้จากหน้านี้; การขอเบิกให้เปิดจากรายละเอียดใบงานเพื่อผูกเลขใบงานอัตโนมัติ</DialogDescription></DialogHeader>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-3"><p className="text-xs text-indigo-200">รายการในคลัง</p><p className="mt-1 text-2xl font-bold text-white">{summary.total}</p></div>
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3"><p className="text-xs text-amber-200">คงเหลือรวม</p><p className="mt-1 text-2xl font-bold text-white">{summary.units}</p></div>
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3"><p className="text-xs text-rose-200">ต่ำกว่าขั้นต่ำ</p><p className="mt-1 text-2xl font-bold text-white">{summary.low}</p></div>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row"><label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหารหัสหรือชื่ออะไหล่" className="h-10 border-slate-600 bg-slate-900 pl-9 text-white placeholder:text-slate-500" /></label><Button type="button" variant="outline" onClick={() => setLowOnly(value => !value)} className={lowOnly ? "h-10 w-full shrink-0 border-rose-400/45 bg-rose-500/15 text-rose-100 sm:w-auto" : "h-10 w-full shrink-0 border-slate-600 text-slate-200 sm:w-auto"}><AlertTriangle className="mr-2 h-4 w-4" />ต่ำกว่าขั้นต่ำ</Button></div>{canManage && <div className="flex w-full sm:w-auto"><Button type="button" onClick={() => setShowAddPart(true)} className="h-10 w-full whitespace-normal bg-indigo-500 text-white hover:bg-indigo-400 sm:w-auto sm:whitespace-nowrap"><PackagePlus className="mr-2 h-4 w-4 shrink-0" />เพิ่มอะไหล่</Button></div>}</div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-700"><div className="hidden grid-cols-[1.1fr_1.7fr_.8fr_.8fr_.8fr] gap-3 bg-slate-900/90 px-4 py-3 text-xs font-semibold text-slate-400 md:grid"><span>รหัส</span><span>รายการ</span><span>ที่เก็บ</span><span>พร้อมใช้</span><span>ต้นทุน</span></div><div className="divide-y divide-slate-700/80">{parts.isLoading ? <div className="p-5 text-sm text-slate-400">กำลังโหลดคลังอะไหล่...</div> : (parts.data?.length ? parts.data.map(part => <div key={part.partId} className="grid gap-2 px-4 py-3 md:grid-cols-[1.1fr_1.7fr_.8fr_.8fr_.8fr] md:items-center md:gap-3"><p className="font-mono text-xs text-violet-200">{part.partCode}</p><div><p className="font-semibold text-white">{part.partNameTh}</p><p className="mt-0.5 text-xs text-slate-400">{part.categoryCode} · {part.unit}</p></div><p className="text-sm text-slate-300">{part.storageLocation || "—"}</p><span className={`w-fit rounded-lg border px-2 py-1 text-sm font-semibold ${stockTone(part.availableQty, part.minStockQty)}`}>{part.availableQty} / ขั้นต่ำ {part.minStockQty}</span><p className="text-sm text-slate-200">{THB.format(Number(part.unitCostThb))}</p></div>) : <div className="p-7 text-center text-sm text-slate-400">ไม่พบรายการอะไหล่ตามเงื่อนไขที่เลือก</div>)}</div></div>
      <section className="mt-6"><div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold text-white"><ClipboardList className="h-4 w-4 text-violet-300" />รายการเบิกล่าสุด</h3><span className="text-xs text-slate-400">{issues.data?.length ?? 0} รายการ</span></div><div className="space-y-2">{issues.isLoading ? <p className="text-sm text-slate-400">กำลังโหลดรายการเบิก...</p> : issues.data?.length ? issues.data.map(issue => <div key={issue.issueId} className="flex flex-col gap-3 rounded-2xl border border-slate-700 bg-slate-900/65 p-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-white">{issue.partNameTh}</p><span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-200">{issue.issueStatus}</span></div><p className="mt-1 text-xs text-slate-400">ใบงาน {issue.woId} · ขอ {issue.qtyRequested} {issue.unit} · อนุมัติ {issue.qtyApproved} · จ่าย {issue.qtyIssued}</p></div>{canManage && <div className="flex gap-2">{issue.issueStatus === "REQUESTED" && <Button type="button" size="sm" onClick={() => approve(issue.issueId, issue.qtyRequested)} className="bg-indigo-500 text-white hover:bg-indigo-400"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />อนุมัติ</Button>}{issue.issueStatus === "APPROVED" && <Button type="button" size="sm" onClick={() => dispatch(issue.issueId, issue.qtyApproved)} className="bg-emerald-600 text-white hover:bg-emerald-500"><Send className="mr-1 h-3.5 w-3.5" />จ่าย</Button>}</div>}</div>) : <p className="rounded-2xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-400">ยังไม่มีรายการเบิกอะไหล่</p>}</div></section>
      <Dialog open={showAddPart} onOpenChange={setShowAddPart}><DialogContent className="w-[calc(100%-1.5rem)] max-w-lg rounded-3xl border-indigo-400/25 bg-[#161d3a] text-slate-100"><DialogHeader><DialogTitle>เพิ่มอะไหล่เข้าคลัง</DialogTitle><DialogDescription className="text-slate-300">กรอกข้อมูลหลักและจำนวนเริ่มต้นของอะไหล่</DialogDescription></DialogHeader><form onSubmit={submitPart} className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">รหัสอะไหล่<Input required name="partCode" className="mt-1 bg-slate-900" /></label><label className="text-sm">ชื่ออะไหล่<Input required name="partNameTh" className="mt-1 bg-slate-900" /></label><label className="text-sm">หมวดหมู่<Input required name="categoryCode" placeholder="เช่น ELECTRICAL" className="mt-1 bg-slate-900" /></label><label className="text-sm">หน่วย<Input required name="unit" placeholder="ชิ้น" className="mt-1 bg-slate-900" /></label><label className="text-sm">จำนวนเริ่มต้น<Input required type="number" min="0" name="currentStockQty" defaultValue="0" className="mt-1 bg-slate-900" /></label><label className="text-sm">จำนวนขั้นต่ำ<Input required type="number" min="0" name="minStockQty" defaultValue="0" className="mt-1 bg-slate-900" /></label><label className="text-sm">ต้นทุนต่อหน่วย<Input required type="number" min="0" step="0.01" name="unitCostThb" defaultValue="0" className="mt-1 bg-slate-900" /></label><label className="text-sm">จุดจัดเก็บ<Input name="storageLocation" className="mt-1 bg-slate-900" /></label></div><label className="block text-sm">ผู้จำหน่าย<Input name="supplierName" className="mt-1 bg-slate-900" /></label><Button type="submit" disabled={createPart.isPending} className="w-full bg-indigo-500 text-white hover:bg-indigo-400">{createPart.isPending ? "กำลังบันทึก..." : "บันทึกอะไหล่"}</Button></form></DialogContent></Dialog>
    </DialogContent>
  </Dialog>;
}
