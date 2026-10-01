// 手帳アプリ。1日の予定を「起きる時刻・寝る時刻」から逆算して、縦の時間軸で見せる。
// データはスマホの中(localStorage)だけに保存する。

const KEY = "routine-app-v2";
const OLD_KEY = "routine-app-v1";
const PX_PER_HOUR = 64; // 時間軸の縦の長さ: 1時間 = 64px
const DOW = ["日", "月", "火", "水", "木", "金", "土"];
const DOW_LONG = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // 月曜はじまりの並び

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
      { id: "side", name: "副業", slots: { 1: s("21:00", 60), 2: s("21:00", 60), 3: s("21:00", 60), 4: s("21:00", 60), 5: s("21:00", 60), 6: s("10:00", 150), 0: s("10:00", 150) } },
      { id: "study", name: "AI・プログラミング", slots: { 1: s("22:00", 30), 3: s("22:00", 30), 5: s("22:00", 30), 6: s("14:00", 60) } },
      { id: "move", name: "運動", slots: { 2: s("20:15", 30), 4: s("20:15", 30), 0: s("16:00", 45) } },
      { id: "read", name: "読書", slots: { 0: s("22:30", 20), 1: s("23:00", 15), 2: s("23:00", 15), 3: s("23:00", 15), 4: s("23:00", 15), 5: s("23:00", 15), 6: s("22:30", 20) } },
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
    return { id, name: r.name, slots };
  });
  return sanitize({ ...d, settings: st });
}

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
    };
  }
  const reviews = {};
  for (const [k, r] of Object.entries(obj(d.reviews))) if (r && typeof r === "object") reviews[k] = r;
  return { settings: d.settings, days, reviews, onboarded: d.onboarded === true };
}
function readStore(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function load() {
  const raw = readStore(KEY);
  if (raw) {
    try {
      const d = JSON.parse(raw);
      if (valid(d)) return sanitize(d);
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
  const fresh = { settings: defaultSettings(), days: {}, reviews: {} };
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
function save() {
  if (NOSAVE) return true; // 確認用の表示では保存しない
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    notice("保存に失敗しました");
    return false;
  }
}
let state = load();
const S = () => state.settings;
function dayData(key) {
  state.days[key] ??= {};
  const d = state.days[key];
  d.done ??= {}; d.skip ??= {}; d.shorten ??= {}; d.carry ??= [];
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

  if (w) {
    const ws = toMin(w.start), we = toMin(w.end);
    add({ id: "prep", kind: "life", name: "支度", start: wake, end: wake + st.prepMin });
    add({ id: "commute-am", kind: "life", name: "通勤", start: wake + st.prepMin, end: ws });
    add({ id: "work", kind: "work", name: "勤務", start: ws, end: we });
    add({ id: "commute-pm", kind: "life", name: "帰宅", start: we, end: we + st.commuteMin });
    add({ id: "dinner", kind: "life", name: "食事・入浴", start: we + st.commuteMin, end: we + st.commuteMin + st.dinnerMin });
  } else {
    const d0 = toMin(st.holidayDinner);
    add({ id: "dinner", kind: "life", name: "食事・入浴", start: d0, end: d0 + st.dinnerMin });
  }
  for (const r of st.routines) {
    const slot = r.slots[dow];
    if (!slot || dd.skip[r.id]) continue;
    const min = Math.max(5, slot.min - (dd.shorten[r.id] || 0));
    let start = toMin(slot.start);
    if (start < wake - 120) start += 1440; // 0時過ぎの予定はその夜のもの
    add({ id: r.id, kind: "routine", name: r.name, start, end: start + min, full: slot.min });
  }
  // 前の日から持ち越した予定: 夜の空いている時間に置く
  dd.carry.forEach((c, ci) => {
    const id = `carry-${ci}`;
    if (dd.skip[id]) return;
    const min = Math.max(5, c.min - (dd.shorten[id] || 0));
    const busy = items.filter((i) => i.kind !== "life" || i.id === "dinner").sort((a, b) => a.start - b.start);
    const earliest = Math.max(items.find((i) => i.id === "dinner")?.end ?? 1140, wake);
    let start = earliest;
    for (const b of busy) if (b.end > start && b.start < start + min) start = b.end;
    // 寝る準備までに入らなければ、寝る準備の直前に置く(はみ出しとして調整を促す)
    if (start + min > windDown) start = Math.max(earliest, windDown - min);
    add({ id, kind: "routine", name: c.name, start, end: start + min, carried: true, src: c.id });
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

// ---- 画面の切り替え ----
let tab = "today";
let viewDate = null; // 週画面から別の日を開いたとき
let workOpen = false; // 勤務の帯を広げるか
document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; viewDate = null; render(true); }));

function render(scrollNow = false) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  applyNight();
  if (tab === "today") renderToday(scrollNow);
  if (tab === "week") renderWeek();
  if (tab === "settings") renderSettings();
}

function applyNight() {
  const mode = S().night;
  const { date, min } = logicalNow();
  const p = planOf(date);
  const night = mode === "auto" && min >= p.windDown - 60;
  const force = ["day", "night"].includes(params.get("theme")) ? params.get("theme") : "";
  document.documentElement.dataset.theme = force || (mode === "system" ? "" : night ? "night" : "day");
}

// ---- 今日の画面 ----
function renderToday(scrollNow) {
  const ln = logicalNow();
  const date = viewDate || ln.date;
  const isToday = dayKey(date) === dayKey(ln.date);
  const now = isToday ? ln.min : null;
  const p = planOf(date);
  const tomorrow = addDays(date, 1);
  const lastWeekNext = lastWeekFocus(date);

  const todays = p.items.filter((i) => i.kind === "routine").map((i) => i.name);
  const noteTime = now === null || now >= p.windDown - 120;

  $("#view").innerHTML = `
    <header class="head">
      <div>
        <p class="date"><span class="dow">${DOW_LONG[date.getDay()]}</span>${date.getMonth() + 1}月${date.getDate()}日</p>
        <p class="today-set">${todays.length ? todays.map(esc).join("・") : "決まったルーティーンのない日"}</p>
      </div>
      ${isToday ? "" : `<button class="link" id="back-today">今日に戻る</button>`}
    </header>

    ${state.onboarded ? "" : `<button class="setup-banner" id="setup">勤務と睡眠を設定すると、あなたの時刻で逆算されます<span>設定する</span></button>`}
    ${isToday ? nextCard(p, now) : ""}

    ${p.dd.must
      ? `<button class="must" id="must"><span class="label">今日の必須</span><span class="text">${esc(p.dd.must)}</span></button>`
      : `<button class="must-empty" id="must">今日、ひとつ決める<span>＋</span></button>`}
    ${lastWeekNext ? `<p class="focus">今週変えること　${esc(lastWeekNext)}</p>` : ""}

    <section class="sleepbar" aria-label="睡眠">
      <div class="seq">
        <div class="wd"><span class="t">${clock(p.windDown)}</span><span class="k">寝る準備</span></div>
        <span class="arrow">→</span>
        <div><span class="t big">${clock(p.bed)}</span><span class="k">就寝</span></div>
        <span class="arrow">→</span>
        <div><span class="t big">${clock(wakeOf(tomorrow))}</span><span class="k">${DOW[tomorrow.getDay()]}曜 起床</span></div>
      </div>
      <p class="len">睡眠 ${dur(Math.round(S().sleepHours * 60))}${sleepHint(p, now)}</p>
    </section>

    ${conflictBox(p)}

    <section class="timeline" id="timeline">${timeline(p, now)}</section>

    <button class="line-note ${noteTime ? "" : "quiet-note"} ${p.dd.note ? "filled" : ""}" id="note">
      <span class="label">今日できたこと</span>
      <span class="text">${p.dd.note ? esc(p.dd.note) : noteTime ? "寝る前に一行だけ残す" : "夜になったら、一行だけ"}</span>
    </button>
    ${p.dd.note && noteTime ? `<p class="greet">今日も、おつかれさま。</p>` : ""}`;

  $("#back-today")?.addEventListener("click", () => { viewDate = null; render(true); });
  $("#setup")?.addEventListener("click", () => onboarding(1));
  $("#must").onclick = () => editText("今日の必須", "これだけはやる、を1つ", p.dd.must, (v) => { p.dd.must = v; });
  $("#note").onclick = () => editText("今日できた一つ", "小さなことでいい", p.dd.note, (v) => { p.dd.note = v; });
  document.querySelectorAll("[data-item]").forEach((el) => (el.onclick = () => itemSheet(p, el.dataset.item)));
  $("#work-toggle")?.addEventListener("click", (e) => { e.stopPropagation(); workOpen = !workOpen; render(); });
  document.querySelectorAll("[data-fix]").forEach((el) => (el.onclick = () => {
    const [act, id] = el.dataset.fix.split(":");
    applyAction(p, id, act);
  }));
  if (scrollNow && now !== null) {
    const line = $(".now");
    if (line) window.scrollTo({ top: Math.max(0, line.getBoundingClientRect().top + window.scrollY - 220) });
  }
}

// いまやること(実行中)か、次にやること。支度・通勤も含めて、実際の行動を案内する
function nextCard(p, now) {
  const acts = p.items.filter((i) => i.kind !== "sleep" && !i.done);
  const endWord = (i) => (i.id === "prep" ? `${clock(i.end)}に出発` : i.id === "commute-am" ? `${clock(i.end)}に始業` : `${clock(i.end)}まで`);
  const cur = [...acts].reverse().find((i) => i.start <= now && now < i.end);
  if (cur) {
    const after = acts.find((i) => i.start >= cur.end && (i.kind === "routine" || i.kind === "rest"));
    return `<button class="next doing" ${cur.kind === "routine" || cur.kind === "rest" ? `data-item="${cur.id}"` : ""}>
      <span class="label">いま</span>
      <span class="what">${esc(cur.name)}</span>
      <span class="when">${endWord(cur)}・あと${dur(cur.end - now)}</span></button>
      ${after ? `<p class="then">そのあと　<span class="t">${clock(after.start)}</span> ${esc(after.name)}</p>` : ""}`;
  }
  const nx = acts.find((i) => i.start > now);
  if (!nx || now >= p.bed) {
    return `<div class="next rest"><span class="label">今日はここまで</span><span class="what">おやすみなさい</span></div>`;
  }
  const soon = nx.start - now <= 15;
  return `<button class="next" ${nx.kind === "routine" || nx.kind === "rest" ? `data-item="${nx.id}"` : ""}>
    <span class="label">${soon ? `あと${nx.start - now}分` : "次は"}</span>
    <span class="what"><span class="t">${clock(nx.start)}</span>${esc(nx.name)}</span>
    <span class="when">${dur(nx.end - nx.start)}</span></button>`;
}

function sleepHint(p, now) {
  if (now === null) return "";
  const toWind = p.windDown - now;
  if (toWind > 0 && toWind <= 180) return `<span class="hint">寝る準備まで あと${dur(toWind)}</span>`;
  if (now >= p.windDown && now < p.bed) return `<span class="hint">寝る準備の時間です</span>`;
  return "";
}

function conflictBox(p) {
  if (!p.conflicts.length) return "";
  const c = p.conflicts.sort((a, b) => b.over - a.over)[0];
  const r = c.item;
  const withName = c.with.kind === "rest" ? "寝る準備" : c.with.name;
  const canShorten = r.end - r.start > 15;
  return `<section class="conflict">
    <p><strong>${esc(r.name)}</strong>が${esc(withName)}に${dur(c.over)}はみ出しています。睡眠は削らずに調整しましょう。</p>
    <div class="actions">
      ${canShorten ? `<button data-fix="shorten:${r.id}">15分短く</button>` : ""}
      <button data-fix="carry:${r.id}">明日に回す</button>
      <button data-fix="skip:${r.id}">今日は見送る</button>
    </div></section>`;
}

// 縦の時間軸。勤務と睡眠の長い帯は折りたたむ(縮めた区間を記録して、位置を計算する)
function timeline(p, now) {
  const from = p.wake - 30;
  const to = p.bed + 60;
  const k = PX_PER_HOUR / 60;
  const work = p.items.find((i) => i.kind === "work");
  const folds = [];
  if (work && !workOpen && work.end - work.start > 120) folds.push({ a: work.start + 30, b: work.end - 30, h: 40 });
  const y = (t) => {
    let v = (Math.min(Math.max(t, from), to) - from) * k;
    for (const f of folds) {
      if (t <= f.a) continue;
      const inside = Math.min(t, f.b) - f.a;
      v -= inside * k - (inside / (f.b - f.a)) * f.h;
    }
    return v;
  };
  const height = y(to);

  let ticks = "";
  for (let t = Math.ceil(from / 60) * 60; t <= to; t += 60) {
    if (folds.some((f) => t > f.a && t < f.b)) continue;
    if (now !== null && Math.abs(t - now) < 12) continue; // いまの時刻と重なる目盛りは出さない
    ticks += `<span class="tick" style="top:${y(t)}px">${clock(t)}</span>`;
  }
  for (const f of folds) ticks += `<span class="fold-mark" style="top:${(y(f.a) + y(f.b)) / 2}px">⋮</span>`;
  if (now !== null && now >= from && now <= to) ticks += `<span class="tick now-t" style="top:${y(now)}px">${clock(now)}</span>`;

  // 重なった予定は、名前が隠れないように少し下にずらして全部見せる
  let prevTop = -Infinity, prevEnd = -Infinity;
  const blocks = p.items.filter((i) => i.kind !== "sleep").map((i) => {
    let top = y(i.start);
    const overlaps = i.kind !== "life" && i.kind !== "work" && i.start < prevEnd;
    if (overlaps && top < prevTop + 30) top = prevTop + 30;
    if (i.kind !== "life" && i.kind !== "work") { prevTop = top; prevEnd = Math.max(prevEnd, i.end); }
    return { ...i, top, stacked: overlaps };
  });

  const html = blocks.map((i) => {
    const top = i.top, h = i.stacked ? 28 : Math.max(22, y(i.end) - y(i.start) - 3);
    const compact = h < 44;
    const cur = now !== null && i.start <= now && now < i.end;
    const over = p.conflicts.some((c) => c.item.id === i.id);
    const cls = ["blk", i.kind, i.done ? "done" : "", cur ? "cur" : "", over ? "over" : "", compact ? "compact" : "", i.stacked ? "stacked" : ""].join(" ");
    const extra = i.kind === "work" && folds.length ? `<button class="fold" id="work-toggle">広げる</button>`
      : i.kind === "work" && work.end - work.start > 120 ? `<button class="fold" id="work-toggle">たたむ</button>` : "";
    const clickable = i.kind === "routine" || i.kind === "rest";
    const label = i.kind === "work" ? `${clock(i.start)}–${clock(i.end)}` : clock(i.start);
    const len = i.kind === "work" ? dur(i.end - i.start) : clickable ? dur(i.end - i.start) : "";
    return `<div class="${cls}" style="top:${top}px;height:${h}px" ${clickable ? `data-item="${i.id}" role="button" tabindex="0"` : ""}>
      <span class="t">${label}</span><span class="n">${i.done ? `<i class="ok">✓</i>` : ""}${esc(i.name)}${i.carried ? `<i class="tag">持ち越し</i>` : ""}</span>
      ${len ? `<span class="d">${len}</span>` : ""}${extra}
    </div>`;
  }).join("");

  const sleep = `<div class="blk sleep" style="top:${y(p.bed)}px;height:${Math.max(40, height - y(p.bed))}px">
    <span class="t">${clock(p.bed)}</span><span class="n">睡眠</span><span class="d">翌${clock(p.bed + Math.round(S().sleepHours * 60))}まで</span></div>`;
  const nowLine = now !== null && now >= from && now <= to ? `<div class="now" style="top:${y(now)}px"></div>` : "";
  return `<div class="axis" style="height:${height}px">${ticks}</div><div class="lane" style="height:${height}px">${html}${sleep}${nowLine}</div>`;
}

// ---- 予定をタップしたときのパネル ----
function itemSheet(p, id) {
  const i = p.items.find((x) => x.id === id);
  if (!i) return;
  if (i.kind === "sleep" || i.kind === "work") return;
  const canShorten = i.kind === "routine" && i.end - i.start > 15;
  openSheet(`
    <p class="sheet-t">${clock(i.start)}–${clock(i.end)}</p>
    <h2>${esc(i.name)}</h2>
    <div class="sheet-actions">
      <button class="primary" data-act="done">${i.done ? "未完了に戻す" : "できた"}</button>
      ${canShorten ? `<button data-act="shorten">15分短くする</button>` : ""}
      ${i.kind === "routine" ? `<button data-act="carry">明日に回す</button><button data-act="skip">今日は見送る</button>` : ""}
      <button class="quiet" data-act="close">閉じる</button>
    </div>`, (act) => applyAction(p, id, act));
}

function applyAction(p, id, act) {
  const dd = p.dd;
  const r = p.items.find((x) => x.id === id);
  if (act === "done") dd.done[id] = !dd.done[id];
  if (act === "shorten") dd.shorten[id] = (dd.shorten[id] || 0) + 15;
  if (act === "skip") dd.skip[id] = true;
  if (act === "carry" && r) {
    dd.skip[id] = true;
    dayData(dayKey(addDays(p.date, 1))).carry.push({ id: r.src || id, name: r.name, min: r.end - r.start });
    notice(`${r.name}を明日に回しました`);
  }
  if (act !== "close") save();
  closeSheet();
  render();
}

// ---- 下から出るパネル ----
function openSheet(html, onAct) {
  const sh = $("#sheet");
  sh.innerHTML = html;
  sh.hidden = false;
  $("#sheet-backdrop").hidden = false;
  sh.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => onAct(b.dataset.act)));
  $("#sheet-backdrop").onclick = closeSheet;
}
function closeSheet() {
  armed = { id: null, at: 0 };
  $("#sheet").hidden = true;
  $("#sheet-backdrop").hidden = true;
}
function editText(title, placeholder, value, set) {
  openSheet(`
    <h2>${esc(title)}</h2>
    <textarea id="sheet-input" rows="3" placeholder="${esc(placeholder)}"></textarea>
    <div class="sheet-actions">
      <button class="primary" data-act="save">決める</button>
      <button class="quiet" data-act="close">閉じる</button>
    </div>`, (act) => {
    if (act === "save") { set($("#sheet-input").value.trim()); save(); }
    closeSheet();
    render();
  });
  const input = $("#sheet-input");
  input.value = value || "";
  input.focus();
}

