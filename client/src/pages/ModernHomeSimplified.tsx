import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getBeforePhotoValidationError, readFileAsDataUrl } from "@/lib/workOrderPhotos";
import { createWorkOrderWithBeforePhoto } from "@/lib/workOrderPhotoFlow";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AlertTriangle, Bell, Camera, CheckCircle2, ClipboardList, Clock3, ImagePlus, LayoutDashboard, MapPin, Menu, Package, Plus, Search, Settings2, Users2, Wrench, X } from "lucide-react";

const roleLabels: Record<string, string> = { ADMIN: "ผู้ดูแลระบบ", REPORTER: "ผู้แจ้งงาน", SUPERVISOR: "หัวหน้างาน", TECHNICIAN: "ช่างเทคนิค" };
const statusLabels: Record<string, string> = { OPEN: "เปิดงาน", ASSIGNED: "มอบหมายแล้ว", IN_PROGRESS: "กำลังดำเนินการ", COMPLETED: "เสร็จงาน", CLOSED: "ปิดงาน" };
const statusStyles: Record<string, string> = { OPEN: "bg-sky-400/10 text-sky-200 ring-sky-300/25", ASSIGNED: "bg-violet-400/10 text-violet-200 ring-violet-300/25", IN_PROGRESS: "bg-amber-400/10 text-amber-200 ring-amber-300/25", COMPLETED: "bg-emerald-400/10 text-emerald-200 ring-emerald-300/25", CLOSED: "bg-slate-400/10 text-slate-300 ring-slate-300/20" };
const priorityStyles: Record<string, string> = { URGENT: "text-rose-200", HIGH: "text-orange-200", MEDIUM: "text-amber-200", LOW: "text-slate-300" };
const navItems = [
  { id: "overview", label: "ภาพรวม", icon: LayoutDashboard },
  { id: "orders", label: "ใบงาน", icon: ClipboardList },
  { id: "parts", label: "อะไหล่", icon: Package },
  { id: "technicians", label: "ช่าง", icon: Wrench },
  { id: "users", label: "ผู้ใช้งาน", icon: Users2, admin: true },
  { id: "settings", label: "ตั้งค่า", icon: Settings2, admin: true },
] as const;

function formatDate(value: unknown, detail = false) {
  if (!value) return "—";
  return new Date(value as string).toLocaleString("th-TH", detail ? { dateStyle: "medium", timeStyle: "short" } : { day: "2-digit", month: "short" });
}

function StatusPill({ status }: { status: string }) {
  return <span className={cn("inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset", statusStyles[status] ?? statusStyles.OPEN)}>{statusLabels[status] ?? status}</span>;
}

function LoginShell({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_16%_12%,rgba(99,102,241,.25),transparent_30%),radial-gradient(circle_at_84%_86%,rgba(56,189,248,.14),transparent_28%),#080d1c] p-4"><main className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-950/75 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">{children}</main></div>;
}

function LoginScreen() {
  return <LoginShell><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-600 text-white shadow-lg shadow-indigo-950/60"><Wrench className="h-6 w-6" /></div><p className="mt-7 text-[11px] font-bold tracking-[.22em] text-indigo-300">NORTHSTAR HOTEL</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-white">ศูนย์งานซ่อมบำรุง</h1><p className="mt-3 text-sm leading-6 text-slate-300">เข้าสู่ระบบด้วย LINE เพื่อแจ้งซ่อม ติดตามงาน และบันทึกหลักฐานการปฏิบัติงาน</p><a className="mt-7 flex h-12 items-center justify-center rounded-xl bg-[#06C755] text-sm font-bold text-white shadow-lg shadow-emerald-950/40 transition-colors hover:bg-[#05b64c]" href={`/api/auth/line/start?returnTo=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`}>เข้าสู่ระบบด้วย LINE</a></LoginShell>;
}

