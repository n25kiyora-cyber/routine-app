// 手帳 v3 の画面。iPhone 標準アプリ(リマインダー・ヘルスケア・時計・設定)の見た目と操作にそろえる。
// データと計算は app.js。ここは「見せ方」と「操作」だけ。

// ---- アイコン(外部ファイルを使わず、線で描く) ----
const ICON = {
  today: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><circle cx="12" cy="14.5" r="1.6" class="fill"/></svg>',
  week: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="7" cy="6" r=".6" class="fill"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3 5.5 5.5"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" class="fill"/></svg>',
  alarm: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.6 1.8M4.5 5 7 2.8M19.5 5 17 2.8"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" class="chev"><path d="m9 5 7 7-7 7"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z"/></svg>',
  pencil: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16Z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 3.5 22 20H2Z"/><path d="M12 10v4.5M12 17.2v.3"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></svg>',
};
const colorOf = (r, i = 0) => (COLORS.includes(r && r.color) ? r.color : COLORS[i % COLORS.length]);
const routineById = (id) => S().routines.find((r) => r.id === id);

// ---- 画面の切り替え ----
let tab = "today";
let viewDate = null; // 週の画面から別の日を開いたとき
let mode = "list"; // 今日の画面: リスト / 時間
let workOpen = false; // 時間で見るとき、勤務の帯を広げるか
let weekOffset = 0; // 週の画面: 0 = 今週
document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => {
  tab = b.dataset.tab; viewDate = null; if (tab === "week") weekOffset = 0; render(true);
}));

function render(scrollTop = false) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  applyNight();
  if (tab === "today") renderToday();
  if (tab === "week") renderWeek();
  if (tab === "settings") renderSettings();
  if (scrollTop) window.scrollTo({ top: 0 });
}
function applyNight() {
  const m = S().night;
  const { date, min } = logicalNow();
  const night = m === "auto" && min >= planOf(date).windDown - 60;
  const force = ["day", "night"].includes(params.get("theme")) ? params.get("theme") : "";
  document.documentElement.dataset.theme = force || (m === "system" ? "" : night ? "night" : "day");
}

// ---- 今日の画面 ----
function renderToday() {
  const ln = logicalNow();
  const date = viewDate || ln.date;
  const isToday = dayKey(date) === dayKey(ln.date);
  const now = isToday ? ln.min : null;
  const p = planOf(date);
  const focus = lastWeekFocus(date);
  const title = isToday ? "今日" : `${date.getMonth() + 1}月${date.getDate()}日`;

  $("#view").innerHTML = `
    ${isToday ? "" : `<button class="backlink" id="back-today">${ICON.back}今日</button>`}
    <header class="lt"><h1>${title}</h1><p>${date.getMonth() + 1}月${date.getDate()}日 ${DOW_LONG[date.getDay()]}</p></header>
    ${state.onboarded ? "" : `<button class="card banner" id="setup"><span>勤務と睡眠を設定すると、あなたの時刻で逆算されます</span><b>設定する</b></button>`}
    ${isToday ? nowCard(p, now) : ""}
    ${sleepCard(p, now)}
    ${p.dd.must
      ? `<button class="card row-card" id="must"><span class="ic star">${ICON.star}</span><span class="txt"><small>今日いちばん大事なこと</small><b>${esc(p.dd.must)}</b></span></button>`
      : `<button class="card row-card ghost" id="must"><span class="ic star">${ICON.star}</span><span class="txt"><b>今日いちばん大事なことを決める</b></span><span class="plus">${ICON.plus}</span></button>`}
    ${focus ? `<p class="hint">今週変えること：${esc(focus)}</p>` : ""}
    ${conflictCard(p)}
    <div class="seg" role="tablist"><button data-mode="list" class="${mode === "list" ? "on" : ""}">リスト</button><button data-mode="time" class="${mode === "time" ? "on" : ""}">時間で見る</button></div>
    ${mode === "list" ? `<ul class="group list">${listRows(p, now)}</ul>` : `<section class="card timeline">${timeline(p, now)}</section>`}
    <ul class="group">
      <li><button class="row" id="note"><span class="ic pencil">${ICON.pencil}</span><span class="txt"><b>${p.dd.note ? esc(p.dd.note) : "今日できたことを一行"}</b>${p.dd.note ? "<small>今日できたこと</small>" : ""}</span>${ICON.chevron}</button></li>
    </ul>
    ${p.dd.note && (now === null || now >= p.windDown - 120) ? `<p class="greet">今日も、おつかれさま。</p>` : ""}`;

  $("#back-today")?.addEventListener("click", () => { viewDate = null; tab = "today"; render(true); });
  $("#setup")?.addEventListener("click", () => onboarding(1));
  $("#must").onclick = () => editText("今日いちばん大事なこと", "これだけはやる、を1つ", p.dd.must, (v) => (p.dd.must = v));
  $("#note").onclick = () => editText("今日できたこと", "小さなことでいい", p.dd.note, (v) => (p.dd.note = v));
  $("#sleep").onclick = () => sleepSheet();
  document.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => { mode = b.dataset.mode; render(); }));
  document.querySelectorAll("[data-check]").forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const id = b.dataset.check;
    p.dd.done[id] = !p.dd.done[id];
    save();
    b.closest(".row, .now")?.classList.toggle("done", !!p.dd.done[id]);
    b.classList.toggle("on", !!p.dd.done[id]);
    setTimeout(render, 380); // チェックの動きを見せてから並べ直す
  }));
  document.querySelectorAll("[data-item]").forEach((el) => (el.onclick = () => itemSheet(p, el.dataset.item)));
  $("#work-toggle")?.addEventListener("click", (e) => { e.stopPropagation(); workOpen = !workOpen; render(); });
  document.querySelectorAll("[data-fix]").forEach((el) => (el.onclick = () => {
    const [act, id] = el.dataset.fix.split(":");
    applyAction(p, id, act);
  }));
}

