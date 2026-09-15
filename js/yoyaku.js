(function () {
  'use strict';

  var yearEl = document.getElementById('year');
  if (yearEl) { yearEl.textContent = new Date().getFullYear(); }

  var dateInput = document.getElementById('date');
  if (dateInput) {
    var today = new Date();
    var yyyy = today.getFullYear();
    var mm = String(today.getMonth() + 1).padStart(2, '0');
    var dd = String(today.getDate()).padStart(2, '0');
    dateInput.min = yyyy + '-' + mm + '-' + dd;
  }

  var form = document.getElementById('bookingForm');
  var submitBtn = document.getElementById('submitBtn');
  var messageEl = document.getElementById('formMessage');
  var configWarning = document.getElementById('configWarning');

  function setMessage(text, type) {
    if (!messageEl) { return; }
    messageEl.textContent = text;
    messageEl.className = 'form-message' + (type ? ' form-message-' + type : '');
  }

  function showUnavailable(text) {
    if (configWarning) {
      configWarning.textContent = text;
      configWarning.hidden = false;
    }
    if (form) { form.hidden = true; }
  }

  // Firebase SDKはCDNから読み込むため、ネットワーク不調・広告ブロッカーなどで
  // 読み込みに失敗する可能性があります。動的importで読み込み、失敗時は
  // フォームを止めて案内文を表示します(何も起きないまま送信ボタンが
  // 押せてしまう、という状態を避けるためです)。
  import('./firebase-init.js').then(function (mod) {
    if (!mod.isFirebaseConfigured()) {
      showUnavailable('⚠️ ネット予約フォームは現在準備中です。恐れ入りますが、お電話またはLINEでご予約ください。');
      return;
    }

    if (!form) { return; }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // ハニーポット(見えない項目)に入力があった場合はbotとみなし、何もせず終了
      var honeypot = document.getElementById('website');
      if (honeypot && honeypot.value) {
        return;
      }

      var data = {
        name: document.getElementById('name').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        date: document.getElementById('date').value,
        time: document.getElementById('time').value,
        menu: document.getElementById('menu').value,
        status: 'pending',
        createdAt: mod.serverTimestamp()
      };

      var notes = document.getElementById('notes').value.trim();
      if (notes) { data.notes = notes; }

      if (!data.name || !data.phone || !data.date || !data.time || !data.menu) {
        setMessage('未入力の項目があります。ご確認ください。', 'error');
        return;
      }

      submitBtn.disabled = true;
      setMessage('送信中です…', '');

      mod.addDoc(mod.collection(mod.db, 'bookings'), data).then(function () {
        setMessage('予約リクエストを受け付けました。空き状況を確認のうえ、店舗よりご連絡いたします。', 'success');
        form.reset();
        submitBtn.disabled = false;
      }).catch(function (err) {
        console.error('予約の送信に失敗しました:', err);
        setMessage('送信できませんでした。恐れ入りますが、お電話でご連絡いただくか、時間をおいて再度お試しください。', 'error');
        submitBtn.disabled = false;
      });
    });
  }).catch(function (err) {
    console.error('予約システムの読み込みに失敗しました:', err);
    showUnavailable('⚠️ 現在ネット予約フォームにアクセスできません。恐れ入りますが、お電話またはLINEでご予約ください。');
  });
})();