// ---- 週の振り返り ----
function mondayOf(date) {
  return addDays(date, -((date.getDay() + 6) % 7));
}
function lastWeekFocus(date) {
  return state.reviews[dayKey(addDays(mondayOf(date), -7))]?.next || "";
}
function reviewFields(date) {
  const r = state.reviews[dayKey(mondayOf(date))] || {};
  const f = (id, label) => `<label>${label}<textarea data-review="${id}" rows="2">${esc(r[id])}</textarea></label>`;
  return `${f("done", "できたこと")}${f("why", "できなかった理由")}${f("next", "来週変えること（1つだけ）")}`;
}
function bindReview(date) {
  const wk = dayKey(mondayOf(date));
  document.querySelectorAll("[data-review]").forEach((el) => (el.oninput = () => {
    state.reviews[wk] = { ...state.reviews[wk], [el.dataset.review]: el.value };
    save();
  }));
}

// ---- 週の画面 ----
function renderWeek() {
  const ln = logicalNow();
  const mon = mondayOf(ln.date);
  const days = [...Array(7)].map((_, i) => addDays(mon, i));
  $("#view").innerHTML = `
    <header class="head"><p class="date"><span class="dow">今週</span>${mon.getMonth() + 1}月${mon.getDate()}日から</p></header>
    <ol class="week">${days.map((d) => {
      const p = planOf(d);
      const today = dayKey(d) === dayKey(ln.date);
      const past = d < ln.date;
      const rs = p.items.filter((i) => i.kind === "routine");
      return `<li class="${today ? "today" : ""} ${past ? "past" : ""}" data-day="${dayKey(d)}">
        <div class="wd"><span class="dow">${DOW[d.getDay()]}</span><span class="dn">${d.getDate()}</span></div>
        <div class="body">
          <p class="sleep-line">${clock(p.wake)} 起床　·　${clock(p.bed)} 就寝</p>
          <p class="work-line">${p.work ? `勤務 ${clock(toMin(p.work.start))}–${clock(toMin(p.work.end))}` : "休み"}</p>
          <ul>${rs.map((r) => `<li class="${r.done ? "done" : ""}"><span class="t">${clock(r.start)}</span>${esc(r.name)}<span class="d">${dur(r.end - r.start)}</span></li>`).join("") || `<li class="none">予定なし</li>`}</ul>
          ${p.conflicts.length ? `<p class="warn">はみ出しあり</p>` : ""}
        </div></li>`;
    }).join("")}</ol>
    <section class="review">
      <h3>週の振り返り</h3>
      <p class="note">日曜の夜に。「来週変えること」は、来週の今日の画面に出ます。</p>
      ${reviewFields(ln.date)}
    </section>`;
  bindReview(ln.date);
  document.querySelectorAll("[data-day]").forEach((el) => (el.onclick = () => {
    const [y, m, d] = el.dataset.day.split("-").map(Number);
    viewDate = new Date(y, m - 1, d);
    tab = "today";
    render(true);
  }));
}

