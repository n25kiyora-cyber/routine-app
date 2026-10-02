// 手帳アプリ。1日の予定を「起きる時刻・寝る時刻」から逆算して、縦の時間軸で見せる。
// データはスマホの中(localStorage)だけに保存する。

const KEY = "routine-app-v2";
const OLD_KEY = "routine-app-v1";
const PX_PER_HOUR = 64; // 時間軸の縦の長さ: 1時間 = 64px
const DOW = ["日", "月", "火", "水", "木", "金", "土"];
const DOW_LONG = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // 月曜はじまりの並び
const GAS_URL = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/; // Google Apps Script の住所の形
const COLORS = ["blue", "indigo", "purple", "pink", "red", "orange", "green", "teal"]; // ルーティーンの色(iOSのシステムカラー)

// ---- はじめの設定(あとで設定画面から変えられる) ----
const weekday = (start, end) => ({ start, end });
function defaultSettings() {
  return {
    work: { 0: null, 1: weekday("09:00", "18:00"), 2: weekday("09:00", "18:00"), 3: weekday("09:00", "18:00"),
      4: weekday("09:00", "18:00"), 5: weekday("09:00", "18:00"), 6: null },
    commuteMin: 40, // 通勤(片道)
    prepMin: 50, // 朝の支度
    dinnerMin: 90, // 帰宅後の食事・入浴
    windDownMin: 60, // 寝る準備
    sleepHours: 7, // 睡眠時間
    holidayWake: "08:00", // 休みの日の起床
    holidayDinner: "19:00", // 休みの日の食事・入浴の開始
    night: "system", // 夜の配色: system(端末に合わせる) / auto(寝る準備の1時間前から) / off
    routines: [
      { id: "side", name: "副業", color: "blue", slots: { 1: s("21:00", 60), 2: s("21:00", 60), 3: s("21:00", 60), 4: s("21:00", 60), 5: s("21:00", 60), 6: s("10:00", 150), 0: s("10:00", 150) } },
      { id: "study", name: "AI・プログラミング", color: "indigo", slots: { 1: s("22:00", 30), 3: s("22:00", 30), 5: s("22:00", 30), 6: s("14:00", 60) } },
      { id: "move", name: "運動", color: "green", slots: { 2: s("20:15", 30), 4: s("20:15", 30), 0: s("16:00", 45) } },
      { id: "read", name: "読書", color: "orange", slots: { 0: s("22:30", 20), 1: s("23:00", 15), 2: s("23:00", 15), 3: s("23:00", 15), 4: s("23:00", 15), 5: s("23:00", 15), 6: s("22:30", 20) } },
    ],
  };
}
function s(start, min) {
  return { start, min };
}

// ---- 小さな道具 ----
const $ = (sel) => document.querySelector(sel);
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pad = (n) => String(n).padStart(2, "0");
const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
// 分(0時からの経過分。24時を超えてもよい)を「0:30」の形に
const clock = (min) => { const m = ((min % 1440) + 1440) % 1440; return `${Math.floor(m / 60)}:${pad(m % 60)}`; };
const dur = (min) => (min >= 60 ? `${Math.floor(min / 60)}時間${min % 60 ? `${min % 60}分` : ""}` : `${min}分`);
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function notice(text) {
  const el = $("#notice");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(notice.t);
  notice.t = setTimeout(() => (el.hidden = true), 2600);
}

// 確認用: 自分のMac(localhost)で開いたときだけ、?now=21:10 や ?theme=day で時刻・配色を変えて表示できる
const DEV = ["localhost", "127.0.0.1"].includes(location.hostname);
const params = new URLSearchParams(DEV ? location.search : "");
const NOSAVE = DEV && params.has("demo");

