# calendar-hook

แปลงข้อความ booking จาก LINE ลง Google Calendar อัตโนมัติ (Google Apps Script)

## ไฟล์ในโปรเจกต์

- **[`MANUAL.md`](MANUAL.md)** — คู่มือเดียวจบ: setup LINE bot + เมนูในชีต + กฎ format + แก้ปัญหา
- **`Code.gs`** — โค้ดทั้งหมด (วางใน Apps Script ที่ผูกกับ Google Sheet)

## เริ่มยังไง

อ่าน **[MANUAL.md](MANUAL.md)** แล้วทำตามส่วน A–E (LINE bot) หรือส่วน A อย่างเดียว (เมนูในชีต)

## สรุประบบ

ส่งข้อความ booking เข้า LINE bot → ลงปฏิทิน **"Export"** อัตโนมัติ + ตอบสรุปกลับ
กันสร้างซ้ำด้วย booking no. (ส่งซ้ำ = อัปเดตของเดิม) — ฟรีทั้งหมด ไม่ต้องเช่า server
