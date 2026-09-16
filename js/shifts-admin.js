import {
  buildWeeklyShiftId,
  buildExceptionShiftId,
  isWorkingValue
} from './availability.js';

(function () {
  'use strict';

  var WEEKDAY_ORDER = ['月', '火', '水', '木', '金', '土', '日'];

  var configWarning = document.getElementById('configWarning');
  var loginView = document.getElementById('loginView');
  var dashboardView = document.getElementById('dashboardView');
  var loginForm = document.getElementById('loginForm');
  var loginBtn = document.getElementById('loginBtn');
  var loginMessage = document.getElementById('loginMessage');
  var logoutBtn = document.getElementById('logoutBtn');
  var staffTabs = document.getElementById('staffTabs');
  var shiftForm = document.getElementById('shiftForm');
  var shiftType = document.getElementById('shiftType');
  var weekdayRow = document.getElementById('weekdayRow');
  var shiftWeekday = document.getElementById('shiftWeekday');
  var dateRow = document.getElementById('dateRow');
  var shiftDate = document.getElementById('shiftDate');
  var shiftWorking = document.getElementById('shiftWorking');
  var timeRow = document.getElementById('timeRow');
  var shiftStart = document.getElementById('shiftStart');
  var shiftEnd = document.getElementById('shiftEnd');
  var shiftMessage = document.getElementById('shiftMessage');
  var shiftSubmitBtn = document.getElementById('shiftSubmitBtn');
  var weeklyList = document.getElementById('weeklyList');
  var exceptionList = document.getElementById('exceptionList');
  var exceptionEmpty = document.getElementById('exceptionEmpty');

  function showUnavailable(text) {
    if (configWarning) {
      configWarning.textContent = text;
      configWarning.hidden = false;
    }
    if (loginView) { loginView.hidden = true; }
  }

  function escapeHTML(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function buildTimeOptions(select, startHour, endHour) {
    select.innerHTML = '';
    for (var h = startHour; h <= endHour; h++) {
      [0, 30].forEach(function (m) {
        if (h === endHour && m > 0) { return; }
        var v = (h < 10 ? '0' : '') + h + ':' + (m === 0 ? '00' : '30');
        var opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        select.appendChild(opt);
      });
    }
  }

  import('./firebase-init.js').then(function (mod) {
    if (!mod.isFirebaseConfigured()) {
      showUnavailable('⚠️ Firebaseの設定がまだ完了していません。README.mdの手順に沿って設定してください。');
      return;
    }
    initShifts(mod);
  }).catch(function (err) {
    console.error('シフト管理システムの読み込みに失敗しました:', err);
    showUnavailable('⚠️ 現在システムにアクセスできません。ネットワーク状況をご確認のうえ、再度お試しください。');
  });

  function loginErrorMessage(err) {
    var code = err && err.code;
    if (code === 'auth/invalid-email') { return 'メールアドレスの形式が正しくありません。'; }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'メールアドレスまたはパスワードが違います。';
    }
    if (code === 'auth/too-many-requests') { return '試行回数が多すぎます。しばらくしてから再度お試しください。'; }
    return 'ログインできませんでした。';
  }

  function initShifts(mod) {
    buildTimeOptions(shiftStart, 7, 23);
    buildTimeOptions(shiftEnd, 7, 23);

    var staffNames = [];
    var allShifts = [];
    var currentStaff = null;
    var unsubscribe = null;

    if (loginForm) {
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = document.getElementById('email').value.trim();
        var password = document.getElementById('password').value;
        loginBtn.disabled = true;
        loginMessage.textContent = '';
        mod.signInWithEmailAndPassword(mod.auth, email, password).catch(function (err) {
          loginMessage.textContent = loginErrorMessage(err);
          loginMessage.className = 'form-message form-message-error';
        }).finally(function () {
          loginBtn.disabled = false;
        });
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        mod.signOut(mod.auth);
      });
    }

    function toggleFormFieldsForType() {
      var isWeekly = shiftType.value === 'weekly';
      weekdayRow.hidden = !isWeekly;
      dateRow.hidden = isWeekly;
    }
    function toggleFormFieldsForWorking() {
      timeRow.hidden = shiftWorking.value !== 'true';
    }
    shiftType.addEventListener('change', toggleFormFieldsForType);
    shiftWorking.addEventListener('change', toggleFormFieldsForWorking);
    toggleFormFieldsForType();
    toggleFormFieldsForWorking();

    function renderStaffTabs() {
      staffTabs.innerHTML = staffNames.map(function (name) {
        return '<button type="button" class="view-btn' + (name === currentStaff ? ' is-active' : '') +
          '" data-staff="' + escapeHTML(name) + '">' + escapeHTML(name) + '</button>';
      }).join('');
    }

    staffTabs.addEventListener('click', function (e) {
      var btn = e.target.closest('.view-btn');
      if (!btn) { return; }
      currentStaff = btn.getAttribute('data-staff');
      renderStaffTabs();
      renderLists();
    });

    function findShift(type, weekdayOrDate) {
      return allShifts.filter(function (s) {
        if (s.staffName !== currentStaff || s.type !== type) { return false; }
        return type === 'weekly' ? s.weekday === weekdayOrDate : s.date === weekdayOrDate;
      })[0];
    }

    function fillFormFromShift(shift, fallback) {
      shiftType.value = shift.type;
      toggleFormFieldsForType();
      if (shift.type === 'weekly') { shiftWeekday.value = shift.weekday; }
      else { shiftDate.value = shift.date; }
      shiftWorking.value = isWorkingValue(shift.working) ? 'true' : 'false';
      toggleFormFieldsForWorking();
      if (shift.start) { shiftStart.value = shift.start; }
      if (shift.end) { shiftEnd.value = shift.end; }
      shiftMessage.textContent = '';
      shiftForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function renderLists() {
      if (!currentStaff) {
        weeklyList.innerHTML = '';
        exceptionList.innerHTML = '';
        exceptionEmpty.hidden = true;
        return;
      }

      weeklyList.innerHTML = WEEKDAY_ORDER.map(function (wd) {
        var shift = findShift('weekly', wd);
        var working = shift ? isWorkingValue(shift.working) : false;
        var label = wd + '曜日';
        var timeText = working ? (escapeHTML(shift.start) + '〜' + escapeHTML(shift.end)) :
          (shift ? '休み' : '未設定(休み扱い)');
        return '<div class="shift-item ' + (working ? 'is-working' : 'is-off') + '" data-type="weekly" data-key="' + escapeHTML(wd) + '">' +
          '<span class="shift-item-label">' + escapeHTML(label) + '</span>' +
          '<span class="shift-item-time">' + timeText + '</span>' +
          '</div>';
      }).join('');

      var exceptions = allShifts.filter(function (s) {
        return s.staffName === currentStaff && s.type === 'exception';
      }).sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });

      exceptionEmpty.hidden = exceptions.length > 0;
      exceptionList.innerHTML = exceptions.map(function (s) {
        var working = isWorkingValue(s.working);
        var timeText = working ? (escapeHTML(s.start) + '〜' + escapeHTML(s.end)) : '休み';
        return '<div class="shift-item ' + (working ? 'is-working' : 'is-off') + '" data-type="exception" data-key="' + escapeHTML(s.date) + '">' +
          '<span class="shift-item-label">' + escapeHTML(s.date) + '</span>' +
          '<span class="shift-item-time">' + timeText + '</span>' +
          '<span class="shift-item-actions">' +
          '<button type="button" class="btn btn-outline btn-sm btn-danger" data-delete-date="' + escapeHTML(s.date) + '">削除</button>' +
          '</span></div>';
      }).join('');
    }

    weeklyList.addEventListener('click', function (e) {
      var item = e.target.closest('.shift-item');
      if (!item) { return; }
      var wd = item.getAttribute('data-key');
      var shift = findShift('weekly', wd);
      if (shift) {
        fillFormFromShift(shift);
      } else {
        shiftType.value = 'weekly';
        toggleFormFieldsForType();
        shiftWeekday.value = wd;
        shiftWorking.value = 'true';
        toggleFormFieldsForWorking();
        shiftForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    exceptionList.addEventListener('click', function (e) {
      var deleteBtn = e.target.closest('button[data-delete-date]');
      if (deleteBtn) {
        var date = deleteBtn.getAttribute('data-delete-date');
        if (!window.confirm(date + ' の特別休み・時間変更を削除します。よろしいですか?')) { return; }
        mod.deleteDoc(mod.doc(mod.db, 'shifts', buildExceptionShiftId(currentStaff, date))).catch(function (err) {
          console.error('削除に失敗しました:', err);
          window.alert('削除に失敗しました。');
        });
        return;
      }
      var item = e.target.closest('.shift-item');
      if (!item) { return; }
      var date = item.getAttribute('data-key');
      var shift = findShift('exception', date);
      if (shift) { fillFormFromShift(shift); }
    });

    shiftForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!currentStaff) {
        shiftMessage.textContent = 'スタッフのタブを選んでください。';
        shiftMessage.className = 'form-message form-message-error';
        return;
      }

      var type = shiftType.value;
      var working = shiftWorking.value === 'true';

      if (working && shiftStart.value >= shiftEnd.value) {
        shiftMessage.textContent = '終了時刻は開始時刻より後にしてください。';
        shiftMessage.className = 'form-message form-message-error';
        return;
      }
      if (type === 'exception' && !shiftDate.value) {
        shiftMessage.textContent = '日付を選択してください。';
        shiftMessage.className = 'form-message form-message-error';
        return;
      }

      var data = {
        staffName: currentStaff,
        type: type,
        working: working,
        updatedAt: mod.serverTimestamp()
      };
      var docId;
      if (type === 'weekly') {
        data.weekday = shiftWeekday.value;
        docId = buildWeeklyShiftId(currentStaff, shiftWeekday.value);
      } else {
        data.date = shiftDate.value;
        docId = buildExceptionShiftId(currentStaff, shiftDate.value);
      }
      if (working) {
        data.start = shiftStart.value;
        data.end = shiftEnd.value;
      }

      shiftSubmitBtn.disabled = true;
      mod.setDoc(mod.doc(mod.db, 'shifts', docId), data).then(function () {
        shiftMessage.textContent = '登録しました。';
        shiftMessage.className = 'form-message form-message-success';
      }).catch(function (err) {
        console.error('シフトの登録に失敗しました:', err);
        shiftMessage.textContent = '登録に失敗しました。時間をおいて再度お試しください。';
        shiftMessage.className = 'form-message form-message-error';
      }).finally(function () {
        shiftSubmitBtn.disabled = false;
      });
    });

    function startListening() {
      var q = mod.query(mod.collection(mod.db, 'shifts'));
      unsubscribe = mod.onSnapshot(q, function (snapshot) {
        allShifts = snapshot.docs.map(function (d) { return d.data(); });
        renderLists();
      }, function (err) {
        console.error('シフトの取得に失敗しました:', err);
      });
    }

    function loadStaffNames() {
      fetch('../data/staff.json', { cache: 'no-store' }).then(function (res) {
        if (!res.ok) { throw new Error('HTTP ' + res.status); }
        return res.json();
      }).then(function (rows) {
        staffNames = rows.map(function (r) { return r.name; }).filter(Boolean);
        if (!currentStaff && staffNames.length) { currentStaff = staffNames[0]; }
        renderStaffTabs();
        renderLists();
      }).catch(function (err) {
        console.error('スタッフ一覧の取得に失敗しました:', err);
      });
    }

    mod.onAuthStateChanged(mod.auth, function (user) {
      if (user) {
        loginView.hidden = true;
        dashboardView.hidden = false;
        logoutBtn.hidden = false;
        loadStaffNames();
        if (!unsubscribe) { startListening(); }
      } else {
        loginView.hidden = false;
        dashboardView.hidden = true;
        logoutBtn.hidden = true;
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        allShifts = [];
      }
    });
  }
})();
