# Google Sheets findings

ตรวจจาก workbook Hotel Maintenance WebApp Workbook วันที่ 14 สิงหาคม 2026

## ชีตที่เพิ่ม/เกี่ยวข้อง

- `10_Parts` มีคอลัมน์: `part_id`, `part_code`, `part_name_th`, `part_name_en`, `category_code`, `unit`, `brand_model`, `supplier_name`, `storage_location`, `min_stock_qty`, `current_stock_qty`, `reserved_qty`, `unit_cost_thb` (เห็นหัวคอลัมน์ถึง unit_cost_thb ทางขวาในภาพ)
- ตัวอย่างรหัสอะไหล่: `PART-0001` ถึง `PART-0005`; ตัวอย่างหมวด: PLUMBING, ELECTRICAL, HVAC, CIVIL, EQUIPMENT; หน่วย pcs และ m; มีข้อมูล stock ปัจจุบัน/ขั้นต่ำ/จอง
- `11_Part_Issues` ยังต้องเปิดอ่านหัวคอลัมน์และข้อมูลตัวอย่างในขั้นถัดไป

## Flow ที่ระบุใน 00_README

`Work Order → Part Issue Request → Approval → Issue Stock → Cost rolls into job actual cost`

Stock logic: `available_qty = current_stock_qty - reserved_qty`; `issue_cost_thb = qty_issued × unit_cost_thb`

## ข้อสังเกต UI

Google Sheets workbook เป็น public link และแสดงแท็บ 00_README ถึง 11_Part_Issues ได้ แต่หน้า 10_Parts มีตารางกว้างหลายคอลัมน์ จึงควรออกแบบ UI เป็นการ์ด/ตารางที่เลื่อนแนวนอนได้อย่างตั้งใจและมี label ภาษาไทยกำกับ.

## 11_Part_Issues

ชีต `11_Part_Issues` มีคอลัมน์ที่เห็นจากหัวตาราง: `issue_id`, `wo_id`, `requested_at`, `requested_by_user_id`, `approved_by_user_id`, `approved_at`, `part_id`, `part_code`, `part_name_th`, `qty_requested`, `qty_approved`, `qty_issued` และมีข้อมูลตัวอย่างเชื่อมกับใบงาน `WO-20260814-*` และอะไหล่ `PART-0001` ถึง `PART-0004`.

ตัวอย่างสถานะเชิงกระบวนการจากข้อมูลที่เห็น: บางรายการอนุมัติเต็มจำนวน เช่น requested 2 / approved 2 / issued 2; บางรายการยังไม่จ่าย เช่น requested 1 / approved 0 / issued 0; และบางรายการจ่ายบางส่วน เช่น requested 6 / approved 6 / issued 5. จึงควรคำนวณสถานะจากจำนวนและรองรับ partial issue.