// 予定の色(ルーティーンは自分の色、寝る準備は藍、カレンダーはGoogleの青)
function tint(i) {
  if (i.kind === "routine") {
    const r = routineById(i.src || i.id);
    return `var(--c-${colorOf(r, S().routines.indexOf(r))})`;
  }
  if (i.kind === "rest") return "var(--c-indigo)";
  if (i.kind === "cal") return "var(--google)";
  return "var(--gray)";
}
const checkable = (i) => i.kind === "routine" || i.kind === "rest";

// いまやっていること、または次にやること
function nowCard(p, now) {
  const acts = p.items.filter((i) => ["routine", "rest", "cal", "work"].includes(i.kind) && !i.done);
  const cur = [...acts].reverse().find((i) => i.start <= now && now < i.end);
  if (cur) {
    const pct = Math.round(((now - cur.start) / (cur.end - cur.start)) * 100);
    return `<section class="card now" style="--rc:${tint(cur)}">
      <div class="head"><small>いま</small><span>${clock(cur.end)}まで</span></div>
      <div class="main"><b>${esc(cur.name)}</b>${checkable(cur) ? `<button class="check big" data-check="${cur.id}" aria-label="できた"></button>` : ""}</div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <p class="left">あと${dur(cur.end - now)}</p></section>`;
  }
  const nx = acts.find((i) => i.start > now);
  if (!nx || now >= p.bed) {
    return `<section class="card now rest"><div class="head"><small>今日はここまで</small></div><div class="main"><b>おやすみなさい</b></div></section>`;
  }
  const mins = nx.start - now;
  return `<section class="card now next" style="--rc:${tint(nx)}">
    <div class="head"><small>次</small><span>${mins <= 60 ? `あと${mins}分` : clock(nx.start)}</span></div>
    <div class="main"><b>${esc(nx.name)}</b></div>
    <p class="left">${clock(nx.start)}から ${dur(nx.end - nx.start)}</p></section>`;
}

// 睡眠(ヘルスケアの睡眠スケジュール風)
function sleepCard(p, now) {
  const tomorrow = addDays(p.date, 1);
  const toWind = now === null ? null : p.windDown - now;
  const note = toWind !== null && toWind > 0 && toWind <= 180 ? `寝る準備まであと${dur(toWind)}`
    : now !== null && now >= p.windDown && now < p.bed ? "寝る準備の時間です" : `寝る準備 ${clock(p.windDown)}から`;
  return `<button class="card sleep" id="sleep">
    <div class="pair">
      <div><span class="ic moon">${ICON.moon}</span><small>就寝</small><b>${clock(p.bed)}</b></div>
      <div><span class="ic alarm">${ICON.alarm}</span><small>起床・${DOW[tomorrow.getDay()]}曜</small><b>${clock(wakeOf(tomorrow))}</b></div>
    </div>
    <p class="foot"><span>${note}</span><span>睡眠 ${dur(Math.round(S().sleepHours * 60))}</span></p>
  </button>`;
}

function conflictCard(p) {
  if (!p.conflicts.length) return "";
  const c = [...p.conflicts].sort((a, b) => b.over - a.over)[0];
  const r = c.item;
  return `<section class="card warn">
    <p><span class="ic">${ICON.warn}</span><span><b>${esc(r.name)}</b>が「${esc(c.with.name)}」と${dur(c.over)}重なっています。睡眠は削らずに調整しましょう。</span></p>
    <div class="pills">
      ${r.end - r.start > 15 ? `<button data-fix="shorten:${r.id}">15分短く</button>` : ""}
      <button data-fix="carry:${r.id}">明日に回す</button>
      <button data-fix="skip:${r.id}">今日は見送る</button>
    </div></section>`;
}

// 予定のリスト(リマインダー風)。支度・通勤・食事は逆算にだけ使い、ここには出さない
function listRows(p, now) {
  const rows = p.items.filter((i) => ["routine", "rest", "cal", "work"].includes(i.kind));
  if (!rows.length) return `<li class="empty">予定はありません</li>`;
  return rows.map((i) => {
    const cur = now !== null && i.start <= now && now < i.end;
    const meta = i.kind === "work" ? `${clock(i.start)}–${clock(i.end)}`
      : i.kind === "cal" ? `${clock(i.start)}–${clock(i.end)}・Googleカレンダー`
      : `${clock(i.start)}・${dur(i.end - i.start)}${i.carried ? "・持ち越し" : ""}`;
    const over = p.conflicts.some((c) => c.item.id === i.id);
    return `<li class="row item ${i.done ? "done" : ""} ${cur ? "cur" : ""} ${i.kind}" style="--rc:${tint(i)}" ${checkable(i) || i.kind === "cal" ? `data-item="${i.id}"` : ""}>
      ${checkable(i) ? `<button class="check ${i.done ? "on" : ""}" data-check="${i.id}" aria-label="${i.done ? "未完了に戻す" : "できた"}"></button>` : `<span class="dot"></span>`}
      <span class="txt"><b>${esc(i.name)}</b><small>${meta}${over ? `<em>重なり</em>` : ""}</small></span>
      ${checkable(i) || i.kind === "cal" ? ICON.chevron : ""}
    </li>`;
  }).join("");
}

// ---- 予定の詳細パネル ----
function itemSheet(p, id) {
  const i = p.items.find((x) => x.id === id);
  if (!i) return;
  if (i.kind === "cal") {
    return openSheet(sheetHead(i.name, "", "閉じる") + `<p class="sheet-meta">${clock(i.start)}–${clock(i.end)}・Googleカレンダーの予定</p>
      <p class="sheet-note">この予定はGoogleカレンダーで変更してください。手帳は重なりを知らせます。</p>`, () => closeSheet());
  }
  const canShorten = i.kind === "routine" && i.end - i.start > 15;
  const done = !!p.dd.done[id]; // 丸チェック直後でも最新の状態を使う
  openSheet(sheetHead(i.name, "", "閉じる") + `
    <p class="sheet-meta">${clock(i.start)}–${clock(i.end)}（${dur(i.end - i.start)}）</p>
    <ul class="group in-sheet">
      <li><button class="row act" data-act="done"><span class="check ${done ? "on" : ""}" style="--rc:${tint(i)}"></span><b>${done ? "未完了に戻す" : "できた"}</b></button></li>
      ${canShorten ? `<li><button class="row act" data-act="shorten"><b>15分短くする</b></button></li>` : ""}
      ${i.kind === "routine" ? `<li><button class="row act" data-act="carry"><b>明日に回す</b></button></li><li><button class="row act red" data-act="skip"><b>今日は見送る</b></button></li>` : ""}
    </ul>`, (act) => (act === "right" ? closeSheet() : applyAction(p, id, act)));
}

