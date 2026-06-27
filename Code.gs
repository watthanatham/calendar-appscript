/**
 * Booking (LINE) -> Google Calendar ด้วย Google Apps Script
 *
 * วิธีใช้:
 *   1. สร้าง Google Sheet ใหม่ -> Extensions > Apps Script -> วางไฟล์นี้
 *   2. เปิด Advanced Calendar Service: ในตัวแก้ไป Apps Script กด Services (+) > Calendar API > Add
 *   3. กลับมาที่ Sheet, refresh -> จะมีเมนู "Booking"
 *   4. วางข้อความ booking ลงในชีต เริ่มที่ช่อง A1 (แต่ละบรรทัดลงเป็น 1 แถว รวมเส้น ==== ด้วย)
 *   5. เมนู Booking > ส่งเข้า Google Calendar
 *
 * รองรับ format เดียวกับฝั่ง Python (line_to_ics.py):
 *   - 1 booking คั่นด้วยเส้น ==== หรือขึ้นต้นด้วย BOOKING NO.
 *   - ต้องมี: เลข booking + วันโหลด (LOAD / LOADING DATE / โหลด ตามด้วยวันที่)
 *   - วันที่: วัน/เดือน/ปี รองรับ / . - และปี 2 หลัก (26 -> 2026)
 *   - กันสร้างซ้ำด้วย iCalUID = booking no. (รันซ้ำ = อัปเดตของเดิม)
 */

var CALENDAR_NAME = "Export";                     // ชื่อปฏิทินปลายทาง (public topic) — แก้ชื่อตรงนี้ได้

// [keyword ที่หาใน text, label ที่แสดง]
// keyword ต่างที่ map ไป label เดียวกัน จะถูกรวมยอด (เช่น 'อมตะ' กับ 'Amata' → รวมเป็น Amata)
// ลำดับสำคัญ: keyword ยาว/เฉพาะกว่าควรอยู่ก่อน (เช่น "โหลด 2 ที่" ต้องอยู่ก่อน)
var LOCATION_MAP = [
  ["โหลด 2 ที่", "โหลด 2 ที่(Both)"],
  ["อมตะ", "Amata"],
  ["Amata", "Amata"],
  ["ปิ่นทอง", "Pinthong"],
  ["Pinthong", "Pinthong"],
];

var DATE_SRC = "\\d{1,2}\\s*[./-]\\s*\\d{1,2}\\s*[./-]\\s*\\d{2,4}";


function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Booking")
    .addItem("ส่งเข้า Google Calendar", "pushToCalendar")
    .addToUi();
}


function parseDate(raw) {
  var p = raw.replace(/\s+/g, "").split(/[./-]/);
  var d = parseInt(p[0], 10), m = parseInt(p[1], 10), y = parseInt(p[2], 10);
  if (y < 100) y += 2000;
  return [y, m, d];
}

function pad(n) { return (n < 10 ? "0" : "") + n; }
function ymdStr(a) { return a[0] + "-" + pad(a[1]) + "-" + pad(a[2]); }
function dmyStr(a) { return pad(a[2]) + "/" + pad(a[1]) + "/" + a[0]; }

function addDay(a) {
  var t = new Date(Date.UTC(a[0], a[1] - 1, a[2]));
  t.setUTCDate(t.getUTCDate() + 1);
  return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
}


// หา keyword location ตัวแรกที่เจอใน segment (ตามลำดับใน LOCATION_MAP)
function findLocation(seg) {
  for (var i = 0; i < LOCATION_MAP.length; i++) {
    if (seg.indexOf(LOCATION_MAP[i][0]) !== -1) return LOCATION_MAP[i][1];
  }
  return null;
}


// breakdown ต่อ location: scan แต่ละ segment (คั่นด้วย \n หรือคำว่า 'และ')
// segment ที่มีทั้ง 'จำนวนตู้' (NX.. หรือ N ตู้) + keyword location → 1 entry
// label เดียวกันถูกรวมยอด (รักษาลำดับการเจอครั้งแรก)
function parseBreakdown(text) {
  var order = [], totals = {};
  text.split(/\n+|และ/).forEach(function (seg) {
    var c = seg.match(/(\d+)\s*X\s*\d+/i) || seg.match(/(\d+)\s*ตู้/);
    if (!c) return;
    var loc = findLocation(seg);
    if (!loc) return;
    if (!(loc in totals)) { totals[loc] = 0; order.push(loc); }
    totals[loc] += parseInt(c[1], 10);
  });
  return order.map(function (loc) { return { location: loc, count: totals[loc] }; });
}


