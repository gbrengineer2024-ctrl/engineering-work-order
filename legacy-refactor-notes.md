# บันทึกการปรับโครงสร้าง ModernHome Legacy

## สถานะปัจจุบัน

หน้า `ModernHome.tsx` ทำหน้าที่เป็น wrapper สำหรับ `ModernHomeLegacy.tsx` และมีหน้าที่ประกอบฟอร์มสร้างใบงาน, ตัวจัดการคลังอะไหล่ และการเปิดรายละเอียดจาก deep link ของ LINE ปัจจุบันปุ่ม **สร้างใบงาน** ที่เผยแพร่บน production เหลือหนึ่งจุดและผ่านการตรวจทั้งเดสก์ท็อปกับมือถือแล้ว

ระหว่างการตรวจโค้ด พบว่า `ModernHomeLegacy.tsx` เป็นไฟล์ที่รวม component และ event handler จำนวนมากไว้เป็นบรรทัดยาว จึงไม่เหมาะกับการแก้ callback เฉพาะจุดโดยตรงในระหว่างที่ระบบกำลังใช้งานจริง เพราะการเปลี่ยน signature ของ component หรือย้าย dialog อาจกระทบ flow มอบหมายงาน, รูปก่อน–หลังงาน, Parts Manager และ LINE deep link ได้

## แนวทาง refactor ที่ปลอดภัย

| ลำดับ | การเปลี่ยนแปลง | เกณฑ์ยอมรับ |
|---|---|---|
| 1 | แยก `WorkOrderCreateDialog` เป็น component อิสระ | ฟอร์มรับข้อมูลเดิม, แนบรูป BEFORE และสร้างใบงานผ่าน API เดิมได้ |
| 2 | เพิ่ม prop `onCreateWorkOrder` ให้ `ModernHomeLegacy` | ปุ่มในส่วนหัว Dashboard เรียก callback โดยตรง โดยไม่อาศัยข้อความบนปุ่มหรือ DOM capture |
| 3 | แยก `WorkOrderDetail` และย้าย guard รูป AFTER ไปไว้ใน handler สถานะโดยตรง | ไม่สามารถเปลี่ยนเป็น `COMPLETED` ได้หากไม่มีรูป AFTER ทั้งใน UI และ server |
| 4 | เพิ่ม prop `onOpenPartsManager` สำหรับเมนูอะไหล่ | เมนูอะไหล่เปิด `PartsManager` โดยไม่ดัก click จาก wrapper |
| 5 | ลบ event click interception จาก `ModernHome` | tests ต้องยืนยัน create work order, parts และ completion guard ครบก่อนลบ |

> จนกว่าจะทำตามลำดับข้างต้นครบ ระบบยังคงใช้ implementation ที่เผยแพร่และยืนยันพฤติกรรมแล้ว เพื่อหลีกเลี่ยงความเสี่ยงต่อการใช้งานใบงานจริง

## รายการทดสอบก่อนเริ่ม refactor

ต้องเก็บ regression test สำหรับการสร้างใบงาน, บังคับรูปหลังงานก่อนปิดงาน, การเปิด Parts Manager, การมอบหมายงานและการแจ้งเตือน LINE รวมถึง deep link `?woId=` ทุกครั้งที่แยก component หรือเปลี่ยน callback ระหว่าง wrapper กับ Legacy