// 予定の操作(完了・短く・見送る・明日に回す)
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
  save();
  closeSheet();
  render();
}

// ---- 下から出るパネル(iOSのシート) ----
// 見出しの行: [左のボタン] タイトル [右のボタン]
function sheetHead(title, left = "キャンセル", right = "保存") {
  return `<div class="sheet-bar">${left ? `<button data-act="left">${left}</button>` : "<span></span>"}<h2>${esc(title)}</h2>${right ? `<button data-act="right" class="strong">${right}</button>` : "<span></span>"}</div>`;
}
function openSheet(html, onAct) {
  const sh = $("#sheet");
  sh.innerHTML = `<div class="grab"></div>${html}`;
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
  openSheet(sheetHead(title) + `<textarea id="sheet-input" rows="3" placeholder="${esc(placeholder)}"></textarea>`, (act) => {
    if (act === "right") { set($("#sheet-input").value.trim()); save(); }
    closeSheet();
    render();
  });
  const input = $("#sheet-input");
  input.value = value || "";
  input.focus();
}

// ---- 時間で見る(縦の時間軸) ----
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
    if (now !== null && Math.abs(t - now) < 12) continue;
    ticks += `<span class="tick" style="top:${y(t)}px">${clock(t)}</span>`;
  }
  if (now !== null && now >= from && now <= to) ticks += `<span class="tick now-t" style="top:${y(now)}px">${clock(now)}</span>`;
  let prevTop = -Infinity, prevEnd = -Infinity;
  const blocks = p.items.filter((i) => i.kind !== "sleep").map((i) => {
    let top = y(i.start);
    const overlaps = i.kind !== "life" && i.kind !== "work" && i.start < prevEnd;
    if (overlaps && top < prevTop + 30) top = prevTop + 30;
    if (i.kind !== "life" && i.kind !== "work") { prevTop = top; prevEnd = Math.max(prevEnd, i.end); }
    return { ...i, top, stacked: overlaps };
  });
  const html = blocks.map((i) => {
    const h = i.stacked ? 28 : Math.max(24, y(i.end) - y(i.start) - 3);
    const tap = checkable(i) || i.kind === "cal";
    const fold = i.kind === "work" && work.end - work.start > 120 ? `<button class="fold" id="work-toggle">${folds.length ? "広げる" : "たたむ"}</button>` : "";
    return `<div class="blk ${i.kind} ${i.done ? "done" : ""} ${i.stacked ? "stacked" : ""}" style="top:${i.top}px;height:${h}px;--rc:${tint(i)}" ${tap ? `data-item="${i.id}"` : ""}>
      <span class="t">${i.kind === "work" ? `${clock(i.start)}–${clock(i.end)}` : clock(i.start)}</span><b>${esc(i.name)}</b>${fold}</div>`;
  }).join("");
  const sleep = `<div class="blk sleepb" style="top:${y(p.bed)}px;height:${Math.max(40, height - y(p.bed))}px"><span class="t">${clock(p.bed)}</span><b>睡眠</b></div>`;
  const nowLine = now !== null && now >= from && now <= to ? `<div class="nowline" style="top:${y(now)}px"></div>` : "";
  return `<div class="axis" style="height:${height}px">${ticks}</div><div class="lane" style="height:${height}px">${html}${sleep}${nowLine}</div>`;
}

// ---- 週の画面 ----
function mondayOf(date) {
  return addDays(date, -((date.getDay() + 6) % 7));
}
function lastWeekFocus(date) {
  return state.reviews[dayKey(addDays(mondayOf(date), -7))]?.next || "";
}
function renderWeek() {
  const ln = logicalNow();
  const mon = addDays(mondayOf(ln.date), weekOffset * 7);
  const days = [...Array(7)].map((_, i) => addDays(mon, i));
  const sun = days[6];
  $("#view").innerHTML = `
    <header class="lt"><h1>週</h1>
      <div class="weeknav"><button id="wprev" aria-label="前の週">${ICON.back}</button>
      <p>${mon.getMonth() + 1}月${mon.getDate()}日 – ${sun.getMonth() + 1}月${sun.getDate()}日</p>
      <button id="wnext" aria-label="次の週" class="flip">${ICON.back}</button></div></header>
    <ul class="group weeklist">${days.map((d) => {
      const p = planOf(d);
      const today = dayKey(d) === dayKey(ln.date);
      const rs = p.items.filter((i) => i.kind === "routine" || i.kind === "rest");
      const done = rs.filter((i) => i.done).length;
      const cals = p.items.filter((i) => i.kind === "cal").length;
      return `<li><button class="row day ${today ? "today" : ""} ${d < ln.date ? "past" : ""}" data-day="${dayKey(d)}">
        <span class="date"><small>${DOW[d.getDay()]}</small><b>${d.getDate()}</b></span>
        <span class="txt"><b>${clock(p.wake)} 起床 ・ ${clock(p.bed)} 就寝</b>
          <small>${p.items.filter((i) => i.kind === "routine").map((i) => `<i class="cdot" style="--rc:${tint(i)}"></i>${esc(i.name)}`).join("　") || "ルーティーンなし"}${cals ? `　<i class="cdot" style="--rc:var(--google)"></i>予定${cals}件` : ""}</small></span>
        <span class="count">${p.conflicts.length ? `<em>重なり</em>` : ""}${done}/${rs.length}</span>${ICON.chevron}
      </button></li>`;
    }).join("")}</ul>
    <ul class="group"><li><button class="row" id="review"><span class="ic pencil">${ICON.pencil}</span><span class="txt"><b>週の振り返り</b><small>${state.reviews[dayKey(mon)]?.next ? `来週変えること：${esc(state.reviews[dayKey(mon)].next)}` : "日曜の夜に。来週変えることを1つ決める"}</small></span>${ICON.chevron}</button></li></ul>`;
  $("#wprev").onclick = () => { weekOffset--; render(); };
  $("#wnext").onclick = () => { weekOffset++; render(); };
  $("#review").onclick = () => reviewSheet(dayKey(mon));
  document.querySelectorAll("[data-day]").forEach((el) => (el.onclick = () => {
    const [y, m, d] = el.dataset.day.split("-").map(Number);
    viewDate = new Date(y, m - 1, d);
    tab = "today";
    render(true);
  }));
}
function reviewSheet(wk) {
  const r = { ...state.reviews[wk] };
  const f = (id, label, ph) => `<label class="field"><span>${label}</span><textarea data-r="${id}" rows="2" placeholder="${ph}">${esc(r[id])}</textarea></label>`;
  openSheet(sheetHead("週の振り返り") + f("done", "できたこと", "") + f("why", "できなかった理由", "") + f("next", "来週変えること（1つだけ）", "来週の今日の画面に出ます"), (act) => {
    if (act === "right") {
      document.querySelectorAll("#sheet [data-r]").forEach((el) => (r[el.dataset.r] = el.value));
      state.reviews[wk] = r;
      save();
    }
    closeSheet();
    render();
  });
}

