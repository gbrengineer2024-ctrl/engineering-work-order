# คู่มือ Deploy ขึ้น Cloudflare

โปรเจกต์นี้ถูกย้ายจาก Manus (Express + MySQL/TiDB + Manus Forge storage) มาเป็น
**Cloudflare Workers + D1 (SQLite) + R2** เรียบร้อยแล้ว โค้ดผ่าน typecheck,
build, และเทสต์ทั้งหมด (78 ทดสอบ) แล้ว เหลือเพียงขั้นตอน deploy จริงที่ต้องทำจากเครื่องของคุณ
เพราะต้อง login เข้าบัญชี Cloudflare ของคุณเอง

## สถานะปัจจุบัน (ทำให้แล้ว)

- ✅ สร้าง **D1 database** ชื่อ `engineering-work-order-db` แล้ว (region: APAC)
  และรัน migration สร้างครบทั้ง 13 ตารางแล้ว — พร้อมใช้งานทันที
- ✅ `wrangler.toml` ใส่ `database_id` จริงไว้ให้แล้ว
- ⚠️ **R2 bucket ยังสร้างไม่ได้** เพราะบัญชี Cloudflare ของคุณยังไม่ได้เปิดใช้งาน R2
  (ต้องกดยอมรับเงื่อนไข R2 ในหน้า Dashboard ก่อนครั้งแรกเท่านั้น ไม่มีค่าใช้จ่ายในระดับ free tier)

## ขั้นตอนที่ต้องทำต่อ

### 1. เปิดใช้งาน R2 (ครั้งเดียว)

1. เข้า https://dash.cloudflare.com → เลือกบัญชีของคุณ → เมนู **R2 Object Storage**
2. กด **Enable R2** / ยอมรับเงื่อนไขการใช้งาน
3. กลับมาบอกผมในแชทนี้ว่า "เปิด R2 แล้ว" ผมจะสร้าง bucket `engineering-work-order-files`
   ให้ทันทีผ่าน connector ที่เชื่อมไว้แล้ว (ไม่ต้องทำเอง)

### 2. ติดตั้งเครื่องมือบนเครื่องคุณ

```bash
cd engineering-work-order-main
npm install
npx wrangler login          # เปิดเบราว์เซอร์ให้ล็อกอิน Cloudflare
```

### 3. ตั้งค่า Secrets (ค่าลับ ห้ามใส่ในไฟล์ wrangler.toml)

```bash
npx wrangler secret put JWT_SECRET
# ใส่ค่าสุ่มยาวๆ เช่นรันคำสั่งนี้เพื่อ generate: openssl rand -base64 48

npx wrangler secret put LINE_LOGIN_CHANNEL_ID
npx wrangler secret put LINE_LOGIN_CHANNEL_SECRET
```

ค่า LINE Login Channel ID/Secret หาได้จาก https://developers.line.biz/console/
(ต้องสร้าง LINE Login Channel ถ้ายังไม่มี)

**สำคัญ**: ใน LINE Developers Console ต้องเพิ่ม **Callback URL** เป็น
`https://<โดเมนของคุณ>/api/auth/line/callback` ด้วย — จะได้โดเมนจริงหลัง deploy ครั้งแรก (ขั้นตอนที่ 5)

### 4. แก้ `wrangler.toml`

หลัง deploy ครั้งแรกแล้วจะรู้โดเมนจริง (เช่น `engineering-work-order.<your-subdomain>.workers.dev`)
ให้กลับมาแก้บรรทัดนี้ในไฟล์ `wrangler.toml`:

```toml
PUBLIC_APP_BASE_URL = "https://engineering-work-order.<your-subdomain>.workers.dev"
```

ค่านี้ใช้สร้างลิงก์ deep link ในข้อความ LINE (เช่น "เปิดใบงาน: https://...")

### 5. Deploy

```bash
npm run deploy
```

คำสั่งนี้จะ build frontend (`vite build`) แล้ว deploy ทั้ง Worker + static assets ขึ้น Cloudflare ให้อัตโนมัติ
เสร็จแล้ว wrangler จะพิมพ์ URL ของแอปออกมา

### 6. รัน migration บนฐานข้อมูล production (ทำแล้วในตอนนี้)

ผมรัน schema migration ให้บน D1 production แล้วผ่าน Cloudflare connector — ไม่ต้องรันซ้ำ
ถ้าในอนาคตมีการแก้ schema (`drizzle/schema.ts`) ให้รัน:

```bash
npm run db:generate              # สร้างไฟล์ migration ใหม่
npm run db:migrate:remote        # apply ขึ้น production D1
npm run db:migrate:local         # apply ขึ้น local dev D1 (สำหรับตอน wrangler dev)
```

## รันทดสอบบนเครื่อง (dev mode)

```bash
npm run dev
```
รัน `vite build --watch` คู่กับ `wrangler dev` พร้อมกัน (ใช้ D1/R2 แบบ local emulation)

## สิ่งที่เปลี่ยนไปจากของเดิม ควรรู้ไว้

- **ฐานข้อมูล**: MySQL/TiDB → Cloudflare D1 (SQLite) ทั้งหมด (ตามที่เลือกไว้)
- **ที่เก็บรูป**: Manus Forge → Cloudflare R2 โดยตรง ผ่าน route `/files/:key`
- **เซิร์ฟเวอร์**: Express → Hono (รันบน Workers runtime)
- **LINE Login**: ทำงานเหมือนเดิมทุกประการ ไม่ต้องเปลี่ยนอะไรฝั่ง LINE ยกเว้นอัปเดต Callback URL
- **"เข้าสู่ระบบด้วยบัญชี Manus"**: ฟีเจอร์นี้เป็น dead code ที่ไม่ได้ใช้งานจริงในแอปอยู่แล้ว (พบว่า LINE Login
  เป็นช่องทาง login เดียวที่ front-end เรียกใช้) จึงลบทิ้งไปพร้อมกับโมดูลอื่นๆ ของ Manus ที่ไม่ได้ถูกเรียกใช้เลย
  (`llm.ts`, `imageGeneration.ts`, `map.ts`, `dataApi.ts`, `voiceTranscription.ts`)
- **ปุ่ม "แจ้งเตือนเจ้าของระบบ" (notifyOwner)**: เป็นฟีเจอร์แอดมินที่ไม่มีปุ่มเรียกใช้จริงใน UI และพึ่งพา Manus
  backend เท่านั้น จึงลบทิ้งไปด้วยเช่นกัน
- ไม่มีข้อมูลเดิมให้ย้าย (ตามที่ยืนยันไว้) ฐานข้อมูลใหม่เริ่มต้นแบบว่างเปล่า พร้อมให้กรอกข้อมูลเริ่มต้น
  (locations, lookups, technicians ฯลฯ) ผ่านหน้าแอดมินของแอปได้เลยหลัง deploy
