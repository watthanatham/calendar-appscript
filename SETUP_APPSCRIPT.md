# วิธี setup Google Apps Script (booking เข้า Calendar อัตโนมัติ)

ฟรีทั้งหมด ไม่ต้องลง Python / pip / credentials.json — auth แค่กดอนุญาตครั้งเดียว
หลัง setup: วางข้อความในชีต → กดเมนู → เข้า calendar เลย

---

## 1. สร้าง Google Sheet + เปิด Apps Script

1. สร้าง Google Sheet ใหม่ (sheets.new)
2. เมนู **Extensions → Apps Script**
3. ลบโค้ดเดิมในไฟล์ `Code.gs` ทิ้ง แล้ว **คัดลอกเนื้อหาจาก `Code.gs` ในโปรเจกต์นี้** ไปวางแทน
4. กด 💾 Save

## 2. เปิด Advanced Calendar Service (สำหรับกันสร้างซ้ำ)

1. ในตัวแก้ไข Apps Script ฝั่งซ้าย มองหา **Services** กดเครื่องหมาย **+**
2. เลือก **Calendar API** → กด **Add**
   - (จำเป็น เพราะใช้ `CalendarAPI.Events.import` เพื่อให้รันซ้ำแล้วอัปเดตของเดิม ไม่สร้างซ้ำ)
   - ⚠ **Identifier ต้องเป็น `CalendarAPI`** (ดูช่อง Identifier ตอน Add) ให้ตรงกับที่โค้ดเรียก
     ถ้าของคุณเป็นชื่ออื่น ให้แก้ชื่อในโค้ด (บรรทัด `CalendarAPI.Events.import`) ให้ตรง

## 3. เรียกเมนูครั้งแรก + อนุญาต

1. กลับไปที่หน้า Google Sheet → **refresh (F5)**
2. จะมีเมนูใหม่ชื่อ **Booking** โผล่ขึ้นมาบนแถบเมนู
3. วางข้อความ booking สักชุดในชีต (ดูข้อ 4) แล้วกด **Booking → ส่งเข้า Google Calendar**
4. ครั้งแรกจะขึ้นขออนุญาต:
   - เลือกบัญชี Google
   - ถ้าเจอ "Google hasn't verified this app" → **Advanced → Go to ... (unsafe)** → Continue
     (ปลอดภัย เพราะเป็นสคริปต์ของคุณเอง)
   - กด **Allow**
5. กดเมนูซ้ำอีกครั้ง → คราวนี้จะทำงานเลย

## 4. วิธีวางข้อมูล (สำคัญ)

วางข้อความ booking **เริ่มที่ช่อง A1** ของชีต — เวลา copy หลายบรรทัดจาก LINE มาวาง
Google Sheets จะกระจายลงเป็นแถว (แต่ละบรรทัด = 1 แถว) รวมเส้น `====` ด้วย ซึ่งสคริปต์อ่านได้ถูกต้อง

ตัวอย่างที่วางได้เลย (เริ่ม A1):

```
BOOKING NO. 271382140 = LOAD 4/6/2026 = จำนวน 1 ตู้ โหลดอมตะ
====================
BOOKING NO.45084065 (3X20" FCL)
LOADING DATE = 10.06.2026
โหลดที่ปิ่นทอง
1THA2605058, 2THA2605093
```

กด **Booking → ส่งเข้า Google Calendar** → จะมีกล่องสรุปว่าส่งกี่ event / อันไหน parse ไม่ได้

---

## หมายเหตุ

- **กันสร้างซ้ำ:** ใช้ booking no. เป็น iCalUID — รัน booking เดิมซ้ำจะอัปเดต event เดิม
- **ลงปฏิทินไหน:** ตอนนี้ลง `primary` ถ้าต้องการปฏิทินอื่น แก้ `CALENDAR_ID` ใน `Code.gs`
- รองรับ format เดียวกับฝั่ง Python ทุกอย่าง (เพิ่ม/แก้สถานที่ได้ที่ `LOCATION_MAP`)
- ไม่ต้องใช้ `line_to_ics.py` แล้วถ้าใช้ทางนี้ (แต่จะเก็บไว้สร้าง .ics สำรองก็ได้)