// ---- 設定の画面(iPhoneの設定アプリ風) ----
function daysLabel(days) {
  const set = ORDER.filter((d) => days.includes(d));
  const key = set.join("");
  if (key === "1234560") return "毎日";
  if (key === "12345") return "平日";
  if (key === "60") return "土日";
  if (!set.length) return "なし";
  return set.map((d) => DOW[d]).join("・");
}
function groupSlots(slots) {
  const groups = {};
  for (const d of ORDER) {
    const sl = slots[d];
    if (!sl) continue;
    const k = `${sl.start}|${sl.min}`;
    if (!groups[k]) groups[k] = { start: sl.start, min: sl.min, days: [] };
    groups[k].days.push(d);
  }
  return Object.values(groups);
}
const row = (id, label, value, icon = "") => `<li><button class="row" id="${id}">${icon}<span class="txt"><b>${label}</b></span><span class="val">${value}</span>${ICON.chevron}</button></li>`;

function renderSettings() {
  const st = S();
  const workDays = ORDER.filter((d) => st.work[d]);
  const times = [...new Set(workDays.map((d) => `${clock(toMin(st.work[d].start))}–${clock(toMin(st.work[d].end))}`))];
  const nightLabel = { system: "端末に合わせる", auto: "寝る準備の1時間前から", off: "いつも明るく" }[st.night];
  $("#view").innerHTML = `
    <header class="lt"><h1>設定</h1></header>
    <p class="sec">勤務</p>
    <ul class="group">
      ${row("set-work", "勤務する曜日と時間", workDays.length ? `${daysLabel(workDays)} ${times.length === 1 ? times[0] : "曜日で違う"}` : "なし")}
    </ul>
    <p class="sec">睡眠と生活</p>
    <ul class="group">
      ${row("v-sleepHours", "睡眠時間", dur(Math.round(st.sleepHours * 60)))}
      ${row("v-commuteMin", "通勤（片道）", dur(st.commuteMin))}
      ${row("v-prepMin", "朝の支度", dur(st.prepMin))}
      ${row("v-dinnerMin", "食事・入浴", dur(st.dinnerMin))}
      ${row("v-windDownMin", "寝る準備", dur(st.windDownMin))}
      ${row("v-holidayWake", "休みの日の起床", clock(toMin(st.holidayWake)))}
      ${row("v-holidayDinner", "休みの日の夕食", clock(toMin(st.holidayDinner)))}
    </ul>
    <p class="foot-note">起床 ＝ 始業 − 通勤 − 支度、就寝 ＝ 翌朝の起床 − 睡眠 で計算します。</p>
    <p class="sec">ルーティーン</p>
    <ul class="group">
      ${st.routines.map((r, i) => {
        const g = groupSlots(r.slots);
        return `<li><button class="row" data-r="${i}"><i class="cdot big" style="--rc:var(--c-${colorOf(r, i)})"></i><span class="txt"><b>${esc(r.name)}</b><small>${g.length ? g.map((x) => `${daysLabel(x.days)} ${clock(toMin(x.start))}・${dur(x.min)}`).join("／") : "曜日が未設定"}</small></span>${ICON.chevron}</button></li>`;
      }).join("")}
      <li><button class="row add" id="radd"><span class="ic plus">${ICON.plus}</span><span class="txt"><b>ルーティーンを追加</b></span></button></li>
    </ul>
    <p class="sec">Googleカレンダー</p>
    <ul class="group">
      ${row("set-cal", "連携", state.cal ? (calState.error ? `<em class="bad">エラー</em>` : "つながっています") : "未設定", `<span class="ic cal">${ICON.cal}</span>`)}
    </ul>
    <p class="sec">表示とデータ</p>
    <ul class="group">
      ${row("set-night", "夜の配色", nightLabel)}
      <li><button class="row" id="export"><span class="txt"><b class="blue">データを書き出す</b></span></button></li>
      <li><label class="row"><span class="txt"><b class="blue">書き出したデータから復元</b></span><input type="file" id="import" accept="application/json" hidden></label></li>
    </ul>
    <p class="foot-note">データはこのiPhoneの中だけにあります。週に1回、書き出しておくと安心です。</p>`;

  $("#set-work").onclick = workSheet;
  ["sleepHours", "commuteMin", "prepMin", "dinnerMin", "windDownMin", "holidayWake", "holidayDinner"].forEach((k) => ($(`#v-${k}`).onclick = () => valueSheet(k)));
  document.querySelectorAll("[data-r]").forEach((el) => (el.onclick = () => routineSheet(+el.dataset.r)));
  $("#radd").onclick = templateSheet;
  $("#set-cal").onclick = calSheet;
  $("#set-night").onclick = nightSheet;
  $("#export").onclick = exportData;
  $("#import").onchange = importData;
}