// ---- 設定の画面: 一覧は1行の要約、タップで編集パネル ----
// 「月–金 21:00・60分／土日 10:00・150分」のように、同じ時間の曜日をまとめて表す
function daysLabel(days) {
  const set = ORDER.filter((d) => days.includes(d));
  const key = set.join("");
  if (key === "1234560") return "毎日";
  if (key === "12345") return "平日";
  if (key === "60") return "土日";
  // 連続した曜日は「月–金」の形に
  const runs = [];
  for (const d of set) {
    const last = runs.at(-1);
    if (last && ORDER.indexOf(d) === ORDER.indexOf(last.at(-1)) + 1) last.push(d);
    else runs.push([d]);
  }
  return runs.map((r) => (r.length > 2 ? `${DOW[r[0]]}–${DOW[r.at(-1)]}` : r.map((d) => DOW[d]).join("・"))).join("・");
}
function groupSlots(slots) {
  const groups = {};
  for (const d of ORDER) {
    const sl = slots[d];
    if (!sl) continue;
    const k = `${sl.start}|${sl.min}`;
    (groups[k] ??= { start: sl.start, min: sl.min, days: [] }).days.push(d);
  }
  return Object.values(groups);
}
function workSummary() {
  const groups = {};
  const off = [];
  for (const d of ORDER) {
    const w = S().work[d];
    if (!w) { off.push(d); continue; }
    const k = `${w.start}|${w.end}`;
    (groups[k] ??= { w, days: [] }).days.push(d);
  }
  const parts = Object.values(groups).map((g) => `${daysLabel(g.days)} ${clock(toMin(g.w.start))}–${clock(toMin(g.w.end))}`);
  if (off.length) parts.push(`${daysLabel(off)} 休み`);
  return parts.join("／");
}

