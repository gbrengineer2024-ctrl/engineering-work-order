# แหล่งข้อมูล Workbook: 01_Users

แหล่งข้อมูล: https://docs.google.com/spreadsheets/d/1_YUz6QKnMCt-5Pl94WrAh7oFxO7RgAsbH3-tqshS7Z4/edit?gid=0#gid=0

ตรวจเมื่อ: 2026-08-14

หน้า `00_README` ระบุว่า `01_Users` ใช้เก็บ “ผู้ใช้งานจาก LINE / staff / admin” และมี `user_id` เป็น Primary Key โดย workbook รองรับ LINE Login และการสร้าง Work Order ผ่าน WebApp/API

## โครงสร้างที่อ่านจากชีต 01_Users

| คอลัมน์ | ความหมาย |
| --- | --- |
| `line_user_id` | รหัสผู้ใช้ LINE |
| `user_id` | รหัสผู้ใช้หลัก |
| `full_name` | ชื่อผู้ใช้ |
| `department` | แผนก |
| `role` | `ADMIN`, `REPORTER`, `SUPERVISOR`, หรือ `TECHNICIAN` |
| `status` | สถานะบัญชี เช่น `ACTIVE` |
| `created_at` / `updated_at` | เวลาสร้างและแก้ไข |
| `notes` | หมายเหตุ |

ตัวอย่างในชีตมีบัญชี `ADMIN`, `REPORTER`, `SUPERVISOR` และ `TECHNICIAN` ครบทั้งสี่บทบาท โดยข้อมูลผู้ใช้ทั้งหมดอยู่ในแผนก `ENGINEERING`

ชีตที่พบใน workbook ได้แก่ `01_Users`, `03_Work_Orders`, `04_Status_Log`, `06_Lookups`, `07_Attachments`, `08_Notifications`, `10_Parts` และ `11_Part_Issues`

ข้อกำหนดล่าสุดจากผู้ใช้สำหรับ 01_Users คือ role ที่อนุญาต: `ADMIN`, `REPORTER`, `SUPERVISOR`, `TECHNICIAN` และผู้ใช้ที่ลงทะเบียน LINE ใหม่ต้องได้รับ `REPORTER` เสมอ