// ---- 保存と読み込み ----
// 保存データの形が正しいかを確かめる(復元するファイルにも使う)
function valid(d) {
  const hhmm = (v) => typeof v === "string" && /^([01]?\d|2[0-3]):[0-5]\d$/.test(v);
  const st = d?.settings;
  if (!st || typeof d.days !== "object" || !d.days || !Array.isArray(st.routines)) return false;
  for (const k of ["commuteMin", "prepMin", "dinnerMin", "windDownMin"]) if (!(typeof st[k] === "number" && st[k] >= 0 && st[k] <= 600)) return false;
  if (!(typeof st.sleepHours === "number" && st.sleepHours >= 3 && st.sleepHours <= 14)) return false;
  if (new Set(st.routines.map((r) => r.id)).size !== st.routines.length) return false;
  if (!hhmm(st.holidayWake) || !hhmm(st.holidayDinner) || typeof st.work !== "object") return false;
  for (let i = 0; i < 7; i++) { const w = st.work[i]; if (w && !(hhmm(w.start) && hhmm(w.end) && toMin(w.end) > toMin(w.start))) return false; }
  if (!wakeOk(st)) return false;
  return st.routines.every((r) => typeof r.id === "string" && typeof r.name === "string" && r.slots && typeof r.slots === "object"
    && Object.values(r.slots).every((sl) => hhmm(sl?.start) && typeof sl.min === "number" && sl.min > 0 && sl.min <= 720));
}
// 設定の一部がおかしくても、データ全体は消さずに、おかしい所だけ初期値に戻す
function repair(d) {
  if (!d || typeof d !== "object" || !d.settings || typeof d.settings !== "object") return null;
  const def = defaultSettings();
  const st = { ...def, ...d.settings };
  const hhmm = (v) => typeof v === "string" && /^([01]?\d|2[0-3]):[0-5]\d$/.test(v);
  for (const k of ["commuteMin", "prepMin", "dinnerMin", "windDownMin"]) if (!(typeof st[k] === "number" && st[k] >= 0 && st[k] <= 600)) st[k] = def[k];
  if (!(typeof st.sleepHours === "number" && st.sleepHours >= 3 && st.sleepHours <= 14)) st.sleepHours = def.sleepHours;
  for (const k of ["holidayWake", "holidayDinner"]) if (!hhmm(st[k])) st[k] = def[k];
  if (!["system", "auto", "off"].includes(st.night)) st.night = "system";
  const work = {};
  for (let i = 0; i < 7; i++) {
    const w = st.work?.[i];
    work[i] = w && hhmm(w.start) && hhmm(w.end) && toMin(w.end) > toMin(w.start) ? { start: w.start, end: w.end } : w ? def.work[i] : null;
  }
  st.work = work;
  if (!wakeOk(st)) { st.commuteMin = def.commuteMin; st.prepMin = def.prepMin; }
  for (let i = 0; i < 7; i++) if (st.work[i] && toMin(st.work[i].start) - st.commuteMin - st.prepMin < 0) st.work[i] = { ...def.work[1] };
  const seen = new Set();
  st.routines = (Array.isArray(st.routines) ? st.routines : def.routines).filter((r) => r && typeof r.name === "string").map((r) => {
    let id = typeof r.id === "string" ? r.id : `r${Math.random().toString(36).slice(2)}`;
    while (seen.has(id)) id += "_";
    seen.add(id);
    const slots = {};
    for (const [dk, sl] of Object.entries(r.slots || {})) if (hhmm(sl?.start) && sl.min > 0 && sl.min <= 720) slots[dk] = { start: sl.start, min: sl.min };
    return { id, name: r.name, color: COLORS.includes(r.color) ? r.color : COLORS[seen.size % COLORS.length], slots };
  });
  return sanitize({ ...d, settings: st });
}