// 数字や時刻を1つ変えるパネル(取消/保存)
const VALUES = {
  sleepHours: { label: "睡眠時間", unit: "時間", step: 0.5, min: 3, max: 14 },
  commuteMin: { label: "通勤（片道）", unit: "分", step: 5, min: 0, max: 240 },
  prepMin: { label: "朝の支度", unit: "分", step: 5, min: 0, max: 240 },
  dinnerMin: { label: "食事・入浴", unit: "分", step: 10, min: 0, max: 300 },
  windDownMin: { label: "寝る準備", unit: "分", step: 10, min: 0, max: 240 },
  holidayWake: { label: "休みの日の起床", time: true },
  holidayDinner: { label: "休みの日の夕食", time: true },
};
function valueSheet(key) {
  const v = VALUES[key];
  let val = S()[key];
  const draw = () => {
    openSheet(sheetHead(v.label) + (v.time
      ? `<input type="time" class="big-time" id="vt" value="${val}">`
      : `<div class="stepper"><button data-s="-" aria-label="減らす">−</button><output id="vo">${key === "sleepHours" ? val : val}</output><span>${v.unit}</span><button data-s="+" aria-label="増やす">＋</button></div>
         <div class="chips">${(key === "sleepHours" ? [6, 6.5, 7, 7.5, 8] : key === "dinnerMin" || key === "windDownMin" ? [30, 60, 90, 120] : [15, 30, 45, 60, 90]).map((c) => `<button class="chip ${c === val ? "on" : ""}" data-c="${c}">${c}</button>`).join("")}</div>`), (act) => {
      if (act === "right") {
        const before = S()[key];
        S()[key] = v.time ? $("#vt").value || before : val;
        if (!wakeOk()) { S()[key] = before; return notice("起きる時刻が前の日になってしまいます。支度・通勤か始業を見直してください"); }
        save();
      }
      closeSheet();
      render();
    });
    document.querySelectorAll("#sheet [data-s]").forEach((b) => (b.onclick = () => {
      val = Math.min(v.max, Math.max(v.min, +(val + (b.dataset.s === "+" ? v.step : -v.step)).toFixed(1)));
      draw();
    }));
    document.querySelectorAll("#sheet [data-c]").forEach((b) => (b.onclick = () => { val = Number(b.dataset.c); draw(); }));
  };
  draw();
}

// 勤務: 曜日を選んで共通の時間。曜日ごとに変えたいときだけ一覧を出す
function workSheet() {
  const draft = JSON.parse(JSON.stringify(S().work));
  const first = () => ORDER.map((d) => draft[d]).find(Boolean) || weekday("09:00", "18:00");
  let perDay = new Set(ORDER.filter((d) => draft[d]).map((d) => `${draft[d].start}-${draft[d].end}`)).size > 1;
  const draw = () => {
    const on = ORDER.filter((d) => draft[d]);
    const f = first();
    openSheet(sheetHead("勤務") + `
      <p class="sheet-label">勤務する曜日</p>
      <div class="presets"><button data-p="12345">平日</button><button data-p="1234560">毎日</button><button data-p="">なし</button></div>
      ${dayToggles(on)}
      ${on.length && !perDay ? `<p class="sheet-label">時間</p><div class="pair-times"><input type="time" id="w-start" value="${f.start}"><span>から</span><input type="time" id="w-end" value="${f.end}"><span>まで</span></div>` : ""}
      ${on.length && perDay ? `<p class="sheet-label">曜日ごとの時間</p>${on.map((d) => `<div class="pair-times"><span class="d">${DOW[d]}</span><input type="time" data-w="${d}:start" value="${draft[d].start}"><span>–</span><input type="time" data-w="${d}:end" value="${draft[d].end}"></div>`).join("")}` : ""}
      ${on.length > 1 ? `<label class="toggle"><span>曜日ごとに時間を変える</span><input type="checkbox" id="perday" ${perDay ? "checked" : ""}><i></i></label>` : ""}`, (act) => {
      if (act === "right") {
        commitWorkTimes();
        for (const d of ORDER) if (draft[d] && toMin(draft[d].end) <= toMin(draft[d].start)) return notice("終業は始業より後にしてください");
        const before = S().work;
        S().work = draft;
        if (!wakeOk()) { S().work = before; return notice("始業が早すぎて、起きる時刻が前の日になってしまいます"); }
        save();
      }
      closeSheet();
      render();
    });
    const commitWorkTimes = () => {
      const s0 = $("#w-start"), e0 = $("#w-end");
      if (s0 && e0) for (const d of ORDER) if (draft[d]) draft[d] = { start: s0.value || draft[d].start, end: e0.value || draft[d].end };
      document.querySelectorAll("#sheet [data-w]").forEach((el) => { const [d, k] = el.dataset.w.split(":"); if (el.value) draft[d][k] = el.value; });
    };
    document.querySelectorAll("#sheet [data-day]").forEach((b) => (b.onclick = () => { commitWorkTimes(); const d = +b.dataset.day; draft[d] = draft[d] ? null : { ...first() }; draw(); }));
    document.querySelectorAll("#sheet [data-p]").forEach((b) => (b.onclick = () => {
      commitWorkTimes(); const f2 = first();
      for (const d of ORDER) draft[d] = b.dataset.p.includes(String(d)) ? { ...(draft[d] || f2) } : null;
      draw();
    }));
    $("#perday")?.addEventListener("change", (e) => { commitWorkTimes(); perDay = e.target.checked; draw(); });
  };
  draw();
}
const dayToggles = (on) => `<div class="days">${ORDER.map((d) => `<button class="${on.includes(d) ? "on" : ""}" data-day="${d}">${DOW[d]}</button>`).join("")}</div>`;

