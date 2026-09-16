// ==========================================================================
// 空き枠計算エンジン
// ==========================================================================
// スタッフのシフト・既に入っている予約(所要時間込み)・メニューの所要時間から、
// 「いつ・どのスタッフなら予約できるか」を計算する純粋な関数だけを集めたファイルです。
// DOM(画面)やFirebaseには一切触れないので、Node.jsだけでテストできます。
//
// 【メニューの所要時間について】
// 一般的な美容室の相場を目安に初期値を設定しています(下記 DEFAULT_MENU_DURATIONS)。
// 実際の所要時間と違う場合は、この値を書き換えてコミット・pushしてください。
// ==========================================================================

export var DEFAULT_MENU_DURATIONS = {
  'カット': 60,
  '学生カット': 40,
  'キッズカット': 40,
  '前髪カット': 15,
  'カラー': 90,
  'パーマ': 120,
  'デジタルパーマ': 150,
  '縮毛矯正': 180,
  'トリートメント': 30,
  'ヘッドスパ': 40
};
export var FALLBACK_DURATION_MINUTES = 60;

export var WEEKDAY_JP = ['日', '月', '火', '水', '木', '金', '土'];

// メニュー名(または大分類)から所要時間(分)を求めます。見つからない場合は既定値を返します。
export function getMenuDuration(menuName) {
  if (menuName && DEFAULT_MENU_DURATIONS[menuName] != null) {
    return DEFAULT_MENU_DURATIONS[menuName];
  }
  return FALLBACK_DURATION_MINUTES;
}

export function timeToMinutes(t) {
  var parts = (t || '').split(':');
  var h = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) { return 0; }
  return h * 60 + m;
}

export function minutesToTime(m) {
  var h = Math.floor(m / 60);
  var mm = m % 60;
  return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
}

export function formatDateKey(date) {
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1);
  var d = String(date.getDate());
  return y + '-' + (m.length < 2 ? '0' + m : m) + '-' + (d.length < 2 ? '0' + d : d);
}

// working値が「出勤」を表すかどうかを判定します(Firestoreのbool、
// スプレッドシート由来の'TRUE'文字列のどちらにも対応)。
export function isWorkingValue(v) {
  if (v === true) { return true; }
  return String(v).toUpperCase() === 'TRUE';
}

// スタッフのシフトドキュメントID(Firestore)を組み立てます。
// 同じ内容で再保存したときに重複が増えないよう、決まった形式にしています。
export function buildWeeklyShiftId(staffName, weekday) {
  return staffName + '__weekly__' + weekday;
}
export function buildExceptionShiftId(staffName, dateKey) {
  return staffName + '__exception__' + dateKey;
}

// 指定スタッフの、指定日の勤務時間を返します(休みの場合は null)。
// shiftRows: シフトの一覧(Firestoreのshiftsコレクションのドキュメントの配列)
//   - type: 'weekly'(曜日ごとの基本パターン) または 'exception'(個別の休み・特別出勤)
//   - exception は weekly より優先されます
export function getStaffShiftForDate(shiftRows, staffName, date) {
  var dateKey = formatDateKey(date);
  var weekday = WEEKDAY_JP[date.getDay()];

  var exception = (shiftRows || []).filter(function (r) {
    return r.staffName === staffName && r.type === 'exception' && r.date === dateKey;
  })[0];
  if (exception) {
    if (!isWorkingValue(exception.working)) { return null; }
    if (!exception.start || !exception.end) { return null; }
    return { start: exception.start, end: exception.end };
  }

  var weekly = (shiftRows || []).filter(function (r) {
    return r.staffName === staffName && r.type === 'weekly' && r.weekday === weekday;
  })[0];
  if (!weekly || !isWorkingValue(weekly.working)) { return null; }
  if (!weekly.start || !weekly.end) { return null; }
  return { start: weekly.start, end: weekly.end };
}

// 勤務時間から、既に入っている予約(所要時間込み)を差し引いた「空いている時間帯」の配列を返します。
// 戻り値の例: [[開始分, 終了分], ...]
export function getFreeRanges(shift, bookingsForStaffAndDate) {
  if (!shift) { return []; }
  var shiftStart = timeToMinutes(shift.start);
  var shiftEnd = timeToMinutes(shift.end);

  var busy = (bookingsForStaffAndDate || [])
    .map(function (b) {
      var start = timeToMinutes(b.time);
      var end = start + (b.durationMinutes || FALLBACK_DURATION_MINUTES);
      return [start, end];
    })
    .sort(function (a, b) { return a[0] - b[0]; });

  var free = [];
  var cursor = shiftStart;
  busy.forEach(function (range) {
    if (range[0] > cursor) { free.push([cursor, Math.min(range[0], shiftEnd)]); }
    if (range[1] > cursor) { cursor = range[1]; }
  });
  if (cursor < shiftEnd) { free.push([cursor, shiftEnd]); }

  return free.filter(function (r) { return r[1] > r[0]; });
}

// 空き時間帯の配列から、所要時間(durationMinutes)がちょうど収まる開始時刻を
// slotStepMinutes刻みで列挙します。
export function getBookableSlots(freeRanges, durationMinutes, slotStepMinutes) {
  var step = slotStepMinutes || 30;
  var slots = [];
  (freeRanges || []).forEach(function (range) {
    var start = range[0];
    var rem = start % step;
    if (rem !== 0) { start += (step - rem); }
    for (var t = start; t + durationMinutes <= range[1]; t += step) {
      slots.push(minutesToTime(t));
    }
  });
  return slots;
}

// 指定日について、各スタッフの予約可能な時間帯と、
// 「誰でもいいので空いていればOK」な時間帯(おまかせ用)をまとめて計算します。
//
// opts.shiftRows: スタッフシフト用シートの内容
// opts.staffNames: 対象スタッフ名の配列
// opts.bookings: その日の既存予約(キャンセル済みは呼び出し側で除外しておくこと)
//   各要素: { staffName, time, durationMinutes }
// opts.date: Dateオブジェクト
// opts.durationMinutes: これから予約したいメニューの所要時間
// opts.slotStepMinutes: 何分刻みで枠を区切るか(省略時30分)
export function getAvailabilityForDate(opts) {
  var shiftRows = opts.shiftRows || [];
  var staffNames = opts.staffNames || [];
  var bookings = opts.bookings || [];
  var date = opts.date;
  var durationMinutes = opts.durationMinutes || FALLBACK_DURATION_MINUTES;
  var slotStepMinutes = opts.slotStepMinutes || 30;

  var byStaff = {};
  staffNames.forEach(function (name) {
    var shift = getStaffShiftForDate(shiftRows, name, date);
    var bookingsForStaff = bookings.filter(function (b) { return b.staffName === name; });
    var free = getFreeRanges(shift, bookingsForStaff);
    byStaff[name] = getBookableSlots(free, durationMinutes, slotStepMinutes);
  });

  var anySet = {};
  Object.keys(byStaff).forEach(function (name) {
    byStaff[name].forEach(function (t) { anySet[t] = true; });
  });
  var anySlots = Object.keys(anySet).sort();

  return { byStaff: byStaff, anySlots: anySlots };
}

// その日に、1人でも空いているスタッフがいるかどうか(カレンダーの「空きなし」表示用)
export function hasAnyAvailability(availability) {
  return availability.anySlots.length > 0;
}