const NIGHT_EDGE = 240; // 4:00。自分で入れた時刻はこれより前なら「その夜の深夜」とみなす
const validHM = (v) => typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v) && +v.split(":")[0] < 24 && +v.split(":")[1] < 60;
const hm2 = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(((m % 60) + 60) % 60).padStart(2, "0")}`; // time入力用の「09:00」形式

// 1日ごとの記録を正しい形にそろえる(壊れた日は捨てる)
function sanitize(d) {
  const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  const days = {};
  for (const [k, day] of Object.entries(obj(d.days))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !day || typeof day !== "object") continue;
    days[k] = {
      must: typeof day.must === "string" ? day.must : "",
      note: typeof day.note === "string" ? day.note : "",
      done: obj(day.done), skip: obj(day.skip), shorten: obj(day.shorten),
      carry: Array.isArray(day.carry) ? day.carry.filter((c) => c && typeof c.name === "string" && c.min > 0 && c.min <= 720) : [],
      // 今日だけの単発タスク {id,name,start:"HH:MM",min} と、ルーティーンの時刻の変更 {id:"HH:MM"}
      tasks: Array.isArray(day.tasks) ? day.tasks.filter((t) => t && typeof t.id === "string" && typeof t.name === "string" && validHM(t.start) && Number.isFinite(t.min) && t.min > 0 && t.min <= 720) : [],
      chk: obj(day.chk), // 朝・夜のルーティーンのチェック {項目id: true}
      // 読書メモ [{id, book, learned, action}]
      reads: Array.isArray(day.reads) ? day.reads.filter((r) => r && typeof r.id === "string" && typeof r.learned === "string" && r.learned.trim()).map((r) => ({ id: r.id, book: typeof r.book === "string" ? r.book.slice(0, 80) : "", learned: r.learned.slice(0, 2000), action: typeof r.action === "string" ? r.action.slice(0, 500) : "" })) : [],
      moved: Object.fromEntries(Object.entries(obj(day.moved)).filter(([, v]) => validHM(v))),
      rest: day.rest === true, // お休みの日(ルーティーンを出さない)
    };
  }
  const cl = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x.id === "string" && typeof x.name === "string" && x.name.trim()).slice(0, 30).map((x) => ({ id: x.id, name: x.name.slice(0, 40), ...(Number.isFinite(x.min) && x.min > 0 && x.min <= 180 ? { min: Math.round(x.min) } : {}), ...(x.on === "work" || x.on === "off" ? { on: x.on } : {}) })) : []); // min: タイマー用の分数(任意)、on: 仕事の日だけ/休みの日だけ
  const checklists = { morning: cl(obj(d.checklists).morning), night: cl(obj(d.checklists).night) };
  const reviews = {};
  for (const [k, r] of Object.entries(obj(d.reviews))) if (r && typeof r === "object") reviews[k] = r;
  const cal = d.cal && typeof d.cal.url === "string" && GAS_URL.test(d.cal.url) && typeof d.cal.key === "string" ? { url: d.cal.url, key: d.cal.key } : undefined;
  return { settings: d.settings, days, reviews, checklists, onboarded: d.onboarded === true, cal, calPushed: typeof d.calPushed === "string" ? d.calPushed : "", inboxSeen: Array.isArray(d.inboxSeen) ? d.inboxSeen.filter((x) => typeof x === "string").slice(-300) : [],
    settingsRev: typeof d.settingsRev === "number" && d.settingsRev > 0 ? d.settingsRev : Date.now() };
}
function readStore(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function load() {
  const raw = readStore(KEY);
  if (raw) {
    try {
      const d = JSON.parse(raw);
      if (valid(d)) {
        d.settings.routines.forEach((r, i) => { if (!COLORS.includes(r.color)) r.color = COLORS[i % COLORS.length]; }); // v2までは色がない
        return sanitize(d);
      }
      const fixed = repair(d);
      if (fixed) {
        if (!NOSAVE) try { localStorage.setItem(`${KEY}-before-repair-${Date.now()}`, raw); } catch {}
        setTimeout(() => notice("設定の一部を初期値に戻しました（記録はそのままです）"), 500);
        return fixed;
      }
    } catch {}
    if (!NOSAVE) try { localStorage.setItem(`${KEY}-broken-${Date.now()}`, raw); } catch {} // 読めないデータは消さずに退避
    setTimeout(() => notice("保存データが読めなかったため、別の場所に退避しました"), 500);
  }
  const fresh = { settings: defaultSettings(), days: {}, reviews: {}, checklists: { morning: [], night: [] } };
  // 前の版(v1)のデータがあれば引き継ぐ
  try {
    const old = JSON.parse(readStore(OLD_KEY) || "null");
    if (old?.days) {
      const map = { side: "side", study: "study", health: "move", read: "read" };
      for (const [k, day] of Object.entries(old.days)) {
        const done = {};
        for (const [id, v] of Object.entries(day.done || {})) if (v && map[id]) done[map[id]] = true;
        fresh.days[k] = { must: day.three?.[0]?.title || "", done };
      }
      fresh.reviews = old.reviews || {};
    }
  } catch {}
  return fresh;
}
let lastSettingsJson = null; // 設定が変わったかを見分ける(変わった時刻を版の番号にする)。起動時の設定で初期化する
function save() {
  if (NOSAVE) return true; // 確認用の表示では保存しない
  const js = JSON.stringify(state.settings);
  if (lastSettingsJson !== null && js !== lastSettingsJson) state.settingsRev = Date.now();
  lastSettingsJson = js;
  if (!state.settingsRev) state.settingsRev = Date.now();
  try {
    const js2 = JSON.stringify(state);
    localStorage.setItem(KEY, js2);
    lastGood = js2;
    if (state.cal && JSON.stringify(state.settings) !== state.calPushed) schedulePush(); // 設定が変わったらカレンダーへ
    return true;
  } catch {
    // 保存できなかった変更は画面にも残さない(開き直すと消えて見えるのを防ぐ)
    if (lastGood) { state = JSON.parse(lastGood); lastSettingsJson = JSON.stringify(state.settings); }
    notice("保存できなかったため、いまの変更を取り消しました。iPhoneの空き容量を確認してください");
    return false;
  }
}
let lastGood = null; // 最後に保存できた状態
let state = load();
try { lastGood = JSON.stringify(state); } catch {}
const S = () => state.settings;
function dayData(key) {
  if (!state.days[key]) state.days[key] = {};
  const d = state.days[key];
  if (!d.done) d.done = {}; if (!d.skip) d.skip = {}; if (!d.shorten) d.shorten = {}; if (!d.carry) d.carry = []; if (!d.tasks) d.tasks = []; if (!d.moved) d.moved = {}; if (!d.chk) d.chk = {}; if (!d.reads) d.reads = [];
  return d;
}

// ---- 逆算: その日の起床・就寝と予定を組み立てる ----
// どの勤務日でも、起床(始業−通勤−支度)が0時より後になるか
function wakeOk(st = S()) {
  return ORDER.every((d) => !st.work[d] || toMin(st.work[d].start) - st.commuteMin - st.prepMin >= 0);
}
function wakeOf(date) {
  const w = S().work[date.getDay()];
  const v = w ? toMin(w.start) - S().commuteMin - S().prepMin : toMin(S().holidayWake);
  return Math.max(0, v); // 0時より前にはしない
}
function planOf(date) {
  const st = S();
  const dow = date.getDay();
  const key = dayKey(date);
  const dd = dayData(key);
  const w = st.work[dow];
  const wake = wakeOf(date);
  const bed = wakeOf(addDays(date, 1)) + 1440 - Math.round(st.sleepHours * 60); // 翌朝から逆算
  const windDown = bed - st.windDownMin;
  const items = [];
  const add = (o) => items.push({ done: !!dd.done[o.id], ...o });

  // 支度・通勤・食事などの枠は出さない(起床の逆算にだけ使う)
  const home = w ? toMin(w.end) + st.commuteMin : null; // 帰宅する時刻
  if (w) add({ id: "work", kind: "work", name: "勤務", start: toMin(w.start), end: toMin(w.end) });
  for (const r of st.routines) {
    const slot = r.slots[dow];
    if (!slot || dd.skip[r.id] || dd.rest) continue;
    const min = Math.max(5, slot.min - (dd.shorten[r.id] || 0));
    let start = toMin(dd.moved[r.id] || slot.start);
    if (dd.moved[r.id] ? start < NIGHT_EDGE : start < wake - 120) start += 1440; // 0時過ぎの予定はその夜のもの(動かした時刻は4時前だけ深夜扱い)
    add({ id: r.id, kind: "routine", name: r.name, start, end: start + min, full: slot.min, moved: !!dd.moved[r.id] });
  }
  // 今日だけの単発タスク
  for (const t of dd.tasks) {
    if (dd.skip[t.id]) continue;
    const min = Math.max(5, t.min - (dd.shorten[t.id] || 0));
    let start = toMin(t.start);
    if (start < NIGHT_EDGE) start += 1440; // 4時前は深夜(その夜)、4時以降はその日の朝以降
    add({ id: t.id, kind: "routine", task: true, name: t.name, start, end: start + min, full: t.min });
  }
  // Googleカレンダーの予定(この日の起床2時間前〜翌日の起床2時間前に始まるもの)
  const dayStart = date.getTime();
  const lo = wake - 120, hi = wakeOf(addDays(date, 1)) + 1440 - 120;
  calEvents.forEach((ev, i) => {
    const s0 = parseIso(ev.start), e0 = parseIso(ev.end);
    if (s0 === null || e0 === null) return;
    const start = Math.round((s0 - dayStart) / 60000), end = Math.round((e0 - dayStart) / 60000);
    if (start < lo || start >= hi || end <= start) return;
    add({ id: `cal-${i}`, kind: "cal", name: ev.title, start, end });
  });

  // 前の日から持ち越した予定: 夜の空いている時間に置く
  dd.carry.forEach((c, ci) => {
    const id = `carry-${ci}`;
    if (dd.skip[id] || dd.rest) return;
    const min = Math.max(5, c.min - (dd.shorten[id] || 0));
    const busy = items.filter((i) => i.kind !== "life").sort((a, b) => a.start - b.start);
    const earliest = Math.max(home ?? 1140, wake);
    let start = earliest;
    for (const b of busy) if (b.end > start && b.start < start + min) start = b.end;
    // 寝る準備までに入らなければ、寝る準備の直前に置く(はみ出しとして調整を促す)
    if (start + min > windDown) start = Math.max(earliest, windDown - min);
    if (dd.moved[id]) { start = toMin(dd.moved[id]); if (start < NIGHT_EDGE) start += 1440; }
    add({ id, kind: "routine", name: c.name, start, end: start + min, carried: true, src: c.id, moved: !!dd.moved[id] });
  });
  add({ id: "winddown", kind: "rest", name: "寝る準備", start: windDown, end: bed });
  add({ id: "sleep", kind: "sleep", name: "睡眠", start: bed, end: bed + Math.round(st.sleepHours * 60) });
  items.sort((a, b) => a.start - b.start);

  // はみ出しの検出: 予定どうしの重なり、寝る準備・帰宅前へのはみ出し
  const conflicts = [];
  const fixed = items.filter((i) => i.kind !== "routine");
  const routines = items.filter((i) => i.kind === "routine");
  for (const r of routines) {
    for (const o of [...fixed, ...routines]) {
      if (o === r || (o.kind === "routine" && o.start < r.start)) continue;
      const over = Math.min(r.end, o.end) - Math.max(r.start, o.start);
      if (over > 0 && !(o.kind === "routine" && o.start === r.start && o.id < r.id)) conflicts.push({ item: r, with: o, over });
    }
  }
  for (const r of routines) {
    if (r.start < wake) conflicts.push({ item: r, with: { kind: "life", name: "起床前" }, over: wake - r.start });
  }
  return { date, key, dd, wake, bed, windDown, items, conflicts, work: w };
}

// 確認用: 自分のMacで開いたときだけ、?now=21:10 や ?theme=day でその時刻・配色を表示できる


// 「いま」はどの日か: 前の日の就寝予定の1時間後までは、前の日の夜の続きとして扱う
function bedOf(date) {
  return wakeOf(addDays(date, 1)) + 1440 - Math.round(S().sleepHours * 60);
}
function logicalNow() {
  const now = new Date();
  const q = params.get("now");
  if (q && /^\d{1,2}:\d{2}$/.test(q)) { const [h, m] = q.split(":").map(Number); now.setHours(h, m); }
  let date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let min = now.getHours() * 60 + now.getMinutes();
  const yesterday = addDays(date, -1);
  if (min + 1440 < bedOf(yesterday) + 60) {
    date = yesterday;
    min += 1440;
  }
  return { date, min };
}


// 削除ボタンは2回押して確定(誤操作防止。確認ダイアログを使わない)
let armed = { id: null, at: 0 };
function confirmTwice(id) {
  if (armed.id === id && Date.now() - armed.at < 3000) { armed = { id: null, at: 0 }; return true; }
  armed = { id, at: Date.now() };
  notice("もう一度押すと削除します");
  return false;
}


// ---- Googleカレンダー連携(Google Apps Script 経由) ----
// 時刻の文字列(例: 2026-10-01T21:00+09:00)を、時差も含めて正しく読む
function parseIso(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|([+-])(\d{2}):?(\d{2}))$/.exec(String(str));
  if (!m) return null;
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  const off = m[7] === "Z" ? 0 : (m[8] === "-" ? -1 : 1) * (+m[9] * 60 + +m[10]);
  return utc - off * 60000;
}
const CAL_CACHE = "routine-app-calcache";
let calEvents = [];
let calState = { at: 0, error: "" };
try {
  const c = JSON.parse(readStore(CAL_CACHE) || "null");
  if (c && Array.isArray(c.events)) { calEvents = c.events; calState.at = c.at || 0; }
} catch {}
if (NOSAVE && params.get("demo") === "cal") {
  const t = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString().replace(/\.\d{3}Z$/, "Z"); };
  calEvents = [{ title: "チーム定例", start: t(10, 0), end: t(11, 0) }, { title: "友人と食事", start: t(19, 30), end: t(21, 30) }];
}

async function gas(action, extra) {
  const c = state.cal;
  if (!c || !c.url || !c.key) throw new Error("not_configured");
  const res = await fetch(c.url, { method: "POST", body: JSON.stringify({ key: c.key, action, ...extra }) }); // 本文は文字列(プリフライトなし)
  const j = await res.json();
  if (!j.ok) throw new Error(j.error || "error");
  return j;
}
// AIがドライブに置いたタスクを、まだ取り込んでいない分だけ足す
function takeInbox(list) {
  if (!Array.isArray(list)) return;
  if (!Array.isArray(state.inboxSeen)) state.inboxSeen = [];
  const seen = new Set(state.inboxSeen);
  let n = 0;
  for (const x of list) {
    if (!x || typeof x.id !== "string" || seen.has(x.id) || typeof x.name !== "string" || !x.name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(x.date)) continue;
    const ln = logicalNow();
    const start = validHM(x.start) ? x.start : hm2(x.date === dayKey(ln.date) ? Math.ceil((ln.min + 10) / 5) * 5 : 1200);
    const min = Math.min(240, Math.max(5, Number(x.min) || 15));
    dayData(x.date).tasks.push({ id: `ib-${x.id}`, name: x.name.trim().slice(0, 40), start, min });
    state.inboxSeen.push(x.id);
    seen.add(x.id);
    n++;
  }
  if (!n) return;
  state.inboxSeen = state.inboxSeen.slice(-300);
  if (save()) notice(`Claudeからタスクが${n}件届きました`);
}
async function refreshEvents() {
  if (!state.cal || NOSAVE) return;
  try {
    const j = await gas("events", { from: dayKey(addDays(logicalNow().date, -1)), days: 9 });
    calEvents = Array.isArray(j.events) ? j.events : [];
    takeInbox(j.inbox);
    calState = { at: Date.now(), error: "" };
    try { localStorage.setItem(CAL_CACHE, JSON.stringify({ at: calState.at, events: calEvents })); } catch {}
    if (!busy()) render();
  } catch (e) {
    calState.error = e.message;
  }
}
let pushTimer = null;
let pushing = false, pushAgain = false; // 送信は1つずつ。送信中に変わったら、終わってからもう一度
function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushSettings, 1500);
}
async function pushSettings() {
  if (!state.cal || NOSAVE) return;
  if (pushing) { pushAgain = true; return; }
  pushing = true;
  const snapshot = JSON.stringify(state.settings);
  try {
    const j = await gas("push", { settings: JSON.parse(snapshot), rev: state.settingsRev });
    state.calPushed = snapshot;
    localStorage.setItem(KEY, JSON.stringify(state));
    const r = j.result || {};
    notice(`カレンダーに反映しました（追加${r.created || 0}・変更${r.updated || 0}・削除${r.deleted || 0}）`);
  } catch (e) {
    if (e.message === "busy") { notice("カレンダーが混み合っています。少しあとでもう一度試します"); setTimeout(schedulePush, 20000); }
    else if (e.message !== "stale") notice("カレンダーへの反映に失敗しました");
  } finally {
    pushing = false;
    if (pushAgain) { pushAgain = false; if (state.cal) schedulePush(); } // 失敗しただけなら繰り返さない(次に設定を変えたときに送る)
  }
}
function calErrorText(code) {
  return { unauthorized: "合言葉が違います", not_configured: "住所と合言葉を入れてください", bad_settings: "設定の形がGAS側で受け付けられませんでした" }[code]
    || "つながりませんでした（住所を確かめてください）";
}

// ---- 読書メモの書き出し(CSV / AIに貼る文章) ----
function readsIn(from, to) { // from,to は "YYYY-MM-DD"(両端を含む)。空なら全期間
  return Object.keys(state.days).filter((k) => (!from || k >= from) && (!to || k <= to)).sort()
    .flatMap((k) => (state.days[k].reads || []).map((r) => ({ date: k, ...r })));
}
function readsCsv(list) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return "\uFEFF" + [["日付", "本", "身についたこと", "明日から試すこと"], ...list.map((r) => [r.date, r.book, r.learned, r.action])].map((row) => row.map(q).join(",")).join("\r\n");
}
function readsForAI(list, label) {
  const body = list.map((r) => `### ${r.date}『${r.book || "（本の名前なし）"}』\n- 身についたこと: ${r.learned}${r.action ? `\n- 明日から試すこと: ${r.action}` : ""}`).join("\n\n");
  return `以下は私の${label}の読書メモです（${list.length}件）。\n次の3つをまとめてください。\n1. 繰り返し出てくるテーマや考え方\n2. 実際の行動に移せたこと・まだのこと\n3. 来月いちばん意識すべきことを1つ\n\n${body}`;
}
async function shareText(name, text, type) {
  const file = new File([text], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---- 書き出し・復元 ----
async function exportData() {
  const name = `techo-backup-${dayKey(new Date())}.json`;
  const copy = { ...state, cal: state.cal ? { url: state.cal.url, key: "" } : undefined }; // 合言葉は書き出さない
  const file = new File([JSON.stringify(copy, null, 2)], name, { type: "application/json" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "手帳のバックアップ" });
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
}
async function importData(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!valid(d)) throw 0;
    const next = sanitize(d);
    if (state.cal && (!next.cal || !next.cal.key)) next.cal = state.cal; // 合言葉は今の端末のものを使う
    if (!NOSAVE) {
      localStorage.setItem(`${KEY}-before-restore`, JSON.stringify(state)); // 前のデータを退避
      localStorage.setItem(KEY, JSON.stringify(next)); // 先に保存できるか確かめてから切り替える
    }
    state = next;
    render();
    notice("復元しました（前のデータも保管しています）");
  } catch {
    notice("このファイルは読み込めませんでした");
  }
}