// ルーティーンを追加: よく使うものから選ぶ
const TEMPLATES = [
  { name: "副業", min: 60, start: "21:00", days: [1, 2, 3, 4, 5], color: "blue" },
  { name: "勉強", min: 30, start: "22:00", days: [1, 2, 3, 4, 5], color: "indigo" },
  { name: "運動", min: 30, start: "20:00", days: [2, 4, 6], color: "green" },
  { name: "読書", min: 15, start: "23:00", days: [1, 2, 3, 4, 5, 6, 0], color: "orange" },
  { name: "瞑想", min: 10, start: "07:00", days: [1, 2, 3, 4, 5, 6, 0], color: "teal" },
  { name: "日記", min: 10, start: "23:15", days: [1, 2, 3, 4, 5, 6, 0], color: "pink" },
];
function templateSheet() {
  openSheet(sheetHead("ルーティーンを追加", "キャンセル", "") + `
    <ul class="group in-sheet">${TEMPLATES.map((t, i) => `<li><button class="row" data-t="${i}"><i class="cdot big" style="--rc:var(--c-${t.color})"></i><span class="txt"><b>${t.name}</b><small>${daysLabel(t.days)} ${clock(toMin(t.start))}・${dur(t.min)}</small></span>${ICON.chevron}</button></li>`).join("")}
      <li><button class="row" data-t="new"><span class="ic plus">${ICON.plus}</span><span class="txt"><b>自分で作る</b></span>${ICON.chevron}</button></li></ul>`, () => closeSheet());
  document.querySelectorAll("#sheet [data-t]").forEach((b) => (b.onclick = () => {
    const t = b.dataset.t === "new" ? { name: "", min: 30, start: "21:00", days: [1, 2, 3, 4, 5], color: COLORS[S().routines.length % COLORS.length] } : TEMPLATES[+b.dataset.t];
    const slots = {};
    t.days.forEach((d) => (slots[d] = s(t.start, t.min)));
    routineSheet(-1, { id: `r${Date.now()}`, name: t.name, color: t.color, slots });
  }));
}

// ルーティーンの編集(時計アプリのアラーム編集風): 名前・時刻・長さ・繰り返し・色
function routineSheet(ri, fresh) {
  const isNew = ri < 0;
  const draft = JSON.parse(JSON.stringify(isNew ? fresh : S().routines[ri]));
  if (!COLORS.includes(draft.color)) draft.color = colorOf(draft, Math.max(0, ri));
  const daysOn = () => ORDER.filter((d) => draft.slots[d]);
  let common = { ...(draft.slots[ORDER.find((d) => draft.slots[d])] || s("21:00", 30)) }; // 曜日が0個の間も時刻・長さを覚えておく
  const base = () => draft.slots[daysOn()[0]] || common;
  let perDay = new Set(daysOn().map((d) => `${draft.slots[d].start}|${draft.slots[d].min}`)).size > 1;
  const draw = () => {
    const on = daysOn();
    const b0 = base();
    openSheet(sheetHead(isNew ? "新しいルーティーン" : "ルーティーンを編集") + `
      <input class="name-input" id="rname" placeholder="名前（例：副業）" maxlength="40">
      ${!perDay ? `<input type="time" class="big-time" id="rtime" value="${b0.start}">
        <p class="sheet-label">長さ</p>
        <div class="chips">${[10, 15, 30, 45, 60, 90, 120].map((m) => `<button class="chip ${b0.min === m ? "on" : ""}" data-min="${m}">${m < 60 ? `${m}分` : `${m / 60}時間`.replace("1.5時間", "1時間半")}</button>`).join("")}</div>` : ""}
      <p class="sheet-label">繰り返し</p>
      <div class="presets"><button data-p="1234560">毎日</button><button data-p="12345">平日</button><button data-p="60">土日</button></div>
      ${dayToggles(on)}
      ${perDay ? `<p class="sheet-label">曜日ごとの時間</p>${on.map((d) => `<div class="pair-times"><span class="d">${DOW[d]}</span><input type="time" data-sl="${d}:start" value="${draft.slots[d].start}"><input type="number" min="5" max="720" step="5" data-sl="${d}:min" value="${draft.slots[d].min}"><span>分</span></div>`).join("")}` : ""}
      ${on.length > 1 ? `<label class="toggle"><span>曜日ごとに時間を変える</span><input type="checkbox" id="perday" ${perDay ? "checked" : ""}><i></i></label>` : ""}
      <p class="sheet-label">色</p>
      <div class="swatches">${COLORS.map((c) => `<button class="sw ${draft.color === c ? "on" : ""}" data-color="${c}" style="--rc:var(--c-${c})" aria-label="${c}"></button>`).join("")}</div>
      ${isNew ? "" : `<button class="danger" data-act="delete">このルーティーンを削除</button>`}`, (act) => {
      collect();
      if (act === "delete") {
        if (!confirmTwice(draft.id)) return;
        S().routines.splice(ri, 1);
        save(); closeSheet(); return render();
      }
      if (act === "right") {
        if (!draft.name.trim()) return notice("名前を入れてください");
        if (!daysOn().length) return notice("曜日を1つ以上選んでください");
        draft.name = draft.name.trim();
        if (isNew) S().routines.push(draft); else S().routines[ri] = draft;
        save();
      }
      closeSheet();
      render();
    });
    $("#rname").value = draft.name;
    $("#rname").oninput = (e) => (draft.name = e.target.value);
    document.querySelectorAll("#sheet [data-min]").forEach((b) => (b.onclick = () => { collect(); setAll({ min: +b.dataset.min }); draw(); }));
    document.querySelectorAll("#sheet [data-day]").forEach((b) => (b.onclick = () => {
      collect(); const d = +b.dataset.day;
      if (draft.slots[d]) delete draft.slots[d]; else draft.slots[d] = { ...base() };
      draw();
    }));
    document.querySelectorAll("#sheet [data-p]").forEach((b) => (b.onclick = () => {
      collect(); const b1 = { ...base() };
      for (const d of ORDER) { if (b.dataset.p.includes(String(d))) draft.slots[d] = draft.slots[d] || { ...b1 }; else delete draft.slots[d]; }
      draw();
    }));
    document.querySelectorAll("#sheet [data-color]").forEach((b) => (b.onclick = () => { collect(); draft.color = b.dataset.color; draw(); }));
    $("#perday")?.addEventListener("change", (e) => { collect(); perDay = e.target.checked; if (!perDay) setAll({ ...base() }); draw(); });
  };
  const setAll = (patch) => { common = { ...common, ...patch }; daysOn().forEach((d) => (draft.slots[d] = { ...draft.slots[d], ...patch })); };
  const collect = () => {
    const t = $("#rtime");
    if (t && t.value) setAll({ start: t.value });
    document.querySelectorAll("#sheet [data-sl]").forEach((el) => {
      const [d, k] = el.dataset.sl.split(":");
      if (k === "start" && el.value) draft.slots[d].start = el.value;
      if (k === "min") draft.slots[d].min = Math.min(720, Math.max(5, parseInt(el.value) || 5));
    });
  };
  draw();
}