function renderSettings() {
  const st = S();
  const num = (key, label, unit, step = 5) => `<div class="row"><span class="lbl">${label}</span>
    <input type="number" inputmode="decimal" step="${step}" min="0" data-num="${key}" value="${st[key]}"><span class="unit">${unit}</span></div>`;
  $("#view").innerHTML = `
    <header class="head"><div><p class="date"><span class="dow">設定</span>逆算のもとになる時間</p></div></header>

    <section class="set"><h3>勤務</h3>
      <button class="summary" id="edit-work"><span>${esc(workSummary())}</span><em>変更</em></button>
    </section>

    <section class="set"><h3>ルーティーン</h3>
      ${st.routines.map((r, ri) => {
        const g = groupSlots(r.slots);
        return `<button class="summary routine" data-redit="${ri}">
          <strong>${esc(r.name)}</strong>
          <span>${g.length ? g.map((x) => `${daysLabel(x.days)} ${clock(toMin(x.start))}・${dur(x.min)}`).map(esc).join("／") : "曜日が未設定"}</span>
          <em>変更</em></button>`;
      }).join("")}
      <button class="add" id="radd">ルーティーンを追加</button>
    </section>

    <section class="set"><h3>生活の時間</h3>
      ${num("commuteMin", "通勤（片道）", "分")}${num("prepMin", "朝の支度", "分")}
      ${num("dinnerMin", "食事・入浴", "分")}${num("windDownMin", "寝る準備", "分")}
      ${num("sleepHours", "睡眠", "時間", 0.5)}
      <div class="row"><span class="lbl">休みの日の起床</span><input type="time" data-str="holidayWake" value="${st.holidayWake}"></div>
      <div class="row"><span class="lbl">休みの日の夕食</span><input type="time" data-str="holidayDinner" value="${st.holidayDinner}"></div>
      <p class="note">起床 ＝ 始業 − 通勤 − 支度　／　就寝 ＝ 翌朝の起床 − 睡眠</p>
    </section>

    <section class="set"><h3>表示</h3>
      <div class="row"><span class="lbl">夜の配色</span>
        <select data-str="night">
          <option value="system" ${st.night === "system" ? "selected" : ""}>端末に合わせる</option>
          <option value="auto" ${st.night === "auto" ? "selected" : ""}>寝る準備の1時間前から</option>
          <option value="off" ${st.night === "off" ? "selected" : ""}>いつも明るく</option>
        </select></div>
    </section>

    <section class="set"><h3>データ</h3>
      <p class="note">データはこのスマホの中だけにあります。週に1回、書き出しておくと安心です。</p>
      <div class="row two"><button id="export">書き出す</button><label class="btn">復元する<input type="file" id="import" accept="application/json" hidden></label></div>
    </section>`;

  document.querySelectorAll("[data-num]").forEach((el) => (el.onchange = () => {
    const v = parseFloat(el.value);
    const k = el.dataset.num;
    const [min, max] = k === "sleepHours" ? [3, 14] : [0, 600];
    if (isNaN(v) || v < min || v > max) { notice(k === "sleepHours" ? "睡眠は3〜14時間で設定してください" : "0〜600分で設定してください"); renderSettings(); return; }
    const before = st[k];
    st[k] = v;
    if (!wakeOk()) { st[k] = before; notice("起きる時刻が前の日になってしまいます。支度・通勤か始業を見直してください"); renderSettings(); return; }
    save();
    renderSettings();
  }));
  document.querySelectorAll("[data-str]").forEach((el) => (el.onchange = () => {
    if (el.value) st[el.dataset.str] = el.value;
    save();
    render();
  }));
  $("#edit-work").onclick = workSheet;
  document.querySelectorAll("[data-redit]").forEach((el) => (el.onclick = () => routineSheet(+el.dataset.redit)));
  $("#radd").onclick = () => {
    st.routines.push({ id: `r${Date.now()}`, name: "新しいルーティーン", slots: { 1: s("21:00", 30) } });
    save();
    routineSheet(st.routines.length - 1);
  };
  $("#export").onclick = exportData;
  $("#import").onchange = importData;
}