function Registration({ name, pending, error, onSubmit }: { name: string; pending: boolean; error?: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <LoginShell><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-400/15 text-indigo-200"><Users2 className="h-6 w-6" /></div><p className="mt-7 text-[11px] font-bold tracking-[.22em] text-indigo-300">ลงทะเบียนครั้งแรก</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-white">ข้อมูลผู้ใช้งาน</h1><p className="mt-3 text-sm leading-6 text-slate-300">ข้อมูลนี้จะใช้ระบุผู้แจ้งในใบงานโดยอัตโนมัติ</p><form className="mt-7 space-y-4" onSubmit={onSubmit}><label className="block text-sm font-semibold text-slate-200">ชื่อที่แสดง<Input required name="displayName" defaultValue={name} className="mt-2 h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-slate-500" /></label><label className="block text-sm font-semibold text-slate-200">แผนก<select required name="department" defaultValue="" className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-white"><option value="" disabled>เลือกแผนก</option><option value="FRONT_OFFICE">แผนกต้อนรับ</option><option value="HOUSEKEEPING">แผนกแม่บ้าน</option><option value="FOOD_AND_BEVERAGE">แผนกอาหารและเครื่องดื่ม</option><option value="ENGINEERING">แผนกช่างและวิศวกรรม</option><option value="SECURITY">แผนกรักษาความปลอดภัย</option><option value="FINANCE">แผนกการเงิน</option><option value="ADMINISTRATION">แผนกบริหาร</option><option value="OTHER">อื่น ๆ</option></select></label>{error && <p className="rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}<Button disabled={pending} className="h-11 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 font-bold text-white hover:from-indigo-400 hover:to-violet-500">{pending ? "กำลังบันทึก..." : "บันทึกและเริ่มใช้งาน"}</Button></form></LoginShell>;
}