function countContainers(text) {
  // หัว (3X20") > รวม NX.. ทุก invoice > รวม 'N ตู้'
  var head = text.match(/\(\s*(\d+)\s*X\s*\d+/i);
  if (head) return head[1];

  var sum = 0, m, re = /(\d+)\s*X\s*\d+/gi;
  while ((m = re.exec(text))) sum += parseInt(m[1], 10);
  if (sum) return String(sum);

  sum = 0; re = /(\d+)\s*ตู้/g;
  while ((m = re.exec(text))) sum += parseInt(m[1], 10);
  if (sum) return String(sum);

  return "?";
}


function parseBooking(text) {
  var bk = text.match(/BOOKING\s*NO\.?\s*:?\s*([A-Za-z]*\d+)/i);
  var ld = text.match(new RegExp("(?:LOAD(?:ING\\s*DATE)?|โหลด)\\s*[=:]?\\s*(" + DATE_SRC + ")", "i"));
  if (!bk || !ld) return null;

  var bookingNo = bk[1];

  // เลขที่ invoice: จับ token เอง (เลข+ตัวอักษร>=2+เลข) ไม่ซ้ำ ไม่เอา booking no.
  var invoices = [], m, re = /[0-9]*[A-Z]{2,}[0-9]{3,}/g;
  while ((m = re.exec(text))) {
    if (m[0] !== bookingNo && invoices.indexOf(m[0]) === -1) invoices.push(m[0]);
  }

  // breakdown ต่อ location (เช่น Pinthong: 2 ตู้, Amata: 1 ตู้) — ถ้ามีจะใช้แทน fallback
  var breakdown = parseBreakdown(text);
  var locations, containers;
  if (breakdown.length) {
    locations = breakdown.map(function (e) { return e.location; });
    containers = String(breakdown.reduce(function (s, e) { return s + e.count; }, 0));
  } else {
    // fallback: เผื่อ text ไม่มี location ในระยะใกล้กับ count
    locations = LOCATION_MAP
      .filter(function (kv) { return text.indexOf(kv[0]) !== -1; })
      .sort(function (a, b) { return text.indexOf(a[0]) - text.indexOf(b[0]); })
      .map(function (kv) { return kv[1]; })
      .filter(function (v, i, arr) { return arr.indexOf(v) === i; });
    containers = countContainers(text);
  }

  var pk = text.match(new RegExp("รับตู้.*?(" + DATE_SRC + ")"));

  // VGM: เก็บข้อความ VGM ทั้งบรรทัด (รองรับทุก format: 'VGM CUT OF : 05.06.2026 (ก่อน 15.00)',
  // 'VGM 10/06/2026 15:00 น.', 'VGM.: คัต 16.00 : 04-06-26')
  var vgmMatch = text.match(/VGM[^\n]*/i);
  var vgm = vgmMatch ? vgmMatch[0].replace(/\s+/g, " ").trim() : null;

  // flag: คืนตู้หลังเที่ยงคืน (ค้นแบบยืดหยุ่นช่องว่าง)
  var returnAfterMidnight = /คืนตู้\s*หลัง\s*เที่ยงคืน/.test(text);

  return {
    bookingNo: bookingNo,
    loadDate: parseDate(ld[1]),
    containers: containers,
    locations: locations,
    breakdown: breakdown,
    invoices: invoices,
    pickup: pk ? pk[1].replace(/\s+/g, "") : null,
    vgm: vgm,
    returnAfterMidnight: returnAfterMidnight,
  };
}


function splitBookings(text) {
  var chunks = [];
  text.split(/^\s*={3,}\s*$/m).forEach(function (piece) {
    var count = (piece.match(/BOOKING\s*NO/gi) || []).length;
    if (count > 1) {
      piece.split(/(?=BOOKING\s*NO)/i).forEach(function (c) { chunks.push(c); });
    } else {
      chunks.push(piece);
    }
  });
  return chunks
    .filter(function (c) { return /BOOKING\s*NO/i.test(c); })
    .map(function (c) { return c.trim(); });
}


function buildApiEvent(b) {
  var loc = b.locations.length ? b.locations.join("+") : "?";
  var summary = "[" + loc + "] Load " + b.containers + " ตู้ — BK " + b.bookingNo;

  var desc = [
    "Booking No: " + b.bookingNo,
    "Total Container: " + b.containers,
  ];
  if (b.breakdown && b.breakdown.length) {
    b.breakdown.forEach(function (e) {
      desc.push("• " + e.location + ": " + e.count + " ตู้");
    });
  } else {
    desc.push("Location: " + loc);
  }
  if (b.invoices.length) desc.push("Invoice No: " + b.invoices.join(", "));
  if (b.pickup) desc.push("แจ้งรถรับตู้: " + b.pickup);
  if (b.vgm) desc.push(b.vgm);
  if (b.returnAfterMidnight) desc.push("⚠ คืนตู้หลังเที่ยงคืน");

  return {
    summary: summary,
    description: desc.join("\n"),
    start: { date: ymdStr(b.loadDate) },
    end: { date: ymdStr(addDay(b.loadDate)) },     // all-day: วันสิ้นสุด = วันถัดไป (exclusive)
    iCalUID: b.bookingNo + "@calendar-hook",
  };
}


function getBookingText() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var last = sheet.getLastRow();
  if (last < 1) return "";
  return sheet.getRange(1, 1, last, 1).getValues()
    .map(function (r) { return r[0] === "" ? "" : String(r[0]); })
    .join("\n");
}


