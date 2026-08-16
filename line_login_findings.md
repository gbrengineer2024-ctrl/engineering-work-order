# LINE Login Integration Notes

LINE Login สำหรับเว็บใช้ OAuth 2.0 authorization-code grant ร่วมกับ OpenID Connect โดยต้องลงทะเบียน callback URL ใน LINE Developers Console แล้วส่ง `response_type=code`, `client_id`, `redirect_uri`, `state`, `scope=profile openid` และ `nonce` ไปยัง authorization endpoint [1]

ฝั่ง server ต้องแลก authorization code ที่ `https://api.line.me/oauth2/v2.1/token` โดยส่ง `grant_type=authorization_code`, `code`, `redirect_uri`, Channel ID และ Channel Secret ผ่าน form URL-encoded body; ค่า `redirect_uri` ต้องตรงกับตอนเริ่ม authorization request [2]

ระบบจะผูกบัญชีด้วย LINE `sub`/user ID ที่ตรวจจาก ID token หรือ profile API เท่านั้น ไม่ใช้ชื่อแสดงผลเป็น key และจะเก็บชื่อ/แผนกที่ผู้ใช้กรอกเมื่อพบว่า maintenance profile ยังไม่มีอยู่

## Sources

[1] [Integrating LINE Login with your web app — LINE Developers](https://developers.line.biz/en/docs/line-login/integrate-line-login/)

[2] [LINE Login v2.1 API reference — LINE Developers](https://developers.line.biz/en/reference/line-login/)