function CreateWorkOrderDialog({ open, onOpenChange, locations, displayName }: { open: boolean; onOpenChange: (value: boolean) => void; locations: any[]; displayName: string }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const create = trpc.workOrders.create.useMutation();
  const upload = trpc.workOrders.uploadAttachment.useMutation();
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const resetPhoto = () => { if (preview) URL.revokeObjectURL(preview); setPhoto(null); setPreview(null); };
  const close = (next: boolean) => { if (!next) { resetPhoto(); setMessage(null); } onOpenChange(next); };
  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = getBeforePhotoValidationError(file);
    if (validationError) { setMessage(validationError); event.target.value = ""; return; }
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file); setPreview(URL.createObjectURL(file)); setMessage(null);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    const values = new FormData(event.currentTarget);
    try {
      await createWorkOrderWithBeforePhoto({
        draft: { locationId: String(values.get("locationId")), categoryCode: String(values.get("categoryCode")), priorityCode: String(values.get("priorityCode")), description: String(values.get("description")), subCategory: String(values.get("subCategory") || "") },
        uploadedBy: user.openId,
        beforePhotos: photo ? [{ fileName: photo.name, mimeType: photo.type, fileDataBase64: await readFileAsDataUrl(photo) }] : [],
        createWorkOrder: create.mutateAsync,
        uploadAttachment: upload.mutateAsync,
      });
      await Promise.all([utils.workOrders.list.invalidate(), utils.dashboard.stats.invalidate()]);
      setMessage(photo ? "สร้างใบงานและบันทึกรูปก่อนงานเรียบร้อยแล้ว" : "สร้างใบงานเรียบร้อยแล้ว");
      resetPhoto();
      window.setTimeout(() => close(false), 600);
    } catch (error) {
      const text = error instanceof Error ? error.message : "ไม่สามารถบันทึกใบงานได้";
      setMessage(text.includes("Attachment") ? "สร้างใบงานแล้ว แต่แนบรูปไม่สำเร็จ กรุณาเพิ่มจากรายละเอียดใบงาน" : "ไม่สามารถสร้างใบงานได้ กรุณาลองใหม่");
    }
  };
  const isSaving = create.isPending || upload.isPending;
  return <Dialog open={open} onOpenChange={close}><DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] overflow-y-auto rounded-3xl border-white/10 bg-slate-950 p-5 text-slate-100 shadow-2xl shadow-black/60 sm:max-w-lg sm:p-6"><DialogHeader><DialogTitle className="text-xl text-white">สร้างใบงาน</DialogTitle><DialogDescription className="text-slate-400">ผู้แจ้งจะถูกบันทึกจากบัญชี LINE โดยอัตโนมัติ และสามารถแนบรูปสภาพก่อนเริ่มงานได้</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4 pt-2"><div className="rounded-2xl border border-indigo-300/15 bg-indigo-400/10 p-3 text-sm text-indigo-100">ผู้แจ้ง: <b>{displayName}</b></div><label className="block text-sm font-semibold">พื้นที่<select required name="locationId" defaultValue="" className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-white"><option value="" disabled>เลือกพื้นที่</option>{locations.map(location => <option key={location.locationId} value={location.locationId}>{location.areaName}</option>)}</select></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold">หมวดหมู่<select required name="categoryCode" defaultValue="" className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-white"><option value="" disabled>เลือกหมวดหมู่</option><option>PLUMBING</option><option>ELECTRICAL</option><option>HVAC</option><option>EQUIPMENT</option><option>SAFETY</option><option>CIVIL</option></select></label><label className="block text-sm font-semibold">ความสำคัญ<select required name="priorityCode" defaultValue="MEDIUM" className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-white"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></label></div><label className="block text-sm font-semibold">หมวดย่อย<Input name="subCategory" placeholder="เช่น ท่อน้ำทิ้งฝักบัว" className="mt-2 h-11 rounded-xl border-white/10 bg-slate-900 text-white placeholder:text-slate-500" /></label><label className="block text-sm font-semibold">รายละเอียดปัญหา<Textarea required name="description" placeholder="อธิบายอาการหรือผลกระทบ เพื่อให้ช่างเตรียมงานได้ถูกต้อง" className="mt-2 min-h-28 rounded-xl border-white/10 bg-slate-900 text-white placeholder:text-slate-500" /></label><div className="rounded-2xl border border-dashed border-indigo-300/35 bg-indigo-400/5 p-4"><div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-bold text-indigo-100"><Camera className="h-4 w-4" />รูปภาพก่อนงาน <span className="font-normal text-slate-400">(ไม่บังคับ)</span></p><p className="mt-1 text-xs leading-5 text-slate-400">รองรับไฟล์รูปภาพขนาดไม่เกิน 8 MB</p></div>{photo && <button type="button" onClick={resetPhoto} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="ลบรูปก่อนงาน"><X className="h-4 w-4" /></button>}</div>{preview ? <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/20"><img src={preview} alt="ตัวอย่างรูปก่อนงาน" className="h-40 w-full object-cover" /><p className="truncate px-3 py-2 text-xs text-slate-400">{photo?.name}</p></div> : <label className="mt-3 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-indigo-300/30 px-4 text-center text-sm text-indigo-100 transition-colors hover:bg-indigo-400/10"><ImagePlus className="mb-2 h-5 w-5" />แตะเพื่อถ่ายหรือเลือกรูปก่อนงาน<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={choosePhoto} /></label>}</div>{message && <p className={cn("rounded-xl p-3 text-sm", message.includes("เรียบร้อย") ? "bg-emerald-400/10 text-emerald-200" : "bg-rose-400/10 text-rose-200")}>{message}</p>}<Button type="submit" disabled={isSaving || locations.length === 0} className="h-11 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 font-bold text-white hover:from-indigo-400 hover:to-violet-500">{isSaving ? "กำลังบันทึก..." : "สร้างใบงาน"}</Button></form></DialogContent></Dialog>;
}

function WorkOrders({ orders, onSelect, compact = false }: { orders: any[]; onSelect: (order: any) => void; compact?: boolean }) {
  const shown = compact ? orders.slice(0, 6) : orders;
  if (!shown.length) return <Card className="border-white/10 bg-white/[.035]"><CardContent className="p-8 text-center text-sm text-slate-400">ยังไม่มีใบงานที่ตรงกับเงื่อนไข</CardContent></Card>;
  return <div className="space-y-3">{shown.map(order => <button type="button" key={order.woId} onClick={() => onSelect(order)} className="group flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-4 text-left transition-colors hover:border-indigo-300/25 hover:bg-white/[.06] sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-white">{order.woId}</p><StatusPill status={order.statusCode} /></div><p className="mt-1 line-clamp-1 text-sm text-slate-300">{order.description}</p><p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{order.areaName ?? order.locationId}</span><span>{formatDate(order.createdAt, true)}</span></p></div><div className="flex shrink-0 items-center justify-between gap-3 sm:block sm:text-right"><p className={cn("text-xs font-bold", priorityStyles[order.priorityCode] ?? "text-slate-300")}>{order.priorityCode}</p><p className="mt-0 text-xs text-slate-500">ดูรายละเอียด</p></div></button>)}</div>;
}