// หา advanced Calendar service ที่ Add ไว้ — รองรับทั้ง identifier "Calendar" และ "CalendarAPI"
function getCalendarService() {
  if (typeof Calendar !== "undefined") return Calendar;
  if (typeof CalendarAPI !== "undefined") return CalendarAPI;
  throw new Error(
    "ยังไม่ได้เปิด Advanced Calendar Service\n" +
    "วิธีแก้: ในตัวแก้ Apps Script กด Services (+) > Calendar API > Add\n" +
    "(identifier เป็น 'Calendar' หรือ 'CalendarAPI' ก็ได้)"
  );
}


// หา Calendar ID จากชื่อปฏิทิน (CALENDAR_NAME) — ไม่ต้องก็อป ID ยาวๆ มาเอง
function resolveCalendarId() {
  var cals = CalendarApp.getCalendarsByName(CALENDAR_NAME);
  if (!cals || !cals.length) {
    throw new Error(
      "ไม่พบปฏิทินชื่อ \"" + CALENDAR_NAME + "\"\n" +
      "วิธีแก้: สร้างปฏิทินชื่อนี้ก่อน หรือเช็คว่าแชร์ให้บัญชีนี้ (สิทธิ์แก้ไข) เรียบร้อยแล้ว"
    );
  }
  return cals[0].getId();
}


// แกนกลาง: รับ text (มี booking ได้หลายอัน) → import เข้า Calendar → คืน { ok, failed }
// ใช้ร่วมกันทั้งเมนู (pushToCalendar) และ LINE webhook (doPost)
function processBookings(text) {
  var chunks = splitBookings(text);
  var ok = [], failed = [];
  var cal = getCalendarService();
  var calendarId = resolveCalendarId();          // ปฏิทิน "Export"

  chunks.forEach(function (chunk) {
    var b = parseBooking(chunk);
    if (b) {
      // import = idempotent ตาม iCalUID: รันซ้ำจะอัปเดต event เดิม ไม่สร้างใหม่
      cal.Events.import(buildApiEvent(b), calendarId);
      ok.push("BK " + b.bookingNo + "  " + dmyStr(b.loadDate) +
              "  " + b.containers + " ตู้  @" + (b.locations.join("+") || "?"));
    } else {
      failed.push((chunk.split("\n")[0] || chunk).slice(0, 60));
    }
  });
  return { ok: ok, failed: failed };
}


