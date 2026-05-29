# วิธี setup ให้ booking เข้า Google Calendar อัตโนมัติ (`--push`)

ทำครั้งเดียว ~10–15 นาที **ฟรีทั้งหมด ไม่ต้องใส่บัตรเครดิต**
หลัง setup เสร็จ ทุกครั้งแค่: วางข้อความใน `bookings.txt` → `python line_to_ics.py --push` → เข้า calendar เลย

---

## 1. ลง Python library (ทำในเครื่อง)

```
pip install google-api-python-client google-auth-oauthlib
```

## 2. สร้าง Google Cloud project + เปิด Calendar API

1. เข้า https://console.cloud.google.com/
2. มุมบนซ้าย กดเลือก project → **New Project** → ตั้งชื่อ (เช่น `calendar-hook`) → Create
3. เลือก project ที่เพิ่งสร้าง
4. ไปที่ https://console.cloud.google.com/apis/library/calendar-json.googleapis.com → กด **Enable**

## 3. ตั้งค่า OAuth consent screen

1. เมนูซ้าย → **APIs & Services → OAuth consent screen**
2. เลือก **External** → Create
3. กรอกเท่าที่บังคับ: App name (อะไรก็ได้), User support email (อีเมลคุณ), Developer contact (อีเมลคุณ) → Save and Continue
4. หน้า Scopes → ข้ามได้ (Save and Continue)
5. หน้า **Test users** → กด **Add Users** → ใส่อีเมล Google ของคุณเอง → Save
   - (สำคัญ: ถ้าไม่ใส่ตัวเองเป็น test user จะอนุญาตไม่ผ่าน)

## 4. สร้าง OAuth credentials → โหลด credentials.json

1. เมนูซ้าย → **APIs & Services → Credentials**
2. **Create Credentials → OAuth client ID**
3. Application type = **Desktop app** → ตั้งชื่อ → Create
4. กด **Download JSON** → เปลี่ยนชื่อไฟล์เป็น **`credentials.json`** → วางไว้ในโฟลเดอร์เดียวกับ `line_to_ics.py`
   (`F:\Source code\calendar hook\credentials.json`)

## 5. รันครั้งแรก (อนุญาตการเข้าถึง)

```
python line_to_ics.py --push
```

- จะเปิด browser ให้ล็อกอิน Google → เลือกบัญชีที่ใส่เป็น test user
- ถ้าเจอหน้าเตือน "Google hasn't verified this app" → กด **Advanced → Go to ... (unsafe)** → Continue
  (ปลอดภัย เพราะเป็น app ของคุณเอง)
- กด Allow → เสร็จแล้วระบบจะสร้างไฟล์ **`token.json`** ให้อัตโนมัติ

## เสร็จแล้ว — ใช้งานปกติ

ครั้งต่อไปไม่ต้องเปิด browser อีก แค่:

```
python line_to_ics.py --push
```

---

## หมายเหตุ

- **กันสร้างซ้ำ:** ใช้ booking no. เป็น ID — รัน booking เดิมซ้ำจะ *อัปเดต* event เดิม ไม่สร้างใหม่
- **ลงปฏิทินไหน:** ตอนนี้ลงปฏิทินหลัก (`primary`) ของบัญชี ถ้าอยากลงปฏิทินอื่น แก้ `CALENDAR_ID` ใน `line_to_ics.py` เป็น calendar ID ของปฏิทินนั้น
- **ยังอยากได้ไฟล์ .ics:** รันแบบไม่มี `--push` เหมือนเดิม
- **อย่าแชร์ `credentials.json` / `token.json`** ให้คนอื่น (เป็นกุญแจเข้าบัญชี) — ถ้าใช้ git ควรใส่ใน `.gitignore`
```
credentials.json
token.json
```
