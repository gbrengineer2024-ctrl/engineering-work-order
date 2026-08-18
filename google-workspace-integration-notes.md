# บันทึกการเชื่อมต่อ Google Workspace

## Google Sheets ต้นทาง

ตรวจสอบและปรับปรุงเมื่อวันที่ 15 สิงหาคม 2026 ผ่าน Google Workspace ที่ผู้ใช้อนุมัติแล้ว

- Spreadsheet: [Hotel Maintenance workbook](https://docs.google.com/spreadsheets/d/1_YUz6QKnMCt-5Pl94WrAh7oFxO7RgAsbH3-tqshS7Z4/edit)
- Spreadsheet ID: `1_YUz6QKnMCt-5Pl94WrAh7oFxO7RgAsbH3-tqshS7Z4`
- แท็บที่มีอยู่เดิม: `01_Users`, `03_Work_Orders`, `04_Status_Log`, `06_Lookups`, `07_Attachments`, `08_Notifications`, `09_API_Dictionary`, `10_Parts`, `11_Part_Issues`
- แท็บที่เพิ่มแล้ว: `12_Role_Permissions` (ตารางสิทธิ์ `ADMIN`, `SUPERVISOR`, `TECHNICIAN`, `REPORTER` ตาม RBAC ที่บังคับใช้ที่ฝั่งเซิร์ฟเวอร์)

## ขอบเขตที่ต้องยืนยันก่อนเขียน

ผู้ใช้ร้องขอให้เพิ่มชีตแสดง Role และสิทธิ์ จึงเพิ่มแท็บ `12_Role_Permissions` พร้อมข้อมูลสิทธิ์แล้ว โดยแท็บดังกล่าวเป็นเอกสารอ้างอิง ไม่ใช่แหล่งข้อมูลสิทธิ์ของแอป ซึ่งยังใช้ฐานข้อมูล TiDB/MySQL เป็นแหล่งข้อมูลหลัก

สร้างโครงสร้างโฟลเดอร์ Google Drive แล้วดังนี้

- `HotelMaintenance` — Folder ID: `1IVskmqvhfssR2dqIQczv2Uo5AW131Kkm`
- `HotelMaintenance/WorkOrders` — Folder ID: `1ealFTh1rxz2Bt7D7Yij4KpnK0j9ZoC3K`

การเก็บรูปใหม่บน Google Drive จากเว็บแอปที่เผยแพร่ ต้องทำผ่านการเชื่อมต่อ Google Drive ฝั่งเซิร์ฟเวอร์โดยเฉพาะ ไม่สามารถเรียกคำสั่งภายใน sandbox จาก runtime ของเว็บได้. ผู้ใช้ยืนยันเมื่อวันที่ 15 สิงหาคม 2026 ให้ยังไม่เปิดใช้การเชื่อมต่อนี้ ดังนั้นรูปเดิมและรูปที่เพิ่มใหม่จะจัดเก็บและแสดงผ่าน S3 ต่อไปโดยไม่กระทบการใช้งาน. โครงสร้างโฟลเดอร์ Drive ที่สร้างไว้คงอยู่เพื่อใช้อ้างอิง หากผู้ใช้ต้องการเปิดใช้ในอนาคตจึงต้องเพิ่ม credentials ที่จัดเก็บอย่างปลอดภัยและกำหนดสิทธิ์เข้าถึงโฟลเดอร์ดังกล่าว.

## สถานะการเชื่อมต่อฝั่งเซิร์ฟเวอร์ (อัปเดต 18 สิงหาคม 2026)

ผู้ใช้ยืนยันให้เริ่มเชื่อมต่อ Google Drive จริงสำหรับเก็บรูปก่อน/หลังงาน จึงเพิ่มโค้ดฝั่งเซิร์ฟเวอร์แล้วที่ `server/googleDrive.ts`:

- เซ็น JWT (RS256) เองด้วย Web Crypto (`crypto.subtle`) เพื่อขอ access token จาก service account — ไม่พึ่ง SDK `googleapis`/`google-auth-library` เพื่อให้รันได้ทั้งบน Cloudflare Workers และ Node
- อัปโหลดไฟล์ไปยังโฟลเดอร์ `HotelMaintenance/WorkOrders` (`1ealFTh1rxz2Bt7D7Yij4KpnK0j9ZoC3K`) ด้วย multipart upload
- ตั้งสิทธิ์ไฟล์เป็น "anyone with the link" (reader) แล้วคืนลิงก์ดูตรง `https://drive.google.com/uc?export=view&id=...` เก็บใน `attachments.fileUrl` เหมือนรูปแบบเดิมของ Forge/S3 — ไม่ต้องแก้ schema หรือฝั่ง client
- `server/routers.ts` (`workOrders.uploadAttachment`) เช็ค `google_drive_integration_settings.isEnabled` ก่อนทุกครั้ง: ถ้าเปิดใช้งานจะอัปโหลดผ่าน Drive ถ้ายังปิดอยู่จะ fallback ไปที่ Forge/S3 เหมือนเดิม (ไม่กระทบของเก่า)
- มีเทสต์ครอบคลุมที่ `server/googleDrive.test.ts` (mock fetch เต็มรูปแบบ ไม่เรียก Google API จริง)

**ที่ยังต้องทำก่อนใช้งานจริงได้:**

1. สร้างหรือใช้ service account เดิมใน Google Cloud แล้วแชร์โฟลเดอร์ `HotelMaintenance/WorkOrders` ให้ email ของ service account นั้น (สิทธิ์ Editor) — service account จะเข้าถึงโฟลเดอร์ไม่ได้เลยถ้าไม่แชร์
2. ตั้งค่า Cloudflare secrets สองตัว: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`
3. เปิดสวิตช์ `isEnabled` ผ่านหน้าตั้งค่าแอดมิน "Google Drive" (หรือเขียนตรงลง `google_drive_integration_settings` ผ่าน DB)
4. Deploy โค้ดที่แก้ไขนี้ขึ้น production (ปัจจุบัน production Worker ยังไม่มีโค้ดชุดนี้)