function Stat({ label, value, icon: Icon, className }: { label: string; value: number | string; icon: any; className: string }) {
  return <Card className="border-white/10 bg-white/[.045] shadow-none"><CardContent className="flex items-center justify-between p-4"><div><p className="text-[11px] font-medium text-slate-400">{label}</p><p className="mt-1 text-2xl font-bold tracking-tight text-white">{value}</p></div><div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", className)}><Icon className="h-5 w-5" /></div></CardContent></Card>;
}

function WorkOrderDetail({ order, onClose }: { order: any; onClose: () => void }) {
  const detail = trpc.workOrders.detail.useQuery({ woId: order.woId });
  const attachments = (detail.data as any)?.attachments ?? [];
  return <Dialog open onOpenChange={next => !next && onClose()}><DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] overflow-y-auto rounded-3xl border-white/10 bg-slate-950 p-5 text-slate-100 sm:max-w-2xl sm:p-6"><DialogHeader><DialogTitle className="flex flex-wrap items-center gap-2 text-white">{order.woId}<StatusPill status={order.statusCode} /></DialogTitle><DialogDescription className="text-slate-400">รายละเอียดและหลักฐานของใบงาน</DialogDescription></DialogHeader><div className="space-y-5 pt-2"><div className="rounded-2xl bg-white/[.045] p-4"><p className="text-sm leading-6 text-slate-200">{order.description}</p><p className="mt-3 text-xs text-slate-500">พื้นที่: {order.areaName ?? order.locationId} · สร้างเมื่อ {formatDate(order.createdAt, true)}</p></div><div><p className="mb-3 text-sm font-bold text-white">รูปภาพประกอบ</p>{detail.isLoading ? <p className="text-sm text-slate-400">กำลังโหลดหลักฐาน...</p> : attachments.length ? <div className="grid gap-3 sm:grid-cols-2">{attachments.map((item: any) => <a key={item.attachmentId} href={item.fileUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.035]"><img src={item.fileUrl} alt={item.attachmentType === "BEFORE" ? "รูปก่อนงาน" : "รูปหลังงาน"} className="h-36 w-full object-cover" /><p className="p-3 text-xs font-semibold text-slate-200">{item.attachmentType === "BEFORE" ? "รูปก่อนงาน" : item.attachmentType === "AFTER" ? "รูปหลังงาน" : "เอกสาร/รูปอื่น"}</p></a>)}</div> : <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-400">ยังไม่มีรูปภาพประกอบใบงาน</p>}</div></div></DialogContent></Dialog>;
}

