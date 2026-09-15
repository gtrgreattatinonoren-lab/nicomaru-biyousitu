(function () {
  'use strict';

  var STATUS_LABELS = {
    pending: '受付待ち',
    confirmed: '確定',
    completed: '完了',
    cancelled: 'キャンセル'
  };
  var WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

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

    if (statusFilter) {
      statusFilter.addEventListener('click', function (e) {
        var btn = e.target.closest('.filter-btn');
        if (!btn) { return; }
        currentFilter = btn.getAttribute('data-status');
        statusFilter.querySelectorAll('.filter-btn').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        renderBookings();
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

        return '<div class="booking-card status-' + escapeHTML(b.status) + '">' +
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
      }, function (err) {
        console.error('予約一覧の取得に失敗しました:', err);
      });
    }

    mod.onAuthStateChanged(mod.auth, function (user) {
      if (user) {
        loginView.hidden = true;
        dashboardView.hidden = false;
        logoutBtn.hidden = false;
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
