# 📅 คู่มือระบบ Booking → Google Calendar

แปลงข้อความ booking จาก LINE ลง Google Calendar อัตโนมัติ **ฟรีทั้งหมด** ไม่ต้องเช่า server / ไม่ต้องบัตรเครดิต

ระบบมี **2 วิธีใช้งาน** (ใช้โค้ดชุดเดียวกัน `Code.gs`):

| วิธี | เหมาะกับ | ต้อง setup |
|---|---|---|
| **① LINE bot** (หลัก) | ส่งเข้าแชต → ลง Calendar + ตอบกลับอัตโนมัติ | ส่วน A–E |
| **② เมนูในชีต** (สำรอง) | วางข้อความในชีต → กดปุ่ม | ส่วน A เท่านั้น |

> ทั้งสองวิธีลงปฏิทินเดียวกันชื่อ **"Export"** และกันสร้างซ้ำด้วย booking no. (ส่งซ้ำ = อัปเดตของเดิม)

---

## ภาพรวมระบบ (LINE bot)

```
คนส่งข้อความ → LINE bot → (webhook) → Apps Script doPost → ลงปฏิทิน "Export" → บอทตอบสรุปกลับ
```

- ปฏิทินปลายทางคือ **"Export" ของบัญชีคุณ (คนที่ deploy)** เสมอ ไม่ว่าใครส่ง — อยากให้ทีมเห็นให้แชร์ปฏิทินนี้

---

# A. เตรียม Google Sheet + Apps Script (ทุกวิธีต้องทำ)

### A1. สร้างชีต + วางโค้ด
1. สร้าง Google Sheet ใหม่ (พิมพ์ `sheets.new` ในเบราว์เซอร์) → ตั้งชื่อ เช่น "Booking Calendar"
2. เมนู **Extensions → Apps Script**
3. ลบโค้ดเดิมในไฟล์ `Code.gs` ทิ้งทั้งหมด (Ctrl+A → Delete) → วางเนื้อหาจาก **`Code.gs` ของโปรเจกต์นี้** ลงไปแทน
4. กด 💾 **Save**

### A2. เปิด Advanced Calendar Service
1. ฝั่งซ้ายของ Apps Script → หา **Services** → กด **+**
2. เลือก **Google Calendar API** → **Add**
   - จำเป็น เพราะใช้ `Calendar.Events.import` (กันสร้างซ้ำ)
   - identifier เป็น `Calendar` (ค่าเริ่มต้น) หรือ `CalendarAPI` ก็ได้ โค้ดรองรับทั้งคู่

