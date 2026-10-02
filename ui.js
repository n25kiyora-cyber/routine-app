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
  book: '<svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>',
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
const fold = {}; // 今日の画面: たたんだ部分を開いているか
let weekOffset = 0; // 週の画面: 0 = 今週
document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => {
  tab = b.dataset.tab; viewDate = null; if (tab === "week") weekOffset = 0; render(true);
}));

// 今日の画面で日付を前後に動かす(左スワイプ=次の日、右スワイプ=前の日)
function shiftDay(n) {
  const ln = logicalNow();
  const next = addDays(viewDate || ln.date, n);
  viewDate = dayKey(next) === dayKey(ln.date) ? null : next;
  const v = $("#view");
  v.classList.remove("slide-l", "slide-r");
  void v.offsetWidth;
  render(true);
  v.classList.add(n > 0 ? "slide-l" : "slide-r");
}
(() => {
  let sx = 0, sy = 0, st = 0, ok = false;
  const v = document.getElementById("view");
  v.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    // 時間表示のドラッグ・入力欄・シートからは始めない。画面の端(iOSの戻る操作)も避ける
    ok = tab === "today" && e.touches.length === 1 && !e.target.closest(".blk[data-drag], input, textarea, .seg") && t.clientX > 24 && t.clientX < innerWidth - 24;
    sx = t.clientX; sy = t.clientY; st = Date.now();
  }, { passive: true });
  v.addEventListener("touchend", (e) => {
    if (!ok || !$("#sheet").hidden || document.querySelector(".blk.dragging")) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8 && Date.now() - st < 700) shiftDay(dx < 0 ? 1 : -1);
  }, { passive: true });
})();

function render(scrollTop = false) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  applyNight();
  fab(null);
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
  const diff = Math.round((date - ln.date) / 86400000);
  const title = isToday ? "今日" : diff === 1 ? "明日" : diff === -1 ? "昨日" : `${date.getMonth() + 1}月${date.getDate()}日`;

  // 今の時間帯のルーティンを上に、もう片方はたたむ(終わったものもたたむ)
  const first = isToday && now >= 720 ? "night" : "morning";
  const second = first === "morning" ? "night" : "morning";
  const firstDone = clDone(p, first);
  $("#view").innerHTML = `
    ${isToday ? "" : `<button class="backlink" id="back-today">${ICON.back}今日</button>`}
    <header class="lt"><h1>${title}</h1>
      <div class="daynav"><button id="dprev" aria-label="前の日">${ICON.back}</button><p>${date.getMonth() + 1}月${date.getDate()}日 ${DOW_LONG[date.getDay()]}</p><button id="dnext" class="flip" aria-label="次の日">${ICON.back}</button>${p.dd.rest ? "" : `<button class="rest-pill" id="rest">お休みにする</button>`}</div></header>
    ${p.dd.rest ? `<section class="card restday"><div><b>${isToday ? "今日" : "この日"}はお休み</b><small>副業などのルーティーンは出していません。ゆっくりどうぞ。</small></div><button id="rest">元に戻す</button></section>` : ""}
    ${state.onboarded ? "" : `<button class="card banner" id="setup"><span>勤務と睡眠を設定すると、あなたの時刻で逆算されます</span><b>設定する</b></button>`}
    ${isToday ? nowCard(p, now) : ""}
    ${p.dd.must
      ? `<button class="card row-card" id="must"><span class="ic star">${ICON.star}</span><span class="txt"><small>今日いちばん大事なこと</small><b>${esc(p.dd.must)}</b></span></button>`
      : `<button class="card row-card ghost" id="must"><span class="ic star">${ICON.star}</span><span class="txt"><b>今日いちばん大事なことを決める</b></span><span class="plus">${ICON.plus}</span></button>`}
    ${focus ? `<p class="hint">今週変えること：${esc(focus)}</p>` : ""}
    ${conflictCard(p)}
    ${firstDone ? "" : checklist(p, first, fold[first] ?? true)}
    <div class="seg" role="tablist"><button data-mode="list" class="${mode === "list" ? "on" : ""}">リスト</button><button data-mode="time" class="${mode === "time" ? "on" : ""}">時間で見る</button><button data-mode="pie" class="${mode === "pie" ? "on" : ""}">円で見る</button></div>
    ${mode === "list" ? listRows(p, now) : mode === "pie" ? `<section class="card pie">${dayPie(p, now)}</section>` : `<section class="card timeline">${timeline(p, now)}</section><p class="hint">予定を長押ししてドラッグすると、時刻を動かせます</p>`}
    ${skippedRow(p)}
    <p class="sec">そのほか</p>
    ${firstDone ? checklist(p, first, fold[first] ?? false) : ""}
    ${checklist(p, second, fold[second] ?? false)}
    ${readsBlock(p)}
    <ul class="group">
      ${sleepRow(p, now)}
      <li><button class="row" id="note"><span class="ic pencil">${ICON.pencil}</span><span class="txt"><b>${p.dd.note ? esc(p.dd.note) : "今日できたことを一行"}</b>${p.dd.note ? "<small>今日できたこと</small>" : ""}</span>${ICON.chevron}</button></li>
    </ul>
    ${p.dd.note && (now === null || now >= p.windDown - 120) ? `<p class="greet">今日も、おつかれさま。</p>` : ""}`;
  fab(`${isToday ? "今日" : `${date.getMonth() + 1}/${date.getDate()}`}のタスクを追加`, () => taskSheet(p));

  $("#back-today")?.addEventListener("click", () => { viewDate = null; tab = "today"; render(true); });
  $("#dprev").onclick = () => shiftDay(-1);
  $("#dnext").onclick = () => shiftDay(1);
  $("#setup")?.addEventListener("click", () => onboarding(1));
  $("#rest").onclick = () => { const dd = dayData(dayKey(date)); dd.rest = !dd.rest; if (!save()) return render(); notice(dd.rest ? "お休みにしました" : "元に戻しました"); render(); };
  $("#must").onclick = () => editText("今日いちばん大事なこと", "これだけはやる、を1つ", p.dd.must, (v) => (p.dd.must = v));
  $("#note").onclick = () => editText("今日できたこと", "小さなことでいい", p.dd.note, (v) => (p.dd.note = v));
  $("#sleep").onclick = () => sleepSheet();
  document.querySelectorAll("[data-cl-check]").forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const id = b.dataset.clCheck;
    p.dd.chk[id] = !p.dd.chk[id];
    save();
    b.classList.toggle("on", !!p.dd.chk[id]);
    b.closest(".row")?.classList.toggle("done", !!p.dd.chk[id]);
    setTimeout(render, 380);
  }));
  document.querySelectorAll("[data-unskip]").forEach((b) => (b.onclick = () => { delete p.dd.skip[b.dataset.unskip]; save(); render(); }));
  document.querySelectorAll("[data-cl-start]").forEach((b) => (b.onclick = () => runTimer(p, b.dataset.clStart)));
  document.querySelectorAll("[data-cl-edit]").forEach((el) => (el.onclick = (e) => { e.stopPropagation(); const [k, id] = el.dataset.clEdit.split(":"); checklistSheet(k, id); }));
  document.querySelectorAll("[data-tap]").forEach((el) => (el.onclick = () => { if (Date.now() - dragEndedAt < 400) return; el.querySelector("[data-check], [data-cl-check]")?.click(); }));
  document.querySelectorAll("[data-fold]").forEach((el) => (el.onclick = () => { fold[el.dataset.fold] = el.dataset.open !== "1"; render(); }));
  document.querySelectorAll("[data-read]").forEach((el) => (el.onclick = () => readSheet(p, el.dataset.read)));
  $("#readadd").onclick = () => readSheet(p);
  document.querySelectorAll("[data-cl-add]").forEach((el) => (el.onclick = () => checklistSheet(el.dataset.clAdd)));
  enableDrag(p);
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
  document.querySelectorAll("[data-item]").forEach((el) => (el.onclick = (e) => { e.stopPropagation(); if (Date.now() - dragEndedAt < 400) return; itemSheet(p, el.dataset.item); }));
  $("#work-toggle")?.addEventListener("click", (e) => { e.stopPropagation(); workOpen = !workOpen; render(); });
  document.querySelectorAll("[data-fix]").forEach((el) => (el.onclick = () => {
    const [act, id] = el.dataset.fix.split(":");
    applyAction(p, id, act);
  }));
}