// ประกอบข้อความสรุป — ใช้ทั้ง ui.alert (เมนู) และ reply กลับ LINE
function formatSummary(result) {
  if (!result.ok.length && !result.failed.length) return "ไม่พบ booking (ต้องมีคำว่า BOOKING NO)";
  var msg = "✓ บันทึก " + result.ok.length + " booking\n" + result.ok.join("\n");
  if (result.failed.length) {
    msg += "\n\n⚠ parse ไม่ได้ " + result.failed.length + " รายการ:\n" + result.failed.join("\n");
  }
  return msg;
}


function pushToCalendar() {
  SpreadsheetApp.getUi().alert(formatSummary(processBookings(getBookingText())));
}


// ===== LINE webhook =====

function getProp(name) {
  return PropertiesService.getScriptProperties().getProperty(name);
}


// เขียน log ลงแท็บ "Log" ในชีต (อ่านง่ายกว่าเปิด Executions)
function logRow(event, detail) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("Log");
  if (!sh) {
    sh = ss.insertSheet("Log");
    sh.appendRow(["เวลา", "เหตุการณ์", "รายละเอียด"]);
  }
  sh.appendRow([new Date(), event, detail]);
}


// health check: เปิด URL ในเบราว์เซอร์ (GET) จะเห็นรายงานสถานะระบบทุกจุด
// (ไม่โชว์ token เต็ม โชว์แค่ความยาว เพื่อความปลอดภัย)
function doGet(e) {
  var lines = [];

  var accessToken = getProp("LINE_CHANNEL_ACCESS_TOKEN");
  lines.push("LINE_CHANNEL_ACCESS_TOKEN: " +
    (accessToken ? "OK (length " + accessToken.length + ")" : "*** ไม่พบ / ยังไม่ได้ตั้ง ***"));

  var webhookToken = getProp("LINE_WEBHOOK_TOKEN");
  lines.push("LINE_WEBHOOK_TOKEN: " +
    (webhookToken ? "OK (length " + webhookToken.length + ")" : "*** ไม่พบ / ยังไม่ได้ตั้ง ***"));

  try {
    getCalendarService();
    lines.push("Advanced Calendar Service: OK");
  } catch (err) {
    lines.push("Advanced Calendar Service: *** ยังไม่ได้เปิด ***");
  }

  try {
    var calId = resolveCalendarId();
    lines.push("ปฏิทิน \"" + CALENDAR_NAME + "\": OK (" + calId + ")");
  } catch (err) {
    lines.push("ปฏิทิน \"" + CALENDAR_NAME + "\": *** ไม่พบ ***");
  }

  return ContentService.createTextOutput(lines.join("\n"));
}


// รับ POST จาก LINE — ตรวจ token ใน URL, แกะ events, ตอบกลับเฉพาะข้อความที่มี BOOKING NO
// ต้องตอบ HTTP 200 เสมอ ไม่งั้น LINE จะ retry → โดนยิงซ้ำ
function doPost(e) {
  // กัน URL หลุด: ต้องมี ?token= ตรงกับ LINE_WEBHOOK_TOKEN (Apps Script อ่าน header ไม่ได้)
  if (!e || !e.parameter || e.parameter.token !== getProp("LINE_WEBHOOK_TOKEN")) {
    logRow("forbidden", "token ที่ LINE ส่งมา = " + (e && e.parameter ? e.parameter.token : "(ไม่มี ?token= ใน URL)"));
    return ContentService.createTextOutput("forbidden");
  }

  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput("bad request");
  }

  (body.events || []).forEach(function (ev) {
    if (ev.type !== "message" || !ev.message || ev.message.type !== "text") return;
    if (!/BOOKING\s*NO/i.test(ev.message.text)) return;   // ข้อความคุยเล่นอื่น → เงียบ

    var reply;
    try {
      reply = formatSummary(processBookings(ev.message.text));
    } catch (err) {
      reply = "⚠ error: " + err.message;
    }
    replyMessage(ev.replyToken, reply);
  });

  return ContentService.createTextOutput("ok");
}


// ตอบกลับด้วย replyToken (ฟรี ไม่กินโควตา push) — token ใช้ได้ครั้งเดียว/อายุสั้น
function replyMessage(replyToken, text) {
  var resp = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + getProp("LINE_CHANNEL_ACCESS_TOKEN") },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: "text", text: text }],
    }),
    muteHttpExceptions: true,
  });

  logRow("LINE reply", "status " + resp.getResponseCode() + " | " + resp.getContentText());
}