// 曜日を選ぶチップ
const dayChips = (sel) => `<div class="chips">${ORDER.map((d) => `<button class="daychip ${sel.includes(d) ? "on" : ""}" data-d="${d}">${DOW[d]}</button>`).join("")}</div>`;

// 勤務の編集: 曜日を選んで、共通の時刻を決める。曜日ごとの例外は下に並ぶ
function workSheet() {
  const st = S();
  const draw = () => {
    const on = ORDER.filter((d) => st.work[d]);
    openSheet(`
      <h2>勤務</h2>
      <p class="sheet-t">勤務のある曜日</p>
      ${dayChips(on)}
      <div class="slots">${ORDER.filter((d) => st.work[d]).map((d) => `
        <div class="row"><span class="dow">${DOW[d]}</span>
          <input type="time" data-w="${d}:start" value="${st.work[d].start}"><span class="to">–</span>
          <input type="time" data-w="${d}:end" value="${st.work[d].end}"></div>`).join("")}</div>
      <div class="sheet-actions"><button class="primary" data-act="close">完了</button></div>`, () => { save(); closeSheet(); render(); });
    document.querySelectorAll("#sheet .daychip").forEach((b) => (b.onclick = () => {
      const d = +b.dataset.d;
      const any = ORDER.map((x) => st.work[x]).find(Boolean) || weekday("09:00", "18:00");
      const before = st.work[d];
      st.work[d] = st.work[d] ? null : { ...any };
      if (!wakeOk()) { st.work[d] = before; notice("支度と通勤が長く、起きる時刻が前の日になってしまいます。先に生活の時間を見直してください"); return; }
      save();
      draw();
    }));
    document.querySelectorAll("#sheet [data-w]").forEach((el) => (el.onchange = () => {
      const [d, f] = el.dataset.w.split(":");
      const next = { ...st.work[d], [f]: el.value };
      if (!el.value || toMin(next.end) <= toMin(next.start)) {
        notice("終業は始業より後にしてください（日をまたぐ勤務にはまだ対応していません）");
        el.value = st.work[d][f];
        return;
      }
      const before = st.work[d];
      st.work[d] = next;
      if (!wakeOk()) { st.work[d] = before; el.value = before[f]; notice("始業が早すぎて、起きる時刻が前の日になってしまいます"); return; }
      save();
    }));
  };
  draw();
}

