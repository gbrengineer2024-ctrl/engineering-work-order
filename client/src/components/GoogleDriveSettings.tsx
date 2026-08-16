import { useEffect, useState } from "react";
import { CloudCog, ExternalLink, FolderOpen, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { extractGoogleDriveFolderId } from "@/lib/googleDriveSettings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function GoogleDriveSettings() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isAdmin = user?.role === "ADMIN";
  const settings = trpc.integrations.googleDrive.settings.useQuery(undefined, { enabled: isAdmin });
  const [isEnabled, setIsEnabled] = useState(false);
  const [rootFolderUrl, setRootFolderUrl] = useState("");
  const [rootFolderId, setRootFolderId] = useState("");

  useEffect(() => {
    if (!settings.data) return;
    setIsEnabled(settings.data.isEnabled);
    setRootFolderUrl(settings.data.rootFolderUrl ?? "");
    setRootFolderId(settings.data.rootFolderId ?? "");
  }, [settings.data]);

  const save = trpc.integrations.googleDrive.save.useMutation({
    onSuccess: async () => {
      await utils.integrations.googleDrive.settings.invalidate();
      toast.success("บันทึกปลายทาง Google Drive แล้ว");
    },
    onError: error => toast.error(`บันทึกการตั้งค่าไม่สำเร็จ: ${error.message}`),
  });

  const applyFolderReference = (value: string) => {
    setRootFolderUrl(value);
    const detectedId = extractGoogleDriveFolderId(value);
    if (detectedId) setRootFolderId(detectedId);
  };

  if (!isAdmin) return null;

  const hasFolderReference = Boolean(rootFolderId.trim());
  const status = !hasFolderReference
    ? "ยังไม่ได้กำหนดโฟลเดอร์"
    : isEnabled
      ? "เปิดใช้ลิงก์อ้างอิง Drive แล้ว"
      : "บันทึกเป็นข้อมูลอ้างอิง";

  return <Card className="border-sky-400/25 bg-gradient-to-br from-slate-950 via-sky-950/80 to-indigo-950/80 text-slate-100 shadow-sm">
    <CardHeader className="pb-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700"><CloudCog className="h-5 w-5" /></div>
        <div className="min-w-0"><CardTitle>ลิงก์ Google Drive สำหรับรูปใบงาน</CardTitle><p className="mt-1 text-xs leading-5 text-slate-300">กำหนดลิงก์โฟลเดอร์อ้างอิงได้ที่นี่ โดยไม่บันทึกบัญชีหรือข้อมูลลับในฐานข้อมูล</p></div>
      </div>
    </CardHeader>
    <CardContent>
      <form className="space-y-4" onSubmit={event => {
        event.preventDefault();
        const folderId = rootFolderId.trim() || extractGoogleDriveFolderId(rootFolderUrl);
        save.mutate({
          isEnabled,
          rootFolderId: folderId || null,
          rootFolderUrl: rootFolderUrl.trim() || null,
        });
      }}>
        <label className="block text-sm font-semibold text-slate-100">ลิงก์โฟลเดอร์ Google Drive<Input value={rootFolderUrl} onChange={event => applyFolderReference(event.target.value)} placeholder="https://drive.google.com/drive/folders/..." className="mt-2 h-11 rounded-xl border-sky-400/30 bg-slate-900 text-slate-100" /></label>
        <label className="block text-sm font-semibold text-slate-100">Folder ID<Input value={rootFolderId} onChange={event => setRootFolderId(event.target.value)} placeholder="ระบบกรอกจากลิงก์ให้ได้" className="mt-2 h-11 rounded-xl border-sky-400/30 bg-slate-900 text-slate-100" /></label>
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-sky-400/25 bg-slate-900/75 p-4 text-sm">
          <span><b className="block text-slate-100">เปิดใช้ลิงก์อ้างอิง Google Drive</b><small className="mt-1 block leading-5 text-slate-300">ลิงก์นี้ใช้เปิดโฟลเดอร์จากหน้า Settings เท่านั้น; รูปในใบงานยังเก็บใน S3</small></span>
          <input aria-label="เปิดใช้ปลายทาง Google Drive" type="checkbox" checked={isEnabled} onChange={event => setIsEnabled(event.target.checked)} />
        </label>
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4">
          <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" /><div><p className="text-sm font-semibold text-slate-100">สถานะ: {status}</p><p className="mt-1 text-xs leading-5 text-slate-300">การตั้งค่านี้เก็บเฉพาะโฟลเดอร์ปลายทาง ไม่มี Service Account JSON หรือข้อมูลลับแสดงในหน้า Settings</p></div></div>
          {settings.data?.rootFolderUrl && <a href={settings.data.rootFolderUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-300 hover:text-sky-100"><FolderOpen className="h-3.5 w-3.5" />เปิดโฟลเดอร์ที่บันทึกไว้<ExternalLink className="h-3.5 w-3.5" /></a>}
        </div>
        <div className="flex justify-end"><Button type="submit" disabled={save.isPending} className="h-10 rounded-xl bg-sky-700 hover:bg-sky-800">{save.isPending ? "กำลังบันทึก..." : "บันทึกการตั้งค่า Drive"}</Button></div>
      </form>
    </CardContent>
  </Card>;
}