// 予定の色(ルーティーンは自分の色、寝る準備は藍、カレンダーはGoogleの青)
function tint(i) {
  if (i.kind === "routine") {
    const r = i.task ? null : routineById(i.src || i.id);
    return r ? `var(--c-${colorOf(r, S().routines.indexOf(r))})` : "var(--c-teal)";
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

// 睡眠は1行だけ(押すと設定)
function sleepRow(p, now) {
  const tomorrow = addDays(p.date, 1);
  const toWind = now === null ? null : p.windDown - now;
  const note = toWind !== null && toWind > 0 && toWind <= 180 ? `寝る準備まであと${dur(toWind)}`
    : now !== null && now >= p.windDown && now < p.bed ? "寝る準備の時間です" : `寝る準備 ${clock(p.windDown)}から`;
  return `<li><button class="row" id="sleep"><span class="ic moon">${ICON.moon}</span><span class="txt"><b>就寝 ${clock(p.bed)}・起床 ${clock(wakeOf(tomorrow))}</b><small>${note}</small></span>${ICON.chevron}</button></li>`;
}

// 画面の下に固定する追加ボタン(親指が届く位置)
function fab(label, fn) {
  let b = document.getElementById("addtask");
  if (!label) { if (b) b.hidden = true; return; }
  if (!b) { b = document.createElement("button"); b.id = "addtask"; b.className = "fab"; b.innerHTML = ICON.plus; document.body.appendChild(b); }
  b.hidden = false;
  b.setAttribute("aria-label", label);
  b.onclick = fn;
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
  if (!rows.length) return `<ul class="group list"><li class="empty">予定はありません</li></ul>`;
  const row = (i) => {
    const cur = now !== null && i.start <= now && now < i.end;
    const meta = i.kind === "work" ? `${clock(i.start)}–${clock(i.end)}`
      : i.kind === "cal" ? `${clock(i.start)}–${clock(i.end)}・Googleカレンダー`
      : `${clock(i.start)}・${dur(i.end - i.start)}${i.carried ? "・持ち越し" : ""}`;
    const over = p.conflicts.some((c) => c.item.id === i.id);
    const tap = checkable(i) ? "data-tap" : i.kind === "cal" ? `data-item="${i.id}"` : "";
    return `<li class="row item ${i.done ? "done" : ""} ${cur ? "cur" : ""} ${i.kind}" style="--rc:${tint(i)}" ${tap}>
      ${checkable(i) ? `<button class="check ${i.done ? "on" : ""}" data-check="${i.id}" aria-label="${i.done ? "未完了に戻す" : "できた"}"></button>` : `<span class="dot"></span>`}
      <span class="txt"><b>${esc(i.name)}</b><small>${meta}${over ? `<em>重なり</em>` : ""}</small></span>
      ${checkable(i) ? `<button class="more" data-item="${i.id}" aria-label="詳細">${ICON.chevron}</button>` : i.kind === "cal" ? ICON.chevron : ""}
    </li>`;
  };
  const doneRows = rows.filter((i) => i.done);
  const open = rows.filter((i) => !i.done);
  return `<ul class="group list">${open.length ? open.map(row).join("") : `<li class="empty">ぜんぶ終わりました</li>`}
    ${doneRows.length ? `<li><button class="row fold-head" data-fold="done" data-open="${fold.done ? 1 : 0}"><span class="txt"><small>終わった予定 ${doneRows.length}件</small></span><span class="fold-ic ${fold.done ? "open" : ""}">${ICON.chevron}</span></button></li>` : ""}
    ${doneRows.map((i) => row(i).replace('<li class="row item', `<li ${fold.done ? "" : "hidden"} class="row item`)).join("")}</ul>`;
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
      ${i.kind === "routine" ? `<li><div class="nudge"><button data-act="earlier">−15分</button><span>${clock(i.start)}〜</span><button data-act="later">＋15分</button></div></li><li><button class="row act" data-act="move"><b>時間を変える</b><span class="val">${clock(i.start)}</span></button></li>` : ""}
      ${i.task ? `<li><button class="row act" data-act="edit"><b>名前・長さを編集</b></button></li>` : ""}
      ${canShorten ? `<li><button class="row act" data-act="shorten"><b>15分短くする</b></button></li>` : ""}
      ${i.kind === "routine" ? `<li><button class="row act" data-act="carry"><b>明日に回す</b></button></li><li><button class="row act red" data-act="skip"><b>${i.task ? "このタスクを削除" : "今日は見送る"}</b></button></li>` : ""}
    </ul>`, (act) => {
    if (act === "right") return closeSheet();
    if (act === "move") return timeSheet(p, i);
    if (act === "earlier" || act === "later") { setStart(p, i, hm2(i.start + (act === "earlier" ? -15 : 15))); closeSheet(); render(); return itemSheet(planOf(p.date), id); }
    if (act === "edit") return taskSheet(p, p.dd.tasks.find((t) => t.id === id));
    if (act === "skip" && i.task && !confirmTwice(`del-${id}`)) return;
    applyAction(p, id, act);
  });
}

// 読書メモ: 読んで身についたこと(1日に何件でも)
function readsBlock(p) {
  const list = p.dd.reads;
  const open = fold.reads;
  return `<ul class="group">
      <li><button class="row fold-head" data-fold="reads" data-open="${open ? 1 : 0}"><span class="ic book">${ICON.book}</span><span class="txt"><b>読書メモ</b>${list.length ? `<small>${list.length}件</small>` : ""}</span><span class="fold-ic ${open ? "open" : ""}">${ICON.chevron}</span></button></li>
      ${list.map((r) => `<li ${open ? "" : "hidden"}><button class="row" data-read="${r.id}"><span class="ic book">${ICON.book}</span><span class="txt"><b>${esc(r.learned)}</b><small>${r.book ? `『${esc(r.book)}』` : "本の名前なし"}${r.action ? ` ・ 試す：${esc(r.action)}` : ""}</small></span>${ICON.chevron}</button></li>`).join("")}
      <li ${open ? "" : "hidden"}><button class="row add" id="readadd"><span class="ic plus">${ICON.plus}</span><span class="txt"><b>読んで身についたことを書く</b></span></button></li>
    </ul>`;
}
function recentBooks() {
  const seen = [];
  for (const k of Object.keys(state.days).sort().reverse()) for (const r of state.days[k].reads || []) if (r.book && !seen.includes(r.book)) seen.push(r.book);
  return seen.slice(0, 6);
}
function readSheet(p, id) {
  const cur = id ? p.dd.reads.find((r) => r.id === id) : null;
  const d = { book: cur?.book || recentBooks()[0] || "", learned: cur?.learned || "", action: cur?.action || "" };
  const draw = () => {
    openSheet(sheetHead(cur ? "読書メモを編集" : "読書メモ") + `
      <label class="field"><span>本の名前</span><input id="rbook" maxlength="80" placeholder="例：7つの習慣"></label>
      ${recentBooks().length ? `<div class="chips" style="margin:-4px 0 12px">${recentBooks().map((b) => `<button class="chip ${b === d.book ? "on" : ""}" data-book="${esc(b)}">${esc(b)}</button>`).join("")}</div>` : ""}
      <label class="field"><span>身についたこと（必須）</span><textarea id="rlearned" rows="4" maxlength="2000" placeholder="読んで、なるほどと思ったこと・自分の言葉で"></textarea></label>
      <label class="field"><span>明日から試すこと（任意）</span><textarea id="raction" rows="2" maxlength="500" placeholder="例：朝いちばんに今日の最重要を1つ決める"></textarea></label>
      ${cur ? `<button class="danger" data-act="delete">このメモを削除</button>` : ""}`, (act) => {
      const v = { book: $("#rbook").value.trim(), learned: $("#rlearned").value.trim(), action: $("#raction").value.trim() };
      const dd = dayData(dayKey(p.date));
      if (act === "delete") {
        if (!confirmTwice(`read-${id}`)) return;
        dd.reads = dd.reads.filter((r) => r.id !== id);
        if (!save()) return render();
        closeSheet(); return render();
      }
      if (act === "right") {
        if (!v.learned) return notice("身についたことを書いてください");
        const at = dd.reads.findIndex((r) => r.id === id);
        if (at >= 0) dd.reads[at] = { id, ...v }; else dd.reads.push({ id: `rd${Date.now()}`, ...v });
        if (!save()) return render();
        fold.reads = true; // 書いたメモが見えるように開く
      }
      closeSheet();
      render();
    });
    $("#rbook").value = d.book; $("#rlearned").value = d.learned; $("#raction").value = d.action;
    document.querySelectorAll("#sheet [data-book]").forEach((b) => (b.onclick = () => { d.learned = $("#rlearned").value; d.action = $("#raction").value; d.book = b.dataset.book; draw(); }));
  };
  draw();
}
function readsExportSheet() {
  const now = logicalNow().date;
  const ym = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const ranges = {
    this: { label: `${now.getMonth() + 1}月`, from: `${ym(now)}-01`, to: `${ym(now)}-31` },
    last: { label: `${last.getMonth() + 1}月`, from: `${ym(last)}-01`, to: `${ym(last)}-31` },
    all: { label: "これまで全部", from: "", to: "" },
  };
  let sel = "this";
  const draw = () => {
    const r = ranges[sel];
    const list = readsIn(r.from, r.to);
    openSheet(sheetHead("読書メモを書き出す", "", "閉じる") + `
      <div class="seg">${Object.entries(ranges).map(([k, x]) => `<button data-range="${k}" class="${k === sel ? "on" : ""}">${x.label}</button>`).join("")}</div>
      <p class="sheet-meta">${list.length}件</p>
      <ul class="group in-sheet">
        <li><button class="row act" data-act="csv" ${list.length ? "" : "disabled"}><b>CSVファイルで書き出す</b></button></li>
        <li><button class="row act" data-act="ai" ${list.length ? "" : "disabled"}><b>AIに貼る用にコピー</b></button></li>
      </ul>
      <p class="sheet-note">CSVはExcel・Googleスプレッドシートで開けます。「AIに貼る用」は、まとめのお願い文つきでコピーされるので、ChatGPTやClaudeにそのまま貼ってください。</p>`, async (act) => {
      if (act === "right") return closeSheet();
      if (!list.length) return;
      const tag = sel === "all" ? "all" : r.from.slice(0, 7);
      if (act === "csv") await shareText(`reading-${tag}.csv`, readsCsv(list), "text/csv");
      if (act === "ai") {
        const text = readsForAI(list, r.label);
        try { await navigator.clipboard.writeText(text); notice("コピーしました。AIに貼り付けてください"); }
        catch { await shareText(`reading-${tag}.txt`, text, "text/plain"); }
      }
    });
    document.querySelectorAll("#sheet [data-range]").forEach((b) => (b.onclick = () => { sel = b.dataset.range; draw(); }));
  };
  draw();
}

// 朝・夜のルーティーン(毎日同じ項目を、日ごとにチェックしていく)
const CL = {
  morning: { title: "モーニングルーティン", color: "var(--c-orange)", chips: ["水を飲む", "カーテンを開ける", "ストレッチ", "瞑想", "朝の日記", "散歩", "朝食"] },
  night: { title: "ナイトルーティン", color: "var(--c-indigo)", chips: ["明日の準備", "日記", "ストレッチ", "スマホを置く", "読書", "歯みがき", "入浴"] },
};
// 週の画面: 朝・夜ルーティンの達成数
function clWeek(p) {
  const m = clFor(p, "morning"), n = clFor(p, "night");
  const c = (l) => l.filter((x) => p.dd.chk[x.id]).length;
  return (m.length ? `<br><span class="cnt-l">朝</span>${c(m)}/${m.length}` : "") + (n.length ? `<br><span class="cnt-l">夜</span>${c(n)}/${n.length}` : "");
}

// 「今日は見送る」にした予定を戻す
function skippedRow(p) {
  const st = S();
  const list = Object.entries(p.dd.skip).filter(([, v]) => v === true).map(([id]) => {
    const r = st.routines.find((x) => x.id === id && x.slots[p.date.getDay()]);
    if (r) return { id, name: r.name };
    const m = /^carry-(\d+)$/.exec(id);
    if (m && p.dd.carry[+m[1]]) return { id, name: p.dd.carry[+m[1]].name };
    return null;
  }).filter(Boolean);
  if (!list.length) return "";
  return `<p class="sec">見送った予定</p><ul class="group">${list.map((x) => `<li><button class="row" data-unskip="${x.id}"><span class="txt"><b class="muted">${esc(x.name)}</b></span><span class="blue">戻す</span></button></li>`).join("")}</ul>`;
}
const CL_MAX = 30; // 保存データの読み込みも30件まで
const clFor = (p, kind) => state.checklists[kind].filter((i) => !i.on || (i.on === "work") === !!p.work); // 仕事の日だけ/休みの日だけ
const CL_MIN = { 水を飲む: 1, カーテンを開ける: 1, ストレッチ: 5, 瞑想: 5, 朝の日記: 5, 散歩: 15, 朝食: 15, 明日の準備: 5, 日記: 5, スマホを置く: 1, 読書: 15, 歯みがき: 3, 入浴: 20 };

// ルーチンタイマー: 朝・夜ルーティンを1つずつカウントダウンで進める
function runTimer(p, kind) {
  const c = CL[kind];
  const queue = clFor(p, kind).filter((i) => !p.dd.chk[i.id]);
  if (!queue.length) return;
  let idx = 0, endAt = 0, startAt = 0, pausedLeft = null, beeped = false, tick = null, lock = null, ac = null;
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  const beep = () => { if (!ac) return; try { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ac.destination); g.gain.setValueAtTime(0.25, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.6); o.start(); o.stop(ac.currentTime + 0.6); } catch {} };
  const keepAwake = async () => { try { lock = await navigator.wakeLock?.request("screen"); } catch {} };
  const stop = () => { clearInterval(tick); try { lock?.release(); } catch {} lock = null; timerRunning = false; };
  const begin = () => { const it = queue[idx]; startAt = Date.now(); endAt = it.min ? startAt + it.min * 60000 : 0; pausedLeft = null; beeped = false; };
  const fmt = (ms) => { const s = Math.max(0, Math.round(Math.abs(ms) / 1000)); return `${ms < 0 ? "+" : ""}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  const draw = () => {
    const it = queue[idx], nx = queue[idx + 1];
    openSheet(`<div class="timer" style="--rc:${c.color}">
      <p class="t-head">${c.title}　${idx + 1} / ${queue.length}</p>
      <p class="t-name">${esc(it.name)}</p>
      <p class="t-clock" id="tclock">${it.min ? `${it.min}:00` : "0:00"}</p>
      <div class="t-bar"><i id="tbar"></i></div>
      <p class="t-next">${nx ? `次は：${esc(nx.name)}${nx.min ? `（${nx.min}分）` : ""}` : "これで最後です"}</p>
      <button class="primary t-done" data-act="done">できた・次へ</button>
      <div class="t-row"><button data-act="pause" id="tpause">一時停止</button><button data-act="skip">とばす</button><button data-act="quit" class="red">やめる</button></div>
    </div>`, (act) => {
      if (act === "done") { p.dd.chk[queue[idx].id] = true; save(); return next(); }
      if (act === "skip") return next();
      if (act === "pause") {
        if (pausedLeft === null) { pausedLeft = (endAt || Date.now()) - Date.now(); if (!endAt) pausedLeft = -(Date.now() - startAt); $("#tpause").textContent = "再開"; }
        else { if (endAt) endAt = Date.now() + pausedLeft; else startAt = Date.now() + pausedLeft; pausedLeft = null; $("#tpause").textContent = "一時停止"; }
        return;
      }
      if (act === "quit") { stop(); closeSheet(); render(); }
    });
    $("#sheet").classList.add("timer-sheet");
    $("#sheet-backdrop").onclick = null; // うっかり閉じない
    update();
  };
  const update = () => {
    const it = queue[idx];
    if (!$("#tclock")) return;
    if (pausedLeft !== null) return;
    if (it.min) {
      const left = endAt - Date.now();
      $("#tclock").textContent = fmt(left);
      $("#tclock").classList.toggle("over", left < 0);
      $("#tbar").style.width = `${Math.min(100, (1 - left / (it.min * 60000)) * 100)}%`;
      if (left <= 0 && !beeped) { beeped = true; beep(); setTimeout(beep, 700); }
    } else {
      $("#tclock").textContent = fmt(Date.now() - startAt);
      $("#tbar").style.width = "0%";
    }
  };
  const next = () => {
    idx++;
    if (idx >= queue.length) {
      stop();
      openSheet(sheetHead(c.title, "", "閉じる") + `<div class="timer done-msg"><p class="t-name">おつかれさま</p><p class="t-next">${c.title}が終わりました</p></div>`, () => { closeSheet(); render(); });
      $("#sheet").classList.remove("timer-sheet");
      return;
    }
    begin(); draw();
  };
  timerRunning = true;
  keepAwake();
  begin(); draw();
  tick = setInterval(update, 250);
}
let timerRunning = false;
function clDone(p, kind) {
  const items = clFor(p, kind);
  return items.length > 0 && items.every((i) => p.dd.chk[i.id]);
}
function checklist(p, kind, open = true) {
  const c = CL[kind];
  const all0 = state.checklists[kind];
  const items = clFor(p, kind);
  const hidden = all0.length - items.length;
  const done = items.filter((i) => p.dd.chk[i.id]).length;
  const sub = kind === "morning" ? `起床 ${clock(p.wake)}〜` : `寝る準備 ${clock(p.windDown % 1440)}〜`;
  const all = items.length > 0 && done === items.length;
  const total = items.reduce((s, i) => s + (i.min || 0), 0);
  const left = items.filter((i) => !p.dd.chk[i.id]);
  const h = open ? "" : "hidden";
  return `<ul class="group cl ${open ? "" : "closed"}">
      <li><button class="row fold-head cl-title" data-fold="${kind}" data-open="${open ? 1 : 0}"><span class="cdot big" style="--rc:${c.color}"></span><span class="txt"><b>${c.title}</b><small>${sub}${total ? `・合計${dur(total)}` : ""}</small></span><span class="cl-count ${all ? "all" : ""}">${items.length ? (all ? "✓ 完了" : `${done}/${items.length}`) : ""}</span><span class="fold-ic ${open ? "open" : ""}">${ICON.chevron}</span></button></li>
      ${left.length && dayKey(p.date) === dayKey(logicalNow().date) ? `<li ${h}><button class="row cl-start" data-cl-start="${kind}" style="--rc:${c.color}"><span class="play">▶</span><span class="txt"><b>スタート</b><small>残り${left.length}つを順番にタイマーで</small></span></button></li>` : ""}
      ${items.map((i) => `<li ${h} class="row item ${p.dd.chk[i.id] ? "done" : ""}" style="--rc:${c.color}" data-tap>
        <button class="check ${p.dd.chk[i.id] ? "on" : ""}" data-cl-check="${i.id}" aria-label="${p.dd.chk[i.id] ? "未完了に戻す" : "できた"}"></button>
        <span class="txt"><b>${esc(i.name)}</b>${i.min || i.on ? `<small>${[i.min ? `${i.min}分` : "", i.on === "work" ? "仕事の日" : i.on === "off" ? "休みの日" : ""].filter(Boolean).join("・")}</small>` : ""}</span><button class="more" data-cl-edit="${kind}:${i.id}" aria-label="編集">${ICON.chevron}</button></li>`).join("")}
      ${hidden ? `<li ${h} class="cl-hidden">${p.work ? "休みの日" : "仕事の日"}だけの項目 ${hidden}つは、今日は出していません</li>` : ""}
      <li ${h}><button class="row add" data-cl-add="${kind}"><span class="ic plus">${ICON.plus}</span><span class="txt"><b>${c.title}に追加</b></span></button></li>
    </ul>`;
}
function checklistSheet(kind, id) {
  const c = CL[kind];
  let list, cur;
  const fresh = () => { list = state.checklists[kind]; cur = id ? list.find((x) => x.id === id) : null; }; // 保存失敗で状態が戻っても古い参照を使わない
  fresh();
  let dmin = cur?.min || 0, typed = null, don = cur?.on || "";
  const draw = () => {
    fresh();
    const have = new Set(list.map((x) => x.name));
    const idx = cur ? list.indexOf(cur) : -1;
    openSheet(sheetHead(cur ? "項目を編集" : `${c.title}に追加`, cur ? "キャンセル" : "閉じる", cur ? "保存" : "追加") + `
      <input class="name-input" id="clname" placeholder="やること（例：水を飲む）" maxlength="40">
      <p class="sheet-label">やる日</p>
      <div class="presets">${[["", "毎日"], ["work", "仕事の日だけ"], ["off", "休みの日だけ"]].map(([v, l]) => `<button class="${don === v ? "on" : ""}" data-don="${v}">${l}</button>`).join("")}</div>
      <p class="sheet-label">かける時間（タイマー用・任意）</p>
      <div class="chips">${[0, 1, 3, 5, 10, 15, 20, 30].map((m) => `<button class="chip ${dmin === m ? "on" : ""}" data-dmin="${m}">${m ? `${m}分` : "なし"}</button>`).join("")}</div>
      ${cur ? `<ul class="group in-sheet">
        ${idx > 0 ? `<li><button class="row act" data-act="up"><b>1つ上へ</b></button></li>` : ""}
        ${idx < list.length - 1 ? `<li><button class="row act" data-act="down"><b>1つ下へ</b></button></li>` : ""}
        <li><button class="row act red" data-act="del"><b>この項目を削除</b></button></li></ul>`
      : `<p class="sheet-label">よく使うもの（押すとすぐ追加）</p><div class="chips">${c.chips.filter((n) => !have.has(n)).map((n) => `<button class="chip" data-chip="${esc(n)}">${esc(n)}</button>`).join("")}</div>
         <p class="sheet-note">毎日同じ項目が並び、日ごとにチェックしていきます。</p>`}`, (act) => {
      const name = $("#clname").value.trim();
      fresh();
      if (id && !cur) { closeSheet(); return render(); }
      if (act === "up" || act === "down") {
        const j = idx + (act === "up" ? -1 : 1);
        [list[idx], list[j]] = [list[j], list[idx]];
        save(); render(); return draw();
      }
      if (act === "del") {
        if (!confirmTwice(`cl-${cur.id}`)) return;
        list.splice(idx, 1); save(); closeSheet(); return render();
      }
      if (act === "right") {
        if (name) {
          if (!cur && list.length >= CL_MAX) return notice(`${c.title}は${CL_MAX}個までです`);
          const extra = { ...(dmin ? { min: dmin } : {}), ...(don ? { on: don } : {}) };
          if (cur) { cur.name = name; if (dmin) cur.min = dmin; else delete cur.min; if (don) cur.on = don; else delete cur.on; } else list.push({ id: `c${Date.now()}`, name, ...extra });
          if (!save()) return render();
        } else if (!cur) return notice("やることを入れてください");
      }
      closeSheet();
      render();
    });
    $("#clname").value = typed ?? (cur ? cur.name : "");
    document.querySelectorAll("#sheet [data-dmin]").forEach((b) => (b.onclick = () => { typed = $("#clname").value; dmin = +b.dataset.dmin; draw(); }));
    document.querySelectorAll("#sheet [data-don]").forEach((b) => (b.onclick = () => { typed = $("#clname").value; don = b.dataset.don; draw(); }));
    document.querySelectorAll("#sheet [data-chip]").forEach((b) => (b.onclick = () => {
      fresh();
      if (list.length >= CL_MAX) return notice(`${c.title}は${CL_MAX}個までです`);
      const m0 = CL_MIN[b.dataset.chip];
      list.push({ id: `c${Date.now()}${list.length}`, name: b.dataset.chip, ...(m0 ? { min: m0 } : {}), ...(don ? { on: don } : {}) });
      save(); render(); draw();
    }));
  };
  draw();
}

// 今日だけのタスクを追加・編集(名前・時刻・長さ)
function taskSheet(p, t) {
  const draft = t ? { ...t, start: hm2(toMin(t.start)), min: Math.max(5, t.min - (p.dd.shorten[t.id] || 0)) } : { id: `t${Date.now()}`, name: "", start: p.dd.tasks.length ? p.dd.tasks[p.dd.tasks.length - 1].start : hm2(Math.min(Math.max(p.windDown - 90, p.wake + 60), 1380)), min: 30 };
  const now = logicalNow();
  if (!t && dayKey(p.date) === dayKey(now.date)) draft.start = hm2(Math.ceil((now.min + 10) / 5) * 5);
  let more = !!t; // 新しく追加するときは名前だけ。時刻と長さは「変える」で開く
  const draw = () => {
    openSheet(sheetHead(t ? "タスクを編集" : `${dayKey(p.date) === dayKey(logicalNow().date) ? "今日" : `${p.date.getMonth() + 1}/${p.date.getDate()}`}のタスクを追加`) + `
      <input class="name-input" id="tname" placeholder="やること（例：歯医者）" maxlength="40">
      ${more ? "" : `<button class="row act when" data-act="more"><span class="txt"><b>${draft.start}から・${draft.min < 60 ? `${draft.min}分` : dur(draft.min)}</b></span><span class="blue">変える</span></button>`}
      <div ${more ? "" : "hidden"}>
      <input type="time" class="big-time" id="ttime" value="${draft.start}">
      <p class="sheet-label">長さ</p>
      <div class="chips">${[10, 15, 30, 45, 60, 90, 120].map((m) => `<button class="chip ${draft.min === m ? "on" : ""}" data-min="${m}">${m < 60 ? `${m}分` : m === 90 ? "1時間半" : `${m / 60}時間`}</button>`).join("")}</div>
      </div>
      <p class="sheet-note">この日だけのタスクです。毎日・毎週のルーティーンは「設定」から追加します。</p>`, (act) => {
      draft.name = $("#tname").value.trim() || draft.name;
      draft.start = $("#ttime").value || draft.start;
      if (act === "more") { more = true; return draw(); }
      if (act === "right") {
        if (!draft.name) return notice("やることを入れてください");
        if (!/^\d{1,2}:\d{2}$/.test(draft.start)) return notice("時刻を入れてください");
        const dd = dayData(dayKey(p.date)); // 保存失敗で状態が戻ることがあるので、その都度取り直す
        const list = dd.tasks;
        const at = list.findIndex((x) => x.id === draft.id);
        if (at >= 0) list[at] = { ...draft }; else list.push({ ...draft });
        delete dd.shorten[draft.id]; // 編集した長さをそのまま使う
        if (!save()) return render(); // 失敗したらシートは開いたまま(入力を残す)
      }
      closeSheet();
      render();
    });
    $("#tname").value = draft.name;
    if (!t && !draft.name) $("#tname").focus();
    document.querySelectorAll("#sheet [data-min]").forEach((b) => (b.onclick = () => { draft.name = $("#tname").value; draft.start = $("#ttime").value || draft.start; draft.min = +b.dataset.min; draw(); }));
  };
  draw();
}

// 今日の予定の開始時刻を変える(元に戻すこともできる)
function timeSheet(p, i) {
  const id = i.id;
  openSheet(sheetHead("時間を変える") + `
    <p class="sheet-meta">${esc(i.name)}</p>
    <input type="time" class="big-time" id="mtime" value="${hm2(i.start)}">
    ${i.moved ? `<ul class="group in-sheet"><li><button class="row act" data-act="reset"><b>元の時刻に戻す</b></button></li></ul>` : ""}`, (act) => {
    if (act === "right") {
      const v = $("#mtime").value;
      if (!v) return notice("時刻を入れてください");
      setStart(p, i, v);
    }
    if (act === "reset") { delete p.dd.moved[id]; save(); }
    closeSheet();
    render();
  });
}
function setStart(p, i, hhmm) {
  hhmm = hm2(toMin(hhmm));
  if (i.task) { const t = p.dd.tasks.find((x) => x.id === i.id); if (t) t.start = hhmm; } else p.dd.moved[i.id] = hhmm;
  save();
}

// 予定の操作(完了・短く・見送る・明日に回す)
function applyAction(p, id, act) {
  const dd = p.dd;
  const r = p.items.find((x) => x.id === id);
  if (act === "done") dd.done[id] = !dd.done[id];
  if (act === "shorten") dd.shorten[id] = (dd.shorten[id] || 0) + 15;
  if (act === "skip") {
    if (r && r.task) dd.tasks = dd.tasks.filter((t) => t.id !== id); else dd.skip[id] = true;
  }
  if (act === "carry" && r) {
    const next = dayData(dayKey(addDays(p.date, 1)));
    if (r.task) {
      dd.tasks = dd.tasks.filter((t) => t.id !== id);
      next.tasks.push({ id: `t${Date.now()}`, name: r.name, start: hm2(r.start), min: r.end - r.start });
    } else {
      dd.skip[id] = "carry"; // 明日に回した(戻す一覧には出さない)
      next.carry.push({ id: r.src || id, name: r.name, min: r.end - r.start });
    }
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
  $("#sheet").classList.remove("timer-sheet");
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
  tlGeom = { from, to, y };
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
    const drag = i.kind === "routine";
    const fold = i.kind === "work" && work.end - work.start > 120 ? `<button class="fold" id="work-toggle">${folds.length ? "広げる" : "たたむ"}</button>` : "";
    return `<div class="blk ${i.kind} ${i.done ? "done" : ""} ${i.stacked ? "stacked" : ""}" style="top:${i.top}px;height:${h}px;--rc:${tint(i)}" ${tap ? `data-item="${i.id}"` : ""} ${drag ? `data-drag="${i.id}" data-start="${i.start}"` : ""}>
      <span class="t">${i.kind === "work" ? `${clock(i.start)}–${clock(i.end)}` : clock(i.start)}</span><b>${esc(i.name)}</b>${fold}</div>`;
  }).join("");
  const sleep = `<div class="blk sleepb" style="top:${y(p.bed)}px;height:${Math.max(40, height - y(p.bed))}px"><span class="t">${clock(p.bed)}</span><b>睡眠</b></div>`;
  const nowLine = now !== null && now >= from && now <= to ? `<div class="nowline" style="top:${y(now)}px"></div>` : "";
  return `<div class="axis" style="height:${height}px">${ticks}</div><div class="lane" style="height:${height}px">${html}${sleep}${nowLine}</div>`;
}

// 円で見る: 24時間を時計のような円にして、1日の流れをひと目で(0時が上、時計回り)
function dayPie(p, now) {
  const C = 170, R = 150, r0 = 98;
  const ang = (m) => ((((m % 1440) + 1440) % 1440) / 1440) * Math.PI * 2 - Math.PI / 2;
  const pt = (m, rad) => [C + Math.cos(ang(m)) * rad, C + Math.sin(ang(m)) * rad];
  const arc = (a, b, ro, ri) => {
    if (b - a >= 1440) b = a + 1439.9;
    const big = b - a > 720 ? 1 : 0;
    const [x1, y1] = pt(a, ro), [x2, y2] = pt(b, ro), [x3, y3] = pt(b, ri), [x4, y4] = pt(a, ri);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${ro} ${ro} 0 ${big} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}L${x3.toFixed(1)} ${y3.toFixed(1)}A${ri} ${ri} 0 ${big} 0 ${x4.toFixed(1)} ${y4.toFixed(1)}Z`;
  };
  const col = (i) => i.kind === "sleep" ? "var(--c-indigo)" : i.kind === "work" ? "var(--gray)" : i.kind === "life" ? "var(--sep)" : tint(i);
  let segs = `<circle cx="${C}" cy="${C}" r="${(R + r0) / 2}" fill="none" stroke="var(--fill)" stroke-width="${R - r0}"/>`;
  // 睡眠(前の夜の就寝〜今日の起床)も円に入れる
  const prevBed = p.wake - Math.round(S().sleepHours * 60);
  segs += `<path d="${arc(prevBed, p.wake, R, r0)}" fill="var(--c-indigo)" opacity=".35"/>`;
  for (const i of p.items) {
    if (i.end <= i.start) continue;
    const inner = i.kind === "routine" || i.kind === "cal" || i.kind === "rest" ? r0 - 22 : r0;
    const outer = i.kind === "routine" || i.kind === "cal" || i.kind === "rest" ? R + 8 : R;
    const tap = checkable(i) || i.kind === "cal";
    segs += `<path d="${arc(i.start, i.end, outer, inner)}" fill="${col(i)}" opacity="${i.kind === "sleep" ? 0.35 : i.done ? 0.45 : 0.9}" ${tap ? `data-item="${i.id}" class="tapseg"` : ""}><title>${esc(i.name)} ${clock(i.start)}–${clock(i.end)}</title></path>`;
  }
  let ticks = "";
  for (let h = 0; h < 24; h += 3) {
    const [x, y] = pt(h * 60, R + 18);
    ticks += `<text x="${x.toFixed(0)}" y="${(y + 4).toFixed(0)}" text-anchor="middle" class="pie-t">${h}</text>`;
  }
  let hand = "";
  if (now !== null) {
    const [x, y] = pt(now, R + 10);
    hand = `<line x1="${C}" y1="${C}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--c-red)" stroke-width="2.5" stroke-linecap="round"/><circle cx="${C}" cy="${C}" r="5" fill="var(--c-red)"/>`;
  }
  const cur = now !== null ? p.items.find((i) => i.start <= now && now < i.end && i.kind !== "life") || p.items.find((i) => i.start > now && i.kind !== "life") : null;
  const center = cur
    ? `<text x="${C}" y="${C - 18}" text-anchor="middle" class="pie-s">${cur.start <= now ? "いま" : "次"}</text><text x="${C}" y="${C + 8}" text-anchor="middle" class="pie-n">${esc(cur.name.length > 8 ? cur.name.slice(0, 8) + "…" : cur.name)}</text><text x="${C}" y="${C + 30}" text-anchor="middle" class="pie-s">${clock(cur.start)}–${clock(cur.end)}</text>`
    : `<text x="${C}" y="${C - 6}" text-anchor="middle" class="pie-s">起床 ${clock(p.wake)}</text><text x="${C}" y="${C + 18}" text-anchor="middle" class="pie-s">就寝 ${clock(p.bed)}</text>`;
  const legend = [["var(--c-indigo)", "睡眠", .35], ["var(--gray)", "勤務", .9], ["var(--c-blue)", "ルーティーン", .9], ["var(--google)", "予定", .9]];
  return `<svg viewBox="-24 -24 388 388" class="pie-svg" role="img" aria-label="1日の円グラフ">${segs}${ticks}${hand}${center}</svg>
    <div class="pie-legend">${legend.map(([c, l, o]) => `<span><i style="background:${c};opacity:${o}"></i>${l}</span>`).join("")}</div>`;
}

// 今月の記録: ルーティーンごとに1か月のマスを並べ、できた日を塗る(見える化)
function monthBlock(anchor) {
  const y = anchor.getFullYear(), m = anchor.getMonth();
  const n = new Date(y, m + 1, 0).getDate();
  const today = dayKey(logicalNow().date);
  const days = [...Array(n)].map((_, i) => new Date(y, m, i + 1));
  const plans = days.map((d) => planOf(d));
  const rows = [];
  for (const r of S().routines) {
    const cells = plans.map((p) => {
      const k = dayKey(p.date), planned = !!r.slots[p.date.getDay()];
      if (!planned || p.dd.rest) return "off";
      if (k > today) return "future";
      return p.dd.done[r.id] ? "done" : "miss";
    });
    if (!cells.some((c) => c !== "off")) continue;
    rows.push({ name: r.name, color: `var(--c-${colorOf(r, S().routines.indexOf(r))})`, cells });
  }
  for (const [kind, label, color] of [["morning", "朝ルーティン", "var(--c-orange)"], ["night", "夜ルーティン", "var(--c-indigo)"]]) {
    if (!state.checklists[kind].length) continue;
    rows.push({ name: label, color, cells: plans.map((p) => {
      const items = clFor(p, kind);
      if (!items.length) return "off";
      if (dayKey(p.date) > today) return "future";
      const c = items.filter((x) => p.dd.chk[x.id]).length;
      return c === items.length ? "done" : c ? "half" : "miss";
    }) });
  }
  rows.push({ name: "読書メモ", color: "var(--c-teal)", cells: plans.map((p) => dayKey(p.date) > today ? "future" : p.dd.reads.length ? "done" : "miss") });
  const rate = (cells) => { const past = cells.filter((c) => c === "done" || c === "miss" || c === "half"); return past.length ? Math.round(cells.filter((c) => c === "done").length / past.length * 100) : null; };
  return `<p class="sec">${m + 1}月の記録</p>
    <div class="card month">${rows.map((row) => {
      const pct = rate(row.cells);
      return `<div class="mrow"><div class="mhead"><b>${esc(row.name)}</b><span>${pct === null ? "" : `${pct}%`}</span></div>
        <div class="mgrid" style="--rc:${row.color}">${row.cells.map((c, i) => `<i class="${c}" title="${i + 1}日"></i>`).join("")}</div></div>`;
    }).join("")}
      <p class="mnote">● できた　◐ 一部　○ できなかった　薄い枠はこれからの予定</p></div>`;
}

// 時間で見るで、予定を長押ししてドラッグすると時刻を動かせる(5分刻み)
let tlGeom = null;
let dragEndedAt = 0;
function enableDrag(p) {
  const lane = document.querySelector(".timeline .lane");
  if (!lane || !tlGeom) return;
  const { from, to, y } = tlGeom;
  const minAt = (px) => { let best = from, d = Infinity; for (let t = from; t <= to; t++) { const v = Math.abs(y(t) - px); if (v < d) { d = v; best = t; } } return best; };
  // iPhoneでは指の操作(touch)で扱う。長押しで掴んだあとはスクロールを止めて、指に合わせて動かす
  lane.querySelectorAll("[data-drag]").forEach((el) => {
    let st = null;
    const begin = (clientY) => {
      st = { on: false, startY: clientY, top0: parseFloat(el.style.top), start0: +el.dataset.start, t: +el.dataset.start, timer: null };
      st.timer = setTimeout(() => { if (!st) return; st.on = true; el.classList.add("dragging"); document.body.classList.add("no-scroll"); }, 300);
    };
    const move = (clientY, e) => {
      if (!st) return;
      if (!st.on) { if (Math.abs(clientY - st.startY) > 10) cancel(); return; } // 長押し前に動いたら普通のスクロール
      if (e && e.cancelable) e.preventDefault();
      const dy = clientY - st.startY;
      const top = Math.min(Math.max(st.top0 + dy, 0), parseFloat(lane.style.height) - 24);
      el.style.top = top + "px";
      st.t = Math.round(minAt(Math.min(Math.max(y(st.start0) + dy, 0), y(to))) / 5) * 5; // 重なりで下げて表示している分は足さない
      const tt = el.querySelector(".t"); if (tt) tt.textContent = clock(st.t % 1440);
    };
    const finish = () => {
      if (!st) return;
      clearTimeout(st.timer);
      const was = st.on, moved = st.on && st.t !== st.start0, t = st.t;
      cleanup();
      if (!was) return;
      dragEndedAt = Date.now();
      if (moved) {
        const it = p.items.find((x) => x.id === el.dataset.drag);
        if (it) { setStart(p, it, hm2(t)); notice(`${it.name}を ${clock(t % 1440)} に動かしました`); }
      }
      render();
    };
    const cancel = () => { if (st) clearTimeout(st.timer); cleanup(); };
    const cleanup = () => { el.classList.remove("dragging"); document.body.classList.remove("no-scroll"); st = null; };
    // 指(iPhone)
    el.addEventListener("touchstart", (e) => { if (e.touches.length === 1) begin(e.touches[0].clientY); }, { passive: true });
    el.addEventListener("touchmove", (e) => move(e.touches[0].clientY, e), { passive: false });
    el.addEventListener("touchend", (e) => { if (st && st.on && e.cancelable) e.preventDefault(); finish(); }, { passive: false });
    el.addEventListener("touchcancel", cancel);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    // マウス(パソコン)
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button) return;
      begin(e.clientY);
      const mm = (ev) => move(ev.clientY, ev);
      const mu = () => { window.removeEventListener("pointermove", mm); window.removeEventListener("pointerup", mu); finish(); };
      window.addEventListener("pointermove", mm); window.addEventListener("pointerup", mu);
    });
  });
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
        <span class="count">${p.conflicts.length ? `<em>重なり</em>` : ""}<span class="cnt-l">予定</span>${done}/${rs.length}${clWeek(p)}</span>${ICON.chevron}
      </button></li>`;
    }).join("")}</ul>
    ${monthBlock(days[3])}
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
      ${row("v-windDownMin", "寝る準備", dur(st.windDownMin))}
      ${row("v-holidayWake", "休みの日の起床", clock(toMin(st.holidayWake)))}
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
      <li><button class="row" id="export-reads"><span class="txt"><b class="blue">読書メモを書き出す（CSV・AI用）</b></span></button></li>
      <li><button class="row" id="export"><span class="txt"><b class="blue">データを書き出す</b></span></button></li>
      <li><label class="row"><span class="txt"><b class="blue">書き出したデータから復元</b></span><input type="file" id="import" accept="application/json" hidden></label></li>
    </ul>
    <p class="foot-note">データはこのiPhoneの中だけにあります。週に1回、書き出しておくと安心です。</p>`;

  $("#set-work").onclick = workSheet;
  ["sleepHours", "commuteMin", "prepMin", "windDownMin", "holidayWake"].forEach((k) => ($(`#v-${k}`).onclick = () => valueSheet(k)));
  document.querySelectorAll("[data-r]").forEach((el) => (el.onclick = () => routineSheet(+el.dataset.r)));
  $("#radd").onclick = templateSheet;
  $("#set-cal").onclick = calSheet;
  $("#set-night").onclick = nightSheet;
  $("#export").onclick = exportData;
  $("#export-reads").onclick = readsExportSheet;
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
if (NOSAVE && params.get("demo") === "cl") { state.checklists.morning = [{ id: "m1", name: "白湯を飲む", min: 3 }, { id: "m2", name: "ストレッチ", min: 5 }, { id: "m3", name: "瞑想", min: 5 }, { id: "m4", name: "通勤の準備", min: 10, on: "work" }]; state.checklists.night = [{ id: "n1", name: "明日の準備" }, { id: "n2", name: "日記" }]; const d0 = dayData(dayKey(logicalNow().date)); d0.chk.m1 = true; d0.chk.m2 = true; render(); }
if (NOSAVE && params.get("demo") === "carry") dayData(dayKey(logicalNow().date)).carry.push({ id: "study", name: "AI・プログラミング", min: 30 });
if (NOSAVE && params.get("demo") !== "onboarding") state.onboarded = true;
if (NOSAVE && ["time", "pie"].includes(params.get("mode"))) mode = params.get("mode");
if (NOSAVE && params.get("done") === "1") dayData(dayKey(logicalNow().date)).done.move = true;
render(true);
if (!state.onboarded && !onbSkipped) onboarding(NOSAVE ? Number(params.get("step")) || 1 : 1);
if (NOSAVE && params.get("demo") === "work") workSheet();
if (NOSAVE && params.get("demo") === "routine") routineSheet(0);
if (NOSAVE && params.get("demo") === "template") templateSheet();
if (NOSAVE && params.get("demo") === "timer") { state.checklists.morning = [{ id: "m1", name: "白湯を飲む", min: 3 }, { id: "m2", name: "ストレッチ", min: 5 }]; render(); runTimer(planOf(logicalNow().date), "morning"); }
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
    if (!hadController || reloaded) return;
    reloaded = true;
    // 入力中・ドラッグ中なら、終わるまで待ってから切り替える(書きかけを消さない)
    const tryReload = () => { if (busy() || document.querySelector(".blk.dragging")) return setTimeout(tryReload, 2000); location.reload(); };
    tryReload();
  });
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