// ルーティーンの編集: 名前、曜日、曜日ごとの時刻と長さ
function routineSheet(ri) {
  const st = S();
  const r = st.routines[ri];
  const draw = () => {
    const days = ORDER.filter((d) => r.slots[d]);
    openSheet(`
      <input class="title-input" id="rname" value="${esc(r.name)}" aria-label="名前">
      <p class="sheet-t">する曜日</p>
      ${dayChips(days)}
      ${days.length > 1 ? `<button class="quiet align" id="copy-first">${DOW[days[0]]}の時間を、全部の曜日にそろえる</button>` : ""}
      <div class="slots">${days.map((d) => `
        <div class="row"><span class="dow">${DOW[d]}</span>
          <input type="time" data-sl="${d}:start" value="${r.slots[d].start}">
          <input type="number" step="5" min="5" max="720" data-sl="${d}:min" value="${r.slots[d].min}"><span class="unit">分</span></div>`).join("")}</div>
      <div class="sheet-actions">
        <button class="primary" data-act="close">完了</button>
        <button class="quiet danger" data-act="delete">このルーティーンを削除</button>
      </div>`, (act) => {
      if (act === "delete") {
        if (!confirmTwice(r.id)) return;
        st.routines.splice(ri, 1);
      }
      save(); closeSheet(); render();
    });
    $("#rname").onchange = () => { r.name = $("#rname").value.trim() || "名前なし"; save(); };
    document.querySelectorAll("#sheet .daychip").forEach((b) => (b.onclick = () => {
      const d = +b.dataset.d;
      const base = r.slots[ORDER.find((x) => r.slots[x])] || s("21:00", 30);
      if (r.slots[d]) delete r.slots[d];
      else r.slots[d] = { ...base };
      save();
      draw();
    }));
    document.querySelectorAll("#sheet [data-sl]").forEach((el) => (el.onchange = () => {
      const [d, f] = el.dataset.sl.split(":");
      if (f === "start" && el.value) r.slots[d].start = el.value;
      if (f === "min") r.slots[d].min = Math.min(720, Math.max(5, parseInt(el.value) || 5));
      save();
    }));
    $("#copy-first")?.addEventListener("click", () => {
      const first = r.slots[days[0]];
      days.forEach((d) => (r.slots[d] = { ...first }));
      save();
      draw();
    });
  };
  draw();
}
// 削除ボタンは2回押して確定(誤操作防止。確認ダイアログを使わない)
let armed = { id: null, at: 0 };
function confirmTwice(id) {
  if (armed.id === id && Date.now() - armed.at < 3000) { armed = { id: null, at: 0 }; return true; }
  armed = { id, at: Date.now() };
  notice("もう一度押すと削除します");
  return false;
}


