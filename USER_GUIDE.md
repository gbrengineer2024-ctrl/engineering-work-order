# Hotel Maintenance WebApp — User Guide

## ภาพรวม

ระบบนี้เป็น Work Order Management System สำหรับโรงแรมหรืออาคาร ใช้จัดการใบแจ้งซ่อม สถานที่ ช่าง สถานะ SLA และการแจ้งเตือนจากข้อมูลที่นำเข้าจาก Google Sheets

## สถานะและสิทธิ์

สถานะใบงานใช้ค่าภาษาอังกฤษตาม contract ของระบบ ได้แก่ `OPEN`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED` และ `CLOSED` ส่วน role ใช้ `GUEST`, `STAFF`, `SUPERVISOR`, `TECH` และ `ADMIN` เท่านั้น

โดยทั่วไป GUEST และ STAFF สร้างใบงานได้, STAFF และ TECH แก้ไข/ดำเนินงานได้, SUPERVISOR และ ADMIN มอบหมายงานและปิดใบงานได้ ส่วนการเปลี่ยนสถานะจะถูกตรวจสอบจาก server ไม่ใช่เฉพาะจากปุ่มบนหน้าจอ และ audit identity จะอ้างอิงผู้ใช้จาก session เป็นหลัก

## การใช้งานหลัก

หน้า Overview แสดงจำนวนงานทั้งหมด งานที่กำลังดำเนินการ งานเกิน SLA งานที่เสร็จวันนี้ และ distribution ของสถานะจากฐานข้อมูลจริง หน้า Work Orders รองรับค้นหาและกรองด้วย status, priority, category, location และช่วงวันที่ ผู้ใช้คลิกแถวงานเพื่อดูรายละเอียด แก้ไข มอบหมาย เปลี่ยนสถานะ ดู status log และแนบไฟล์ได้

หน้า Locations แสดงพื้นที่และ QR code สำหรับใช้เป็นจุดอ้างอิงในการแจ้งซ่อม ส่วนหน้า Technicians แสดงชื่อทีม ทักษะ เวร และ workload ปัจจุบันของช่าง ระบบตรวจ capacity ก่อนมอบหมายงาน

ปุ่มกระดิ่งด้านบนเปิด notification center ผู้ใช้สามารถอ่านรายการแจ้งเตือนและกดรายการเพื่อ mark as read ได้ ระบบจะสร้าง notification สำหรับการสร้าง/มอบหมาย/เปลี่ยนสถานะ และตรวจสร้างรายการ `SLA_OVERDUE` จากใบงานที่เกิน due date และยังไม่อยู่ใน `COMPLETED` หรือ `CLOSED`

## การตั้งค่า LINE Messaging API

เมนู **ตั้งค่า** เป็น Admin Settings สำหรับการเชื่อมต่อ LINE Messaging API โดยผู้ใช้ที่มีบทบาท `ADMIN` เท่านั้นจึงจะอ่าน บันทึก หรือทดสอบการเชื่อมต่อได้ ผู้ใช้อื่นจะเห็นข้อความแจ้งข้อจำกัดสิทธิ์และไม่สามารถเข้าถึงค่าเชื่อมต่อได้

ผู้ดูแลกรอก **Channel Access Token** และ **User ID หรือ Group ID** ของ LINE Official Account จากนั้นเลือกเปิดใช้งานการแจ้งเตือนงานเร่งด่วนและ/หรือใบงานเกิน SLA ได้ตามต้องการ ระบบเข้ารหัสค่าเชื่อมต่อก่อนจัดเก็บ และหน้าเว็บจะแสดงเพียงสถานะว่ามีการตั้งค่าแล้วโดยไม่แสดง token เดิม

## แนวทางปรับแก้ต่อ

ตารางหลักอยู่ใน `drizzle/schema.ts`, query helpers อยู่ใน `server/db.ts`, ส่วน tRPC contract และ permission policy อยู่ใน `server/routers.ts` หน้าหลักอยู่ใน `client/src/pages/Home.tsx` และ theme อยู่ใน `client/src/index.css` หากเพิ่มคอลัมน์หรือ table ให้แก้ schema แล้วสร้าง migration ด้วย `pnpm drizzle-kit generate` จากนั้นตรวจสอบและ apply SQL ผ่านระบบจัดการฐานข้อมูล

ก่อนส่งมอบรุ่นใหม่ให้รัน `pnpm check` และ `pnpm test` เสมอ และตรวจ responsive preview ทั้ง desktop กับ mobile หากเพิ่มฟีเจอร์ใหม่ให้บันทึกไว้ใน `todo.md` และสร้าง checkpoint หลังตรวจสอบเรียบร้อย
