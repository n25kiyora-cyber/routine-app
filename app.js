// ルーティーンアプリの動き。データはスマホの中(localStorage)に保存する。

const KEY = "routine-app-v1";

const ROUTINES = [
  { id: "side", name: "副業の作業", step: "案件サイトを開く" },
  { id: "study", name: "AI・プログラミングの勉強", step: "エディタを開く" },
  { id: "health", name: "運動・睡眠", step: "スクワット5回" },
  { id: "read", name: "読書・情報収集", step: "1ページ読む" },
];

// ---- 画面下のお知らせ(alert の代わり) ----
function notice(text) {
  const el = document.getElementById("notice");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(notice.timer);
  notice.timer = setTimeout(() => (el.hidden = true), 3000);
}

// ---- データの形をそろえる(足りない部分を補う) ----
function normalize(d) {
  const out = { days: {}, reviews: {} };
  if (!d || typeof d !== "object" || typeof d.days !== "object") return null;
  for (const [key, day] of Object.entries(d.days)) {
    out.days[key] = {
      three: Array.isArray(day?.three) ? day.three.slice(0, 3) : [{}, {}, {}],
      done: typeof day?.done === "object" && day.done ? day.done : {},
    };
    while (out.days[key].three.length < 3) out.days[key].three.push({});
  }
  if (d.reviews && typeof d.reviews === "object") out.reviews = d.reviews;
  return out;
}

// ---- 保存と読み込み ----
function load() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return { days: {}, reviews: {} };
  try {
    const d = normalize(JSON.parse(raw));
    if (d) return d;
  } catch {}
  // 読めなかったデータは消さずに別の場所へ退避しておく
  localStorage.setItem(`${KEY}-broken-${Date.now()}`, raw);
  notice("保存データが読めなかったため、別の場所に退避しました");
  return { days: {}, reviews: {} };
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    notice("保存に失敗しました。容量がいっぱいかもしれません");
  }
}

// ---- 日付のヘルパー(すべて日本の現地時間で扱う) ----
const pad = (n) => String(n).padStart(2, "0");
function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // 例: 2026-10-01
}
function fromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d); // 現地時間の0時
}
function weekDays(d = new Date()) {
  // その週の月曜〜日曜。getDay() は日曜=0 なので、月曜まで何日戻るかを計算する
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return [...Array(7)].map((_, i) =>
    dayKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i))
  );
}

// 「今日」のデータ。開くたび・日付が変わるたびに取り直す
function todayData() {
  const key = dayKey();
  if (!data.days[key]) data.days[key] = { three: [{}, {}, {}], done: {} };
  return data.days[key];
}

let data = load();

// ---- ① 今日の3つ ----
function renderThree() {
  const ol = document.getElementById("three");
  ol.innerHTML = "";
  todayData().three.forEach((item, i) => {
    const li = document.createElement("li");
    li.className = item.checked ? "checked" : "";
    li.innerHTML = `
      <input type="checkbox">
      <div class="fields">
        <input class="title" placeholder="${i === 0 ? "必須：今日これだけはやる" : "できれば"}">
        <input class="step" placeholder="2分でできる最初の一歩">
      </div>`;
    const [check, title, step] = li.querySelectorAll("input");
    check.checked = !!item.checked;
    title.value = item.title ?? ""; // 入力した文字は value に直接入れる(記号で表示が崩れないように)
    step.value = item.step ?? "";
    check.onchange = () => { item.checked = check.checked; save(); renderThree(); };
    title.oninput = () => { item.title = title.value; save(); };
    step.oninput = () => { item.step = step.value; save(); };
    ol.appendChild(li);
  });
}

// ---- ② 毎日のルーティーン ----
function renderRoutines() {
  const ul = document.getElementById("routines");
  ul.innerHTML = "";
  const week = weekDays();
  const today = todayData();
  ROUTINES.forEach((r) => {
    const count = week.filter((d) => data.days[d]?.done?.[r.id]).length;
    const done = !!today.done[r.id];
    const li = document.createElement("li");
    li.className = done ? "checked" : "";
    li.innerHTML = `
      <label>
        <input type="checkbox">
        <span><strong>${r.name}</strong><small>最初の一歩：${r.step}</small></span>
      </label>
      <span class="count">今週 ${count}/7</span>`;
    const check = li.querySelector("input");
    check.checked = done;
    check.onchange = () => {
      todayData().done[r.id] = check.checked;
      save();
      renderRoutines();
    };
    ul.appendChild(li);
  });
}

// ---- ③ 週の振り返り(入力するそばから自動で保存) ----
let reviewWeek; // 画面に出している週。週をまたいでも、表示中の週に保存する
function renderReview() {
  reviewWeek = weekDays()[0];
  const r = data.reviews[reviewWeek] ?? {};
  for (const f of ["done", "why", "next"]) document.getElementById(`r-${f}`).value = r[f] ?? "";
  // 先週決めた「来週変えること」を、今週の目標として表示
  const m = fromKey(reviewWeek);
  const last = data.reviews[dayKey(new Date(m.getFullYear(), m.getMonth(), m.getDate() - 7))];
  document.getElementById("focus").textContent = last?.next
    ? `今週変えること：${last.next}`
    : "日曜の夜に、今週をふり返りましょう。";
}
for (const f of ["done", "why", "next"]) {
  document.getElementById(`r-${f}`).oninput = (e) => {
    data.reviews[reviewWeek] = { ...data.reviews[reviewWeek], [f]: e.target.value };
    save();
  };
}

// ---- ④ 書き出し・復元 ----
document.getElementById("export").onclick = async () => {
  const name = `routine-backup-${dayKey()}.json`;
  const file = new File([JSON.stringify(data, null, 2)], name, { type: "application/json" });
  // iPhone では「共有」メニューから「ファイルに保存」できる
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "ルーティーンのバックアップ" });
      return;
    } catch (e) {
      if (e.name === "AbortError") return; // 自分でキャンセルした
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
};
document.getElementById("import").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  let restored;
  try {
    restored = normalize(JSON.parse(await file.text()));
  } catch {}
  if (!restored) return notice("このファイルは読み込めませんでした");
  // 置き換える前に、今のデータを退避しておく(万一のとき戻せるように)
  localStorage.setItem(`${KEY}-before-restore`, JSON.stringify(data));
  data = restored;
  save();
  renderAll();
  notice("復元しました(前のデータも保管しています)");
};

// ---- 画面を表示 ----
function renderAll() {
  document.getElementById("date").textContent = new Date().toLocaleDateString("ja-JP", {
    month: "long", day: "numeric", weekday: "short",
  });
  renderThree();
  renderRoutines();
  renderReview();
}
renderAll();

// アプリに戻ってきたとき、日付が変わっていたら「今日」を作り直す
let shownDay = dayKey();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && dayKey() !== shownDay) {
    shownDay = dayKey();
    renderAll();
  }
});

// オフラインでも開けるようにする(PWA)。https か localhost でだけ動く
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