// ---- 初回の案内: 勤務 → 支度・通勤 → 睡眠 → 逆算の確認 ----
let onbSkipped = false; // 「あとで」を押したら、このあいだは出さない
function onboarding(step = 1) {
  const st = S();
  const wd = ORDER.filter((d) => st.work[d]);
  const w0 = st.work[wd[0]] || weekday("09:00", "18:00");
  const skip = `<button class="quiet" data-act="later">あとで設定する</button>`;
  const dots = `<p class="steps">${[1, 2, 3, 4].map((i) => `<i class="${i === step ? "on" : ""}"></i>`).join("")}</p>`;
  const numRow = (key, label) => `<div class="stepper"><span class="lbl">${label}</span>
      <button data-step="${key}:-10">−10</button>
      <input type="number" inputmode="numeric" min="0" max="240" data-onum="${key}" value="${st[key]}"><span class="unit">分</span>
      <button data-step="${key}:10">＋10</button></div>`;
  const screens = {
    1: `<h2>いつ働いていますか</h2><p class="sheet-t">勤務のある曜日</p>${dayChips(wd)}
        <div class="row pair"><input type="time" id="o-start" value="${w0.start}"><span class="to">から</span><input type="time" id="o-end" value="${w0.end}"><span class="to">まで</span></div>
        <div class="sheet-actions"><button class="primary" data-act="next">次へ</button>${skip}</div>`,
    2: `<h2>朝の支度と、通勤の時間</h2><p class="sheet-t">起きる時刻を、始業から逆算します</p>
        ${numRow("prepMin", "支度")}${numRow("commuteMin", "通勤（片道）")}
        <div class="sheet-actions"><button class="primary" data-act="next">次へ</button><button class="quiet" data-act="back">戻る</button></div>`,
    3: `<h2>何時間眠りたいですか</h2>
        <div class="chips">${[6, 6.5, 7, 7.5, 8].map((h) => `<button class="daychip sleepchip ${st.sleepHours === h ? "on" : ""}" data-sleep="${h}">${h}</button>`).join("")}</div>
        <p class="sheet-t">単位は時間。あとで設定から変えられます</p>
        <div class="sheet-actions"><button class="primary" data-act="next">次へ</button><button class="quiet" data-act="back">戻る</button></div>`,
    4: (() => {
      const hasWork = wd.length > 0;
      const ws = hasWork ? toMin(w0.start) : null;
      const wake = hasWork ? ws - st.commuteMin - st.prepMin : toMin(st.holidayWake);
      const bed = wake + 1440 - Math.round(st.sleepHours * 60);
      return `<h2>${hasWork ? "勤務の日の目安" : "毎日の目安"}</h2>
        <div class="chain">
          <p><span class="t big">${clock(wake)}</span><span>に起きる</span></p>
          <p class="why">${hasWork ? `始業 ${clock(ws)} − 通勤 ${st.commuteMin}分 − 支度 ${st.prepMin}分` : "勤務なし。休みの日の起床時刻（設定で変更できます）"}</p>
          <p><span class="t big">${clock(bed)}</span><span>に寝る（前の夜）</span></p>
          <p class="why">起床 ${clock(wake)} − 睡眠 ${dur(Math.round(st.sleepHours * 60))}</p>
        </div>
        <p class="sheet-t">ルーティーン（${st.routines.map((r) => esc(r.name)).join("・")}）の曜日と時刻は仮に置いています。設定からいつでも直せます。</p>
        <div class="sheet-actions"><button class="primary" data-act="done">この設定ではじめる</button><button class="quiet" data-act="back">戻って調整</button></div>`;
    })(),
  };
  openSheet(dots + screens[step], (act) => {
    if (act === "later") { onbSkipped = true; closeSheet(); render(); return; }
    if (act === "back") return onboarding(step - 1);
    if (step === 1) {
      const start = $("#o-start").value, end = $("#o-end").value;
      if (!start || !end || toMin(end) <= toMin(start)) { notice("終業は始業より後にしてください"); return; }
      const before = JSON.stringify(st.work);
      for (const d of ORDER) if (st.work[d]) st.work[d] = { start, end };
      if (!wakeOk()) { st.work = JSON.parse(before); notice("始業が早すぎて、起きる時刻が前の日になってしまいます"); return; }
    }
    if (step === 2 && act === "next" && !wakeOk()) { notice("支度と通勤が長すぎて、起きる時刻が前の日になってしまいます"); return; }
    if (act === "next") { save(); return onboarding(step + 1); }
    if (act === "done") { state.onboarded = true; save(); closeSheet(); render(true); }
  });
  $("#sheet-backdrop").onclick = null; // 背景を押しても閉じない(途中で消えないように)
  document.querySelectorAll("#sheet .daychip[data-d]").forEach((b) => (b.onclick = () => {
    const d = +b.dataset.d;
    const before = st.work[d];
    st.work[d] = st.work[d] ? null : { ...w0 };
    if (!wakeOk()) { st.work[d] = before; notice("起きる時刻が前の日になってしまいます"); }
    onboarding(1);
  }));
  document.querySelectorAll("#sheet [data-step]").forEach((b) => (b.onclick = () => {
    const [k, v] = b.dataset.step.split(":");
    const before = st[k];
    st[k] = Math.min(240, Math.max(0, st[k] + Number(v)));
    if (!wakeOk()) { st[k] = before; notice("これ以上長いと、起きる時刻が前の日になってしまいます"); }
    onboarding(2);
  }));
  document.querySelectorAll("#sheet [data-onum]").forEach((el) => (el.onchange = () => {
    const v = parseInt(el.value);
    const k = el.dataset.onum, before = st[k];
    if (!isNaN(v) && v >= 0 && v <= 240) st[k] = v;
    if (!wakeOk()) { st[k] = before; el.value = before; notice("起きる時刻が前の日になってしまいます"); }
  }));
  document.querySelectorAll("#sheet [data-sleep]").forEach((b) => (b.onclick = () => { st.sleepHours = Number(b.dataset.sleep); onboarding(3); }));
}