### A3. สร้างปฏิทินชื่อ "Export"
1. เปิด [Google Calendar](https://calendar.google.com/) → ฝั่งซ้าย "Other calendars" → **+** → **Create new calendar**
2. ตั้งชื่อให้ตรงเป๊ะว่า **`Export`** → **Create**

> ⚠ ชื่อต้องตรงกับ `CALENDAR_NAME = "Export"` ใน `Code.gs` — ถ้าอยากใช้ชื่ออื่น แก้ที่บรรทัดนั้นด้วย

**ถ้าจะใช้แค่ "วิธี ② เมนูในชีต" → ข้ามไปอ่านส่วน [วิธีใช้: เมนูในชีต](#เมนู) ได้เลย**
**ถ้าจะทำ LINE bot → ทำส่วน B–E ต่อ**

---

# B. Deploy เป็น Web App (ได้ URL มาผูก LINE)

1. มุมขวาบน Apps Script → **Deploy → New deployment**
2. กดเฟือง ⚙ ข้าง "Select type" → เลือก **Web app**
3. ตั้งค่า **ตามลำดับนี้:**
   - **Execute as:** **Me** (อีเมลคุณ) ← ต้องเลือกอันนี้**ก่อน**
   - **Who has access:** **Anyone**

   > ⚠ **กับดักที่ 1:** ตัวเลือก **"Anyone / ทุกคน" จะโผล่ก็ต่อเมื่อ Execute as = Me เท่านั้น**
   > ถ้าเลือก "User accessing the web app" จะไม่มี "Anyone" ให้เลือก แล้ว LINE จะยิงไม่เข้า (เจอ 401/302)

4. **Deploy** → ถ้าขออนุญาต: เลือกบัญชี → "Google hasn't verified" → **Advanced → Go to… → Allow**
5. คัดลอก **Web app URL** (ลงท้าย `/exec`) เก็บไว้ — ใช้ใน E

> ⚠ **กับดักที่ 2 (สำคัญมาก):** ทุกครั้งที่**แก้โค้ดแล้ว** ต้อง **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy**
> ถ้าไม่ทำ URL เดิมจะยังรันโค้ดเก่า (แก้ไปก็ไม่มีผล)

### เช็คว่า deploy ติดไหม
เปิด Web app URL ในเบราว์เซอร์ → ต้องเห็นรายงานสถานะ (token / ปฏิทิน) ไม่ใช่หน้า error
ตอนนี้ token จะยังขึ้น "ไม่พบ" (ปกติ — ยังไม่ได้ตั้งใน D)

---

# C. LINE Developers — สร้าง Channel + เอา Access token

### C1. สร้าง Channel
1. เข้า [developers.line.biz/console](https://developers.line.biz/console/) → ล็อกอินด้วยบัญชี LINE
2. **Create a new provider** (ตั้งชื่ออะไรก็ได้)
3. ในโปรไวเดอร์ → **Create a new channel** → เลือก **Messaging API** → กรอกข้อมูลบังคับ → Create

### C2. เอา Channel access token
1. เข้า channel → แท็บ **Messaging API** (แท็บบนสุด)
2. เลื่อนล่างสุด → **Channel access token (long-lived)** → กด **Issue** → **Copy** เก็บไว้

> ⚠ **กับดักที่ 3:** ตัวที่ต้องใช้คือ **Channel access token** (ยาวมาก ~170 ตัว ลงท้าย `=`)
> **ไม่ใช่** Channel secret (สั้น 32 ตัว ในแท็บ Basic settings) — คนละตัวกัน ใส่ผิดบอทจะตอบไม่ได้

---

# D. ตั้งค่า Script Properties (เชื่อม Apps Script กับ LINE)

1. Apps Script → ฝั่งซ้ายล่าง ⚙ **Project Settings**
2. เลื่อนหา **Script Properties** → **Add script property** (ทำ 2 ครั้ง)

| Property (พิมพ์ตรงเป๊ะ ตัวพิมพ์ใหญ่) | Value |
|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | token ยาวจาก C2 (วางทั้งเส้น ห้ามมีเว้นวรรคหน้า-หลัง) |
| `LINE_WEBHOOK_TOKEN` | รหัสลับที่คุณตั้งเอง เช่น `bk-9f3k2x7q` (กันคนยิง URL มั่ว) |

3. ⚠ **กับดักที่ 4:** กดปุ่ม **Save script properties** ให้ขึ้นว่าบันทึกแล้ว — ถ้าปิดหน้าก่อนกด Save ค่าจะหาย (อ่านได้ค่าว่าง บอทจะตอบ forbidden เงียบ)

### เช็ค: เปิด Web app URL ในเบราว์เซอร์อีกครั้ง
ต้องเปลี่ยนเป็น **OK ทั้งคู่:**
```
LINE_CHANNEL_ACCESS_TOKEN: OK (length 172)
LINE_WEBHOOK_TOKEN: OK (length ...)
Advanced Calendar Service: OK
ปฏิทิน "Export": OK (...)
```
ถ้ายังขึ้น "ไม่พบ" → ยังกด Save ไม่ติด หรือชื่อ property พิมพ์ผิด

---

# E. ผูก Webhook URL + ตั้งค่าการตอบกลับ LINE

### E1. ใส่ Webhook URL (กับดักที่เสียเวลาเยอะสุด)
1. เอา Web app URL จาก B5 มา **ต่อท้ายด้วย `?token=<LINE_WEBHOOK_TOKEN>`** เช่น:
   ```
   https://script.google.com/macros/s/AKfyc.../exec?token=bk-9f3k2x7q
   ```
2. LINE Developers → channel → แท็บ **Messaging API** → **Webhook URL** → **Edit** → วาง URL (พร้อม `?token=...`) → **Update**
3. กด **Verify** → ควรขึ้น **Success**
4. เปิด **Use webhook** = **Enabled**

> ⚠ **กับดักที่ 5 (ตัวร้ายที่สุด):** **URL ใน LINE ต้องมี `?token=...` ติดท้ายเสมอ**
> ถ้าลืม → LINE ยิงมาที่ `/exec` เปล่าๆ → โค้ดอ่าน token = `undefined` → ตอบ `forbidden` เงียบทุกครั้ง
> (Verify ยังขึ้น Success ได้ เพราะ forbidden ก็คืน HTTP 200 — เลยหลอกว่าใช้ได้ ทั้งที่ยังไม่ได้)

### E2. ปิดระบบตอบอัตโนมัติของ LINE
1. แท็บ Messaging API → **Auto-reply messages** → **Edit** (เปิด LINE Official Account Manager)
2. ในหน้า **Settings → Response settings** ตั้ง:

| หัวข้อ | ตั้งเป็น |
|---|---|
| **แชท (Chat)** | **ปิด** |
| **ข้อความทักทายเพื่อนใหม่ (Greeting)** | **ปิด** |
| **ตอบกลับอัตโนมัติ (Auto-reply)** | **ปิด** |
| **Webhook** | **เปิด** |

> ⚠ **กับดักที่ 6:** ถ้า "แชท" หรือ "Auto-reply" ยังเปิด → LINE จะคว้า `replyToken` ไปตอบข้อความ "ขออภัย บัญชีนี้ตอบไม่ได้" ก่อน → บอทเราตอบไม่ได้ (token ใช้ได้ครั้งเดียว)

### E3. เพิ่มบอทเป็นเพื่อน
แท็บ Messaging API → **QR code** → สแกนเพิ่มเป็นเพื่อน (หรือเชิญเข้ากลุ่ม)

---

# วิธีใช้งาน

## ① LINE bot

ส่งข้อความเข้าแชตบอท:
```
BOOKING NO. 271382140 = LOAD 4/6/2026 = จำนวน 1 ตู้ โหลดอมตะ
```
บอทตอบ:
```
✓ บันทึก 1 booking
BK 271382140  04/06/2026  1 ตู้  @Amata
```
แล้วเปิด Google Calendar → ปฏิทิน **Export** → จะเห็น event วันที่ 4 มิ.ย. 2026

> บอทตอบเฉพาะข้อความที่มี **`BOOKING NO`** เท่านั้น — ข้อความคุยเล่นอื่นจะเงียบ

<a id="เมนู"></a>
## ② เมนูในชีต (สำรอง — ไม่ต้อง setup LINE)

1. กลับไปที่ Google Sheet → **refresh (F5)** → จะมีเมนู **Booking** โผล่บนแถบเมนู
2. ครั้งแรกกดเมนูจะขอสิทธิ์: เลือกบัญชี → "Google hasn't verified" → **Advanced → Go to… → Allow**
3. วางข้อความ booking **เริ่มที่ช่อง A1** (copy หลายบรรทัดจาก LINE มาวางได้ Google Sheets จะกระจายเป็นแถวเอง)
4. เมนู **Booking → ส่งเข้า Google Calendar** → ขึ้นกล่องสรุปว่าบันทึกกี่ booking

---

# 📋 กฎการวางข้อความ Booking

ระบบอ่านข้อความได้ฉลาด **copy จาก LINE มาทั้งดุ้นได้** แต่ต้องมี 2 อย่าง:

### ❶ มีคำว่า "BOOKING NO." + เลข
- `BOOKING NO. 271382140`
- `BOOKING NO.45084065`
- `BOOKING NO.:W488092746` (มีตัวอักษรนำได้)

### ❷ มี "วันโหลด" — ขึ้นต้นด้วยคำใดคำหนึ่ง:
- `LOAD 4/6/2026`
- `LOADING DATE = 10.06.2026`
- `โหลด 04-06-26`

วันที่รองรับ: `4/6/2026`, `05.06.2026`, `04-06-26` (ปี 2 หลัก → 26 = 2026) — เป็น **วัน/เดือน/ปี** เสมอ

### ❸ หลาย booking — คั่นด้วยเส้น `====` (≥ 3 ตัว อยู่บรรทัดของตัวเอง)
```
BOOKING NO. 11111 = LOAD 1/6/2026 = จำนวน 1 ตู้โหลดอมตะ
====================
BOOKING NO. 22222 = LOAD 2/6/2026 = จำนวน 2 ตู้โหลดปิ่นทอง
```

### ✨ ข้อมูลที่ดึงเพิ่ม (ใส่ก็ได้ ไม่ใส่ก็ได้)

| ข้อมูล | เขียนว่า | ปรากฏใน Calendar |
|---|---|---|
| **จำนวนตู้** | `(3X20" FCL)` / `1X20"` / `จำนวน N ตู้` | Total + breakdown ต่อสถานที่ |
| **สถานที่โหลด** | `อมตะ` / `Amata` / `ปิ่นทอง` / `Pinthong` / `โหลด 2 ที่` | แยกเป็นบรรทัด |
| **เลข Invoice** | `1THA2605019, 2THA2605041` | บรรทัด Invoice No |
| **VGM** | บรรทัดที่ขึ้นต้น `VGM` | บรรทัด VGM |
| **คืนตู้หลังเที่ยงคืน** | คำว่า `คืนตู้หลังเที่ยงคืน` | ⚠ คืนตู้หลังเที่ยงคืน |

### 📝 ตัวอย่างทดสอบ (3 booking พร้อมกัน)
```
BOOKING NO. 271381542 = LOAD 2/6/2026 = จำนวน 1 ตู้โหลดอมตะ และ จำนวน 1 ตู้โหลดปิ่นทอง
====================================================
BOOKING NO.49013513 (3X20" FCL)
LOADING DATE = 05.06.2026
VGM CUT OF : 05.06.2026 (ก่อน 15.00)
INVOICE NO. 2THA2605106 = 1X20" FCL โหลดที่สาขาปิ่นทอง
INVOICE NO. 1THA2605067 = 1X20" FCL โหลดที่สาขาอมตะ
INVOICE NO. 1THA2605068 = 1X20" FCL โหลด 2 ที่
====================================================
1X20 FCL - BOOKING NO.:W488092746 - โหลด 04-06-26 - โหลดที่ปิ่นทอง จำนวน 1 ตู้
1THA2605019, 2THA2605041
VGM.: คัต 16.00 : 04-06-26
```

---

# 🔧 แก้ปัญหา (จากที่เจอจริง)

## ฝั่ง LINE bot

| อาการ | สาเหตุ | แก้ |
|---|---|---|
| Verify ขึ้น **401 Unauthorized** | "Who has access" ไม่ใช่ Anyone | B3: Execute as = Me ก่อน แล้วเลือก Anyone |
| Verify ขึ้น **302** / เปิด URL เด้ง login | สิทธิ์ยังเป็น "Anyone with Google account" | เลือก **Anyone** แท้ๆ (ไม่ใช่ตัวที่ต้อง login) |
| เปิด URL เจอ **"ไม่พบฟังก์ชัน doGet"** | รันโค้ดเก่า | วางโค้ดล่าสุด + Deploy New version |
| บอทตอบ **"ขออภัย บัญชีนี้ตอบไม่ได้"** | Auto-reply / แชท ยังเปิด | E2: ปิด "แชท" + Auto-reply |
| **บอทเงียบสนิท** | URL ใน LINE ไม่มี `?token=` | E1: เติม `?token=...` ต่อท้าย |
| **บอทเงียบ** + URL มี token แล้ว | token ใน Properties ไม่ถูกบันทึก | D3: กด Save script properties |
| Exception **getUi()** | รันโค้ดเก่าผ่าน webhook | วางโค้ดล่าสุด + Deploy New version |
| บอทตอบ `⚠ error: ไม่พบปฏิทิน "Export"` | ยังไม่สร้างปฏิทิน | A3: สร้างปฏิทินชื่อ Export |

**เครื่องมือ debug:** เปิด Web app URL ในเบราว์เซอร์ (`doGet`) เห็นสถานะ token/ปฏิทินทุกจุด • แท็บ `Log` ในชีต (`logRow`) จดผลการตอบของ LINE ทุกครั้ง

## ฝั่งเมนูในชีต

| อาการ | แก้ |
|---|---|
| ไม่เห็นเมนู **Booking** | กด F5 refresh ชีต / เช็คว่า Save โค้ดแล้ว |
| `Calendar is not defined` | ยังไม่เปิด Calendar API → A2 |
| เด้ง "Authorization required" | กดอนุญาตให้ครบ (Advanced → Go to → Allow) |
| Booking บางอันไม่เข้า | ดูกล่องสรุป "⚠ parse ไม่ได้" → เช็คว่ามี BOOKING NO + วันโหลดครบ |
| วันที่ผิด | ระบบอ่านเป็น **วัน/เดือน/ปี** เสมอ (`5/6/2026` = 5 มิ.ย.) |
| วางในชีตแล้วบรรทัดเพี้ยน | paste ลง Notepad ก่อน หรือใช้ Ctrl+Shift+V |

---

# หมายเหตุ

- **ลงปฏิทินของใคร:** ปฏิทิน Export ของคนที่ deploy เสมอ (Execute as Me) — ใครส่งก็ลงที่เดียวกัน
- **แชร์ให้ทีม:** Google Calendar → ปฏิทิน Export → Settings and sharing → แชร์อีเมล / public
- **ฟรีจริง:** ใช้ reply message (replyToken) ไม่กินโควตา push
- **กันสร้างซ้ำ:** booking no. = iCalUID — ส่งซ้ำจะอัปเดต event เดิม
- **อย่าเผยแพร่ Web app URL ที่มี `?token=`** เพราะเป็นกุญแจเข้าระบบ
- **เพิ่ม/แก้สถานที่:** แก้ `LOCATION_MAP` ใน `Code.gs`
