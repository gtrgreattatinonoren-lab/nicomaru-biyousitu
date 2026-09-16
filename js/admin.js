(function () {
  'use strict';

  var STATUS_LABELS = {
    pending: '受付待ち',
    confirmed: '確定',
    completed: '完了',
    cancelled: 'キャンセル'
  };
  var WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
  var CALENDAR_START_MIN = 9 * 60;
  var CALENDAR_END_MIN = 20 * 60;
  var SLOT_MINUTES = 30;

  var configWarning = document.getElementById('configWarning');
  var loginView = document.getElementById('loginView');
  var dashboardView = document.getElementById('dashboardView');
  var loginForm = document.getElementById('loginForm');
  var loginBtn = document.getElementById('loginBtn');
  var loginMessage = document.getElementById('loginMessage');
  var logoutBtn = document.getElementById('logoutBtn');
  var bookingList = document.getElementById('bookingList');
  var emptyMessage = document.getElementById('emptyMessage');
  var statusFilter = document.getElementById('statusFilter');
  var viewToggle = document.getElementById('viewToggle');
  var calendarView = document.getElementById('calendarView');
  var listView = document.getElementById('listView');
  var calendarTable = document.getElementById('calendarTable');
  var weekLabel = document.getElementById('weekLabel');
  var prevWeekBtn = document.getElementById('prevWeekBtn');
  var nextWeekBtn = document.getElementById('nextWeekBtn');
  var todayBtn = document.getElementById('todayBtn');

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

  function formatDate(dateStr) {
    var parts = (dateStr || '').split('-');
    if (parts.length !== 3) { return dateStr || ''; }
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return parts[0] + '/' + parts[1] + '/' + parts[2] + '(' + WEEKDAYS[d.getDay()] + ')';
  }

  // ---------- 週間スケジュール用の日付・時間ヘルパー ----------
  function getMonday(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var day = d.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }
  function addDays(date, n) {
    var d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function formatDateKey(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }
  function formatMD(date) {
    return (date.getMonth() + 1) + '/' + date.getDate();
  }
  function minutesToHHMM(m) {
    return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
  }
  function timeToMinutes(t) {
    var parts = (t || '').split(':');
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) { return CALENDAR_START_MIN; }
    return h * 60 + m;
  }
  function floorToSlot(t) {
    var mins = timeToMinutes(t);
    if (mins < CALENDAR_START_MIN) { mins = CALENDAR_START_MIN; }
    if (mins >= CALENDAR_END_MIN) { mins = CALENDAR_END_MIN - SLOT_MINUTES; }
    mins -= mins % SLOT_MINUTES;
    return minutesToHHMM(mins);
  }
  function buildTimeSlots() {
    var slots = [];
    for (var m = CALENDAR_START_MIN; m < CALENDAR_END_MIN; m += SLOT_MINUTES) {
      slots.push(minutesToHHMM(m));
    }
    return slots;
  }

  // Firebase SDKはCDNから読み込むため、ネットワーク不調・広告ブロッカーなどで
  // 読み込みに失敗する可能性があります。動的importで読み込み、失敗時はログイン画面を止めて
  // 案内文を表示します。
  import('./firebase-init.js').then(function (mod) {
    if (!mod.isFirebaseConfigured()) {
      showUnavailable('⚠️ Firebaseの設定がまだ完了していません。README.mdの手順に沿って設定してください。');
      return;
    }
    initAdmin(mod);
  }).catch(function (err) {
    console.error('予約管理システムの読み込みに失敗しました:', err);
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

  function initAdmin(mod) {
    var allBookings = [];
    var currentFilter = 'all';
    var currentView = 'calendar';
    var currentWeekStart = getMonday(new Date());
    var unsubscribe = null;

    function setView(view) {
      currentView = view;
      if (calendarView) { calendarView.hidden = view !== 'calendar'; }
      if (listView) { listView.hidden = view !== 'list'; }
      if (viewToggle) {
        viewToggle.querySelectorAll('.view-btn').forEach(function (b) {
          b.classList.toggle('is-active', b.getAttribute('data-view') === view);
        });
      }
    }

    if (viewToggle) {
      viewToggle.addEventListener('click', function (e) {
        var btn = e.target.closest('.view-btn');
        if (!btn) { return; }
        setView(btn.getAttribute('data-view'));
      });
    }

    if (prevWeekBtn) {
      prevWeekBtn.addEventListener('click', function () {
        currentWeekStart = addDays(currentWeekStart, -7);
        renderCalendar();
      });
    }
    if (nextWeekBtn) {
      nextWeekBtn.addEventListener('click', function () {
        currentWeekStart = addDays(currentWeekStart, 7);
        renderCalendar();
      });
    }
    if (todayBtn) {
      todayBtn.addEventListener('click', function () {
        currentWeekStart = getMonday(new Date());
        renderCalendar();
      });
    }

    function showBookingInList(id) {
      var booking = allBookings.filter(function (b) { return b.id === id; })[0];
      if (booking && currentFilter !== 'all' && booking.status !== currentFilter) {
        currentFilter = 'all';
        statusFilter.querySelectorAll('.filter-btn').forEach(function (b) {
          b.classList.toggle('is-active', b.getAttribute('data-status') === 'all');
        });
        renderBookings();
      }
      setView('list');
      window.requestAnimationFrame(function () {
        var card = document.getElementById('booking-' + id);
        if (!card) { return; }
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('highlight');
        window.setTimeout(function () { card.classList.remove('highlight'); }, 1600);
      });
    }

    if (calendarTable) {
      calendarTable.addEventListener('click', function (e) {
        var btn = e.target.closest('.calendar-booking');
        if (!btn) { return; }
        showBookingInList(btn.getAttribute('data-id'));
      });
    }

    function renderCalendar() {
      if (!calendarTable) { return; }

      var rows = allBookings.filter(function (b) {
        return currentFilter === 'all' || b.status === currentFilter;
      });

      var days = [];
      for (var i = 0; i < 7; i++) { days.push(addDays(currentWeekStart, i)); }
      var todayKey = formatDateKey(new Date());

      if (weekLabel) {
        weekLabel.textContent = formatMD(days[0]) + '(' + WEEKDAYS[days[0].getDay()] + ') 〜 ' +
          formatMD(days[6]) + '(' + WEEKDAYS[days[6].getDay()] + ')';
      }

      var byDateSlot = {};
      rows.forEach(function (b) {
        if (!b.date) { return; }
        var slot = floorToSlot(b.time);
        byDateSlot[b.date] = byDateSlot[b.date] || {};
        byDateSlot[b.date][slot] = byDateSlot[b.date][slot] || [];
        byDateSlot[b.date][slot].push(b);
      });

      var slots = buildTimeSlots();

      var thead = '<thead><tr><th></th>' + days.map(function (d) {
        var key = formatDateKey(d);
        return '<th class="' + (key === todayKey ? 'is-today' : '') + '">' +
          formatMD(d) + '(' + WEEKDAYS[d.getDay()] + ')</th>';
      }).join('') + '</tr></thead>';

      var tbody = '<tbody>' + slots.map(function (slot) {
        var cells = days.map(function (d) {
          var key = formatDateKey(d);
          var here = (byDateSlot[key] && byDateSlot[key][slot]) || [];
          if (!here.length) { return '<td class="calendar-slot"></td>'; }
          var content = here.map(function (b) {
            var titleText = b.time + ' ' + b.name + '様 / ' + b.menu;
            return '<button type="button" class="calendar-booking status-' + escapeHTML(b.status) +
              '" data-id="' + escapeHTML(b.id) + '" title="' + escapeHTML(titleText) + '">' +
              escapeHTML(b.time) + ' ' + escapeHTML(b.name) + '</button>';
          }).join('');
          return '<td class="calendar-slot">' + content + '</td>';
        }).join('');
        return '<tr><td class="calendar-time-cell">' + slot + '</td>' + cells + '</tr>';
      }).join('') + '</tbody>';

      calendarTable.innerHTML = thead + tbody;
    }

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

    if (statusFilter) {
      statusFilter.addEventListener('click', function (e) {
        var btn = e.target.closest('.filter-btn');
        if (!btn) { return; }
        currentFilter = btn.getAttribute('data-status');
        statusFilter.querySelectorAll('.filter-btn').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        renderBookings();
        renderCalendar();
      });
    }

    function renderBookings() {
      if (!bookingList) { return; }
      var rows = allBookings.filter(function (b) {
        return currentFilter === 'all' || b.status === currentFilter;
      });

      if (!rows.length) {
        bookingList.innerHTML = '';
        emptyMessage.hidden = false;
        return;
      }
      emptyMessage.hidden = true;

      bookingList.innerHTML = rows.map(function (b) {
        var actions = '';
        if (b.status === 'pending') {
          actions += '<button type="button" class="btn btn-primary btn-sm" data-action="confirmed" data-id="' + b.id + '">確定にする</button>';
          actions += '<button type="button" class="btn btn-outline btn-sm" data-action="cancelled" data-id="' + b.id + '">キャンセル</button>';
        } else if (b.status === 'confirmed') {
          actions += '<button type="button" class="btn btn-primary btn-sm" data-action="completed" data-id="' + b.id + '">完了にする</button>';
          actions += '<button type="button" class="btn btn-outline btn-sm" data-action="cancelled" data-id="' + b.id + '">キャンセル</button>';
        }
        actions += '<button type="button" class="btn btn-outline btn-sm btn-danger" data-action="delete" data-id="' + b.id + '">削除</button>';

        return '<div class="booking-card status-' + escapeHTML(b.status) + '" id="booking-' + escapeHTML(b.id) + '">' +
          '<div class="booking-card-main">' +
          '<span class="booking-status-badge">' + escapeHTML(STATUS_LABELS[b.status] || b.status) + '</span>' +
          '<h3>' + formatDate(b.date) + ' ' + escapeHTML(b.time) + '〜</h3>' +
          '<p><strong>' + escapeHTML(b.name) + '</strong> 様(<a href="tel:' + escapeHTML((b.phone || '').replace(/[^0-9]/g, '')) + '">' + escapeHTML(b.phone) + '</a>)</p>' +
          '<p>メニュー: ' + escapeHTML(b.menu) + '</p>' +
          (b.notes ? '<p class="booking-notes">備考: ' + escapeHTML(b.notes) + '</p>' : '') +
          '</div>' +
          '<div class="booking-card-actions">' + actions + '</div>' +
          '</div>';
      }).join('');
    }

    if (bookingList) {
      bookingList.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-action]');
        if (!btn) { return; }
        var id = btn.getAttribute('data-id');
        var action = btn.getAttribute('data-action');

        if (action === 'delete') {
          if (!window.confirm('この予約を削除します。よろしいですか?(元に戻せません)')) { return; }
          mod.deleteDoc(mod.doc(mod.db, 'bookings', id)).catch(function (err) {
            console.error('削除に失敗しました:', err);
            window.alert('削除に失敗しました。');
          });
          return;
        }

        mod.updateDoc(mod.doc(mod.db, 'bookings', id), { status: action }).catch(function (err) {
          console.error('更新に失敗しました:', err);
          window.alert('更新に失敗しました。');
        });
      });
    }

    function startListening() {
      var q = mod.query(mod.collection(mod.db, 'bookings'), mod.orderBy('date'));
      unsubscribe = mod.onSnapshot(q, function (snapshot) {
        allBookings = snapshot.docs.map(function (d) {
          var data = d.data();
          return {
            id: d.id,
            name: data.name || '',
            phone: data.phone || '',
            date: data.date || '',
            time: data.time || '',
            menu: data.menu || '',
            notes: data.notes || '',
            status: data.status || 'pending'
          };
        }).sort(function (a, b) {
          if (a.date !== b.date) { return a.date < b.date ? -1 : 1; }
          return a.time < b.time ? -1 : (a.time > b.time ? 1 : 0);
        });
        renderBookings();
        renderCalendar();
      }, function (err) {
        console.error('予約一覧の取得に失敗しました:', err);
      });
    }

    mod.onAuthStateChanged(mod.auth, function (user) {
      if (user) {
        loginView.hidden = true;
        dashboardView.hidden = false;
        logoutBtn.hidden = false;
        setView('calendar');
        renderCalendar();
        if (!unsubscribe) { startListening(); }
      } else {
        loginView.hidden = false;
        dashboardView.hidden = true;
        logoutBtn.hidden = true;
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        allBookings = [];
      }
    });
  }
})();