function nightSheet() {
  const opts = { system: "端末に合わせる", auto: "寝る準備の1時間前から暗く", off: "いつも明るく" };
  openSheet(sheetHead("夜の配色", "", "閉じる") + `<ul class="group in-sheet">${Object.entries(opts).map(([k, v]) => `<li><button class="row" data-n="${k}"><span class="txt"><b>${v}</b></span>${S().night === k ? '<span class="tick-mark">✓</span>' : ""}</button></li>`).join("")}</ul>`, () => closeSheet());
  document.querySelectorAll("#sheet [data-n]").forEach((b) => (b.onclick = () => { S().night = b.dataset.n; save(); closeSheet(); render(); }));
}

// Googleカレンダー: 「接続コード」(住所#合言葉)を1つ貼るだけ
function calSheet() {
  openSheet(sheetHead("Googleカレンダー", "", "閉じる") + `
    <p class="sheet-note">GASで「connectCode」を実行すると表示される<b>接続コード</b>を貼り付けてください。ルーティーン・寝る準備・就寝が「手帳」カレンダーに入り、あなたの予定がこのアプリに出ます。接続コードは人に見せないでください。</p>
    <textarea id="code" rows="3" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://script.google.com/macros/s/…/exec#…"></textarea>
    <button class="primary" id="connect">${state.cal ? "つなぎ直す" : "つなぐ"}</button>
    <p class="sheet-note" id="calmsg">${state.cal ? (calState.error ? `前回の取得に失敗：${esc(calErrorText(calState.error))}` : calState.at ? `予定を取得：${new Date(calState.at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}` : "つながっています") : "まだつながっていません"}</p>
    ${state.cal ? `<button class="danger" id="caloff">連携をやめる</button>` : ""}`, () => closeSheet());
  $("#connect").onclick = async () => {
    const btn = $("#connect");
    if (btn.disabled) return;
    const raw = $("#code").value.trim();
    const [url, key] = raw.split("#");
    if (!GAS_URL.test(url || "")) return ($("#calmsg").textContent = "接続コードの形が違います（https://script.google.com/…/exec#… の形）");
    if (!key || key.length < 20) return ($("#calmsg").textContent = "接続コードの「#」の後ろ(合言葉)がありません");
    const before = state.cal;
    state.cal = { url, key };
    btn.disabled = true;
    $("#calmsg").textContent = "確かめています…";
    const stillOpen = () => $("#connect") === btn && !$("#sheet").hidden;
    try {
      await gas("ping");
      state.calPushed = "";
      save(); // 設定をカレンダーへ送る
      await refreshEvents();
      notice(calState.error ? "つながりました（予定の取得は失敗：" + calErrorText(calState.error) + "）" : "つながりました");
      if (stillOpen()) closeSheet();
      render();
    } catch (e) {
      state.cal = before;
      if (stillOpen()) { btn.disabled = false; $("#calmsg").textContent = calErrorText(e.message); }
    }
  };
  $("#caloff")?.addEventListener("click", () => {
    if (!confirmTwice("cal-off")) return;
    state.cal = undefined;
    calEvents = [];
    try { localStorage.removeItem(CAL_CACHE); } catch {}
    save();
    notice("連携をやめました（「手帳」カレンダーの予定は残ります）");
    closeSheet();
    render();
  });
}

// 睡眠のカードを押したとき: 睡眠に関わる数字をまとめて見せる
function sleepSheet() {
  const st = S();
  openSheet(sheetHead("睡眠のスケジュール", "", "閉じる") + `
    <p class="sheet-note">起きる時刻は始業から、寝る時刻は翌朝の起床から逆算しています。</p>
    <ul class="group in-sheet">
      ${row("s-sleep", "睡眠時間", dur(Math.round(st.sleepHours * 60)))}
      ${row("s-wind", "寝る準備", dur(st.windDownMin))}
      ${row("s-prep", "朝の支度", dur(st.prepMin))}
      ${row("s-commute", "通勤（片道）", dur(st.commuteMin))}
      ${row("s-hw", "休みの日の起床", clock(toMin(st.holidayWake)))}
    </ul>`, () => closeSheet());
  $("#s-sleep").onclick = () => valueSheet("sleepHours");
  $("#s-wind").onclick = () => valueSheet("windDownMin");
  $("#s-prep").onclick = () => valueSheet("prepMin");
  $("#s-commute").onclick = () => valueSheet("commuteMin");
  $("#s-hw").onclick = () => valueSheet("holidayWake");
}

// ---- 初回の案内: 勤務 → 支度・通勤 → 睡眠 → 目安 ----
let onbSkipped = false;
function onboarding(step = 1) {
  const st = S();
  const wd = ORDER.filter((d) => st.work[d]);
  const w0 = st.work[wd[0]] || weekday("09:00", "18:00");
  const dots = `<div class="steps">${[1, 2, 3, 4].map((i) => `<i class="${i <= step ? "on" : ""}"></i>`).join("")}</div>`;
  const stepper = (key, label) => `<div class="row-step"><b>${label}</b><button data-step="${key}:-10">−</button><output>${st[key]}分</output><button data-step="${key}:10">＋</button></div>`;
  const screens = {
    1: `<h2 class="onb-t">いつ働いていますか</h2>${dayToggles(wd)}
        <div class="pair-times"><input type="time" id="o-start" value="${w0.start}"><span>から</span><input type="time" id="o-end" value="${w0.end}"><span>まで</span></div>`,
    2: `<h2 class="onb-t">朝の支度と通勤</h2><p class="sheet-note">起きる時刻を、始業から逆算します。</p>${stepper("prepMin", "支度")}${stepper("commuteMin", "通勤（片道）")}`,
    3: `<h2 class="onb-t">何時間眠りたいですか</h2><div class="chips">${[6, 6.5, 7, 7.5, 8].map((h) => `<button class="chip ${st.sleepHours === h ? "on" : ""}" data-sleep="${h}">${h}時間</button>`).join("")}</div>`,
    4: (() => {
      const has = wd.length > 0;
      const wake = has ? toMin(w0.start) - st.commuteMin - st.prepMin : toMin(st.holidayWake);
      const bed = wake + 1440 - Math.round(st.sleepHours * 60);
      return `<h2 class="onb-t">${has ? "勤務の日の目安" : "毎日の目安"}</h2>
        <div class="card sleep flat"><div class="pair">
          <div><span class="ic moon">${ICON.moon}</span><small>前の夜に寝る</small><b>${clock(bed)}</b></div>
          <div><span class="ic alarm">${ICON.alarm}</span><small>起きる</small><b>${clock(wake)}</b></div></div></div>
        <p class="sheet-note">${has ? `始業 ${clock(toMin(w0.start))} − 通勤 ${st.commuteMin}分 − 支度 ${st.prepMin}分 ＝ 起床。` : "勤務なし。休みの日の起床時刻で計算します。"}ルーティーン（${st.routines.map((r) => esc(r.name)).join("・")}）の時刻は仮です。設定から直せます。</p>`;
    })(),
  };
  const nav = `<div class="onb-nav">${step > 1 ? `<button data-act="back" class="plain">戻る</button>` : `<button data-act="later" class="plain">あとで</button>`}<button data-act="${step === 4 ? "done" : "next"}" class="primary">${step === 4 ? "はじめる" : "次へ"}</button></div>`;
  openSheet(dots + screens[step] + nav, (act) => {
    if (act === "later") { onbSkipped = true; closeSheet(); render(); return; }
    if (act === "back") return onboarding(step - 1);
    if (step === 1) {
      const start = $("#o-start").value, end = $("#o-end").value;
      if (!start || !end || toMin(end) <= toMin(start)) return notice("終業は始業より後にしてください");
      const before = JSON.stringify(st.work);
      for (const d of ORDER) if (st.work[d]) st.work[d] = { start, end };
      if (!wakeOk()) { st.work = JSON.parse(before); return notice("始業が早すぎて、起きる時刻が前の日になってしまいます"); }
    }
    if (act === "next") { save(); return onboarding(step + 1); }
    if (act === "done") { state.onboarded = true; save(); closeSheet(); render(true); }
  });
  $("#sheet-backdrop").onclick = null; // 途中で消えないように
  document.querySelectorAll("#sheet [data-day]").forEach((b) => (b.onclick = () => {
    const d = +b.dataset.day;
    const start = $("#o-start").value, end = $("#o-end").value;
    const cur = start && end && toMin(end) > toMin(start) ? { start, end } : w0; // 入力中の時間を消さない
    const before = JSON.stringify(st.work);
    for (const x of ORDER) if (st.work[x]) st.work[x] = { ...cur };
    st.work[d] = st.work[d] ? null : { ...cur };
    if (!wakeOk()) { st.work = JSON.parse(before); notice("起きる時刻が前の日になってしまいます"); }
    onboarding(1);
  }));
  document.querySelectorAll("#sheet [data-step]").forEach((b) => (b.onclick = () => {
    const [k, v] = b.dataset.step.split(":");
    const before = st[k];
    st[k] = Math.min(240, Math.max(0, st[k] + Number(v)));
    if (!wakeOk()) { st[k] = before; notice("これ以上長いと、起きる時刻が前の日になってしまいます"); }
    onboarding(2);
  }));
  document.querySelectorAll("#sheet [data-sleep]").forEach((b) => (b.onclick = () => { st.sleepHours = Number(b.dataset.sleep); onboarding(3); }));
}

// ---- 起動 ----
if (DEV && ["week", "settings"].includes(location.hash.slice(1))) tab = location.hash.slice(1);
if (NOSAVE && params.get("demo") === "conflict") state.settings.routines[0].slots[4] = s("22:30", 90);
if (NOSAVE && params.get("demo") === "carry") dayData(dayKey(logicalNow().date)).carry.push({ id: "study", name: "AI・プログラミング", min: 30 });
if (NOSAVE && params.get("demo") !== "onboarding") state.onboarded = true;
if (NOSAVE && params.get("mode") === "time") mode = "time";
if (NOSAVE && params.get("done") === "1") dayData(dayKey(logicalNow().date)).done.move = true;
render(true);
if (!state.onboarded && !onbSkipped) onboarding(NOSAVE ? Number(params.get("step")) || 1 : 1);
if (NOSAVE && params.get("demo") === "work") workSheet();
if (NOSAVE && params.get("demo") === "routine") routineSheet(0);
if (NOSAVE && params.get("demo") === "template") templateSheet();
if (NOSAVE && params.get("demo") === "calsheet") calSheet();
save();

// カレンダーの予定: 起動時・アプリに戻ったとき・15分ごとに取り直す
refreshEvents();
setInterval(refreshEvents, 15 * 60000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshEvents(); });

// 1分ごとに「いま」を更新。入力中・パネル表示中は止める
const busy = () => !$("#sheet").hidden || document.activeElement?.matches("textarea,input,select");
setInterval(() => { if (tab === "today" && !busy()) render(); }, 60000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !busy()) render(); });

if ("serviceWorker" in navigator) {
  // 新しい版が届いたら、1回だけ読み込み直して切り替える
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController && !reloaded) { reloaded = true; location.reload(); }
  });
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