export default function ModernHome() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const profile = trpc.profile.me.useQuery(undefined, { enabled: Boolean(user) });
  const stats = trpc.dashboard.stats.useQuery();
  const workOrders = trpc.workOrders.list.useQuery();
  const locations = trpc.locations.list.useQuery();
  const technicians = trpc.technicians.list.useQuery();
  const parts = trpc.parts.list.useQuery();
  const notifications = trpc.notifications.list.useQuery(undefined, { enabled: Boolean(user) });
  const registration = trpc.profile.completeRegistration.useMutation({ onSuccess: async () => { await utils.profile.me.invalidate(); } });
  const [section, setSection] = useState<(typeof navItems)[number]["id"]>("overview");
  const [createOpen, setCreateOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [registrationError, setRegistrationError] = useState("");
  const [authTimedOut, setAuthTimedOut] = useState(false);

  useEffect(() => {
    if (!loading && !profile.isLoading) { setAuthTimedOut(false); return; }
    const timer = window.setTimeout(() => setAuthTimedOut(true), 7_000);
    return () => window.clearTimeout(timer);
  }, [loading, profile.isLoading]);

  if (loading || profile.isLoading) return <LoginShell>{authTimedOut ? <div className="text-center"><p className="text-sm text-slate-300">การตรวจสอบ session ใช้เวลานานกว่าปกติ</p><div className="mt-5 flex flex-col gap-2"><Button variant="outline" onClick={() => window.location.reload()} className="border-white/15 text-slate-100 hover:bg-white/10 hover:text-white">ตรวจสอบใหม่</Button><a href={`/api/auth/line/start?returnTo=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`} className="flex h-10 items-center justify-center rounded-xl bg-[#06C755] text-sm font-bold text-white hover:bg-[#05b64c]">เข้าสู่ระบบด้วย LINE</a></div></div> : <p className="text-center text-sm text-slate-300">กำลังตรวจสอบการเข้าสู่ระบบ...</p>}</LoginShell>;
  if (!user) return <LoginScreen />;
  if (profile.data?.needsRegistration) return <Registration name={user.name ?? ""} pending={registration.isPending} error={registrationError} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); setRegistrationError(""); registration.mutate({ displayName: String(data.get("displayName")), department: String(data.get("department")) }, { onError: error => setRegistrationError(error.message || "ไม่สามารถบันทึกข้อมูลได้") }); }} />;

  const activeProfile = profile.data?.profile;
  const role = activeProfile?.roleCode ?? "REPORTER";
  const isAdmin = role === "ADMIN";
  const orders = workOrders.data ?? [];
  const filteredOrders = orders.filter(order => `${order.woId} ${order.description} ${(order as any).areaName ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const nav = navItems.filter(item => !(item as { admin?: boolean }).admin || isAdmin);
  const contentTitle = nav.find(item => item.id === section)?.label ?? "ภาพรวม";
  const isCreatingAllowed = section === "overview" || section === "orders";

  return <div className="min-h-screen bg-[#080d1c] text-slate-100"><div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(99,102,241,.15),transparent_30%),radial-gradient(circle_at_90%_90%,rgba(14,165,233,.10),transparent_28%)]" /><div className="relative mx-auto flex min-h-screen max-w-[1120px]"><aside className={cn("fixed inset-y-0 left-0 z-40 w-72 border-r border-white/10 bg-slate-950/95 p-5 backdrop-blur-xl transition-transform md:sticky md:top-0 md:h-screen md:w-60 md:translate-x-0", menuOpen ? "translate-x-0" : "-translate-x-full")}><div className="flex items-center gap-3 px-2"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-600 text-white"><Wrench className="h-5 w-5" /></div><div><p className="text-[10px] font-bold tracking-[.17em] text-indigo-300">NORTHSTAR HOTEL</p><p className="font-bold text-white">Maintenance</p></div><button className="ml-auto rounded-lg p-2 text-slate-400 md:hidden" onClick={() => setMenuOpen(false)} aria-label="ปิดเมนู"><X className="h-5 w-5" /></button></div><nav className="mt-8 space-y-1">{nav.map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => { setSection(item.id); setMenuOpen(false); }} className={cn("flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors", section === item.id ? "bg-indigo-400/15 text-indigo-100" : "text-slate-400 hover:bg-white/[.06] hover:text-slate-100")}><Icon className="h-4.5 w-4.5" />{item.label}</button>; })}</nav><div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/10 bg-white/[.035] p-3"><p className="truncate text-sm font-bold text-white">{activeProfile?.displayName ?? user.name}</p><p className="mt-0.5 text-xs text-slate-500">{roleLabels[role] ?? role}</p></div></aside>{menuOpen && <button aria-label="ปิดเมนูด้านข้าง" className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setMenuOpen(false)} />}<main className="min-w-0 flex-1 px-4 pb-10 pt-4 sm:px-6 md:ml-0 md:px-8 md:pt-7"><header className="flex items-center justify-between gap-3 border-b border-white/10 pb-4"><div className="flex min-w-0 items-center gap-3"><button className="rounded-xl border border-white/10 bg-white/[.045] p-2.5 text-slate-300 md:hidden" onClick={() => setMenuOpen(true)} aria-label="เปิดเมนู"><Menu className="h-5 w-5" /></button><div className="min-w-0"><p className="text-xs font-semibold text-indigo-300">OPERATIONS CENTER</p><h1 className="truncate text-xl font-bold tracking-tight text-white sm:text-2xl">{contentTitle}</h1></div></div><div className="flex items-center gap-2"><div className="hidden rounded-xl border border-white/10 bg-white/[.035] px-3 py-2 text-xs text-slate-400 sm:flex sm:items-center sm:gap-2"><Bell className="h-4 w-4 text-indigo-300" />{notifications.data?.filter(item => !item.isRead).length ?? 0} แจ้งเตือนใหม่</div>{isCreatingAllowed && <Button onClick={() => setCreateOpen(true)} className="h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-3 font-bold text-white hover:from-indigo-400 hover:to-violet-500 sm:h-11 sm:px-4"><Plus className="mr-1.5 h-4 w-4" />สร้างใบงาน</Button>}</div></header><div className="mt-6">{section === "overview" && <div className="space-y-6"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="ใบงานทั้งหมด" value={stats.data?.total ?? orders.length} icon={ClipboardList} className="bg-indigo-400/15 text-indigo-200" /><Stat label="กำลังดำเนินการ" value={orders.filter(order => ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(order.statusCode)).length} icon={Clock3} className="bg-amber-400/15 text-amber-200" /><Stat label="เกิน SLA" value={stats.data?.overdue ?? 0} icon={AlertTriangle} className="bg-rose-400/15 text-rose-200" /><Stat label="เสร็จวันนี้" value={stats.data?.today ?? 0} icon={CheckCircle2} className="bg-emerald-400/15 text-emerald-200" /></div><div><div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-white">ใบงานล่าสุด</h2><button onClick={() => setSection("orders")} className="text-xs font-semibold text-indigo-300 hover:text-indigo-100">ดูทั้งหมด</button></div><WorkOrders orders={orders} onSelect={setSelected} compact /></div></div>}{section === "orders" && <div className="space-y-4"><div className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[.035] px-3"><Search className="h-4 w-4 text-slate-500" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหารหัสใบงาน พื้นที่ หรือรายละเอียด" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600" /></div><WorkOrders orders={filteredOrders} onSelect={setSelected} /></div>}{section === "parts" && <Card className="border-white/10 bg-white/[.035]"><CardHeader><CardTitle className="text-white">คลังอะไหล่</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-400">แสดงรายการอะไหล่ {parts.data?.length ?? 0} รายการจากข้อมูลจริง</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{(parts.data ?? []).slice(0, 8).map((part: any) => <div key={part.partId} className="rounded-xl border border-white/10 p-3"><p className="font-semibold text-slate-100">{part.partName}</p><p className="mt-1 text-xs text-slate-500">คงเหลือ {part.currentQty ?? 0} {part.uom ?? "ชิ้น"}</p></div>)}</div></CardContent></Card>}{section === "technicians" && <Card className="border-white/10 bg-white/[.035]"><CardHeader><CardTitle className="text-white">ช่างเทคนิค</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{(technicians.data ?? []).map((technician: any) => <div key={technician.techId} className="rounded-2xl border border-white/10 p-4"><p className="font-bold text-white">{technician.techName}</p><p className="mt-1 text-sm text-slate-400">{technician.teamCode ?? "ฝ่ายช่าง"}</p><p className="mt-3 text-xs text-indigo-200">งานเปิด {technician.currentOpenJobs ?? 0} / {technician.maxOpenJobs ?? 0}</p></div>)}{!(technicians.data ?? []).length && <p className="text-sm text-slate-400">ยังไม่มีช่างที่เปิดใช้งาน</p>}</CardContent></Card>}{section === "users" && <Card className="border-white/10 bg-white/[.035]"><CardHeader><CardTitle className="text-white">ผู้ใช้งาน</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-400">ผู้ดูแลระบบสามารถจัดการชื่อ แผนก บทบาท และสถานะผู้ใช้งานได้จากเมนูนี้</p></CardContent></Card>}{section === "settings" && <Card className="border-white/10 bg-white/[.035]"><CardHeader><CardTitle className="text-white">ตั้งค่า</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-400">การตั้งค่า LINE Messaging API และการแจ้งเตือนสำหรับผู้ดูแลระบบ</p></CardContent></Card>}</div></main></div><CreateWorkOrderDialog open={createOpen} onOpenChange={setCreateOpen} locations={locations.data ?? []} displayName={activeProfile?.displayName ?? user.name ?? "ผู้แจ้งงาน"} />{selected && <WorkOrderDetail order={selected} onClose={() => setSelected(null)} />}</div>;
}