// ---- 書き出し・復元 ----
async function exportData() {
  const name = `techo-backup-${dayKey(new Date())}.json`;
  const file = new File([JSON.stringify(state, null, 2)], name, { type: "application/json" });
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

// ---- 起動 ----
if (DEV && ["week", "settings"].includes(location.hash.slice(1))) tab = location.hash.slice(1);
if (NOSAVE && params.get("demo") === "conflict") state.settings.routines[0].slots[4] = s("22:30", 90);
if (NOSAVE && params.get("demo") === "carry") dayData(dayKey(logicalNow().date)).carry.push({ id: "study", name: "AI・プログラミング", min: 30 });
if (NOSAVE && params.get("demo") !== "onboarding") state.onboarded = true;
render(true);
if (!state.onboarded && !onbSkipped) onboarding(NOSAVE ? Number(params.get("step")) || 1 : 1);
if (NOSAVE && params.get("demo") === "work") workSheet();
if (NOSAVE && params.get("demo") === "routine") routineSheet(0);
save();
// 1分ごとに「いま」の線と次の予定を更新。アプリに戻ってきたときも更新
setInterval(() => { if (tab === "today" && !busy()) render(); }, 60000);
const busy = () => !$("#sheet").hidden || document.activeElement?.matches("textarea,input,select");
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !busy()) render(tab === "today"); });

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
