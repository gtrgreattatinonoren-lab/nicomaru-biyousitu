import {
  getMenuDuration,
  getStaffShiftForDate,
  getAvailabilityForDate,
  getRequiredSlotTimes,
  buildBookedSlotId,
  formatDateKey
} from './availability.js';

(function () {
  'use strict';

  var BOOKING_WINDOW_DAYS = 14;
  var SLOT_STEP_MINUTES = 30;
  var WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

  var yearEl = document.getElementById('year');
  if (yearEl) { yearEl.textContent = new Date().getFullYear(); }

  var configWarning = document.getElementById('configWarning');
  var bookingSteps = document.getElementById('bookingSteps');
  var menuSelect = document.getElementById('menuSelect');
  var menuDurationHint = document.getElementById('menuDurationHint');
  var staffSelect = document.getElementById('staffSelect');
  var availabilitySection = document.getElementById('availabilitySection');
  var availabilityList = document.getElementById('availabilityList');
  var availabilityMessage = document.getElementById('availabilityMessage');
  var refreshAvailabilityBtn = document.getElementById('refreshAvailabilityBtn');
  var bookingForm = document.getElementById('bookingForm');
  var bookingSummary = document.getElementById('bookingSummary');
  var changeSlotBtn = document.getElementById('changeSlotBtn');
  var submitBtn = document.getElementById('submitBtn');
  var formMessage = document.getElementById('formMessage');

  function escapeHTML(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function showUnavailable(text) {
    if (configWarning) {
      configWarning.textContent = text;
      configWarning.hidden = false;
    }
    if (bookingSteps) { bookingSteps.hidden = true; }
  }

  function fetchJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) { throw new Error('HTTP ' + res.status); }
      return res.json();
    });
  }

  import('./firebase-init.js').then(function (mod) {
    if (!mod.isFirebaseConfigured()) {
      showUnavailable('⚠️ ネット予約フォームは現在準備中です。恐れ入りますが、お電話またはLINEでご予約ください。');
      return;
    }
    initBooking(mod);
  }).catch(function (err) {
    console.error('予約システムの読み込みに失敗しました:', err);
    showUnavailable('⚠️ 現在ネット予約フォームにアクセスできません。恐れ入りますが、お電話またはLINEでご予約ください。');
  });

  function initBooking(mod) {
    var menuRows = [];
    var staffNames = [];
    var shiftRows = [];
    var bookedSlots = [];
    var selectedSlot = null; // { date, time, durationMinutes, staffCandidates: [...] }

    function currentMenu() {
      var idx = menuSelect.value;
      return idx === '' ? null : menuRows[Number(idx)];
    }

    function loadMenu() {
      return fetchJSON('data/menu.json').then(function (rows) {
        menuRows = rows;
        var byCategory = {};
        var order = [];
        rows.forEach(function (r, idx) {
          var cat = r.category || 'メニュー';
          if (!byCategory[cat]) { byCategory[cat] = []; order.push(cat); }
          byCategory[cat].push(idx);
        });
        var html = '<option value="" disabled selected>選択してください</option>';
        order.forEach(function (cat) {
          html += '<optgroup label="' + escapeHTML(cat) + '">';
          byCategory[cat].forEach(function (idx) {
            var r = rows[idx];
            html += '<option value="' + idx + '">' + escapeHTML(r.name) + '</option>';
          });
          html += '</optgroup>';
        });
        menuSelect.innerHTML = html;
      }).catch(function (err) {
        console.error('メニューの読み込みに失敗しました:', err);
      });
    }

    function loadStaff() {
      return fetchJSON('data/staff.json').then(function (rows) {
        staffNames = rows.map(function (r) { return r.name; }).filter(Boolean);
        var html = '<option value="">おまかせ(空いているスタッフにお任せします)</option>';
        staffNames.forEach(function (name) {
          html += '<option value="' + escapeHTML(name) + '">' + escapeHTML(name) + '</option>';
        });
        staffSelect.innerHTML = html;
      }).catch(function (err) {
        console.error('スタッフ情報の読み込みに失敗しました:', err);
      });
    }

    function loadShiftsAndBookedSlots() {
      var tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      var tomorrowKey = formatDateKey(tomorrow);

      var shiftsPromise = mod.getDocs(mod.collection(mod.db, 'shifts')).then(function (snapshot) {
        shiftRows = snapshot.docs.map(function (d) { return d.data(); });
      });

      var bookedQuery = mod.query(mod.collection(mod.db, 'booked_slots'), mod.where('date', '>=', tomorrowKey));
      var bookedPromise = mod.getDocs(bookedQuery).then(function (snapshot) {
        bookedSlots = snapshot.docs.map(function (d) { return d.data(); });
      });

      return Promise.all([shiftsPromise, bookedPromise]);
    }

    function dateRange() {
      var dates = [];
      var d = new Date();
      d.setDate(d.getDate() + 1);
      for (var i = 0; i < BOOKING_WINDOW_DAYS; i++) {
        dates.push(new Date(d.getFullYear(), d.getMonth(), d.getDate() + i));
      }
      return dates;
    }

    function bookingsForDate(dateKey) {
      return bookedSlots
        .filter(function (s) { return s.date === dateKey; })
        .map(function (s) { return { staffName: s.staffName, time: s.time, durationMinutes: SLOT_STEP_MINUTES }; });
    }

    function renderAvailability() {
      var menu = currentMenu();
      if (!menu) {
        availabilitySection.hidden = true;
        return;
      }
      availabilitySection.hidden = false;

      var duration = getMenuDuration(menu.category);
      menuDurationHint.textContent = '所要時間の目安: 約' + duration + '分';

      var candidateStaffList = staffSelect.value ? [staffSelect.value] : staffNames;

      var html = dateRange().map(function (date) {
        var dateKey = formatDateKey(date);
        var availability = getAvailabilityForDate({
          shiftRows: shiftRows,
          staffNames: candidateStaffList,
          bookings: bookingsForDate(dateKey),
          date: date,
          durationMinutes: duration,
          slotStepMinutes: SLOT_STEP_MINUTES
        });

        var label = (date.getMonth() + 1) + '/' + date.getDate() + '(' + WEEKDAYS[date.getDay()] + ')';

        if (!availability.anySlots.length) {
          return '<div class="availability-day is-empty" data-date="' + dateKey + '">' +
            '<div class="availability-day-header">' + label + '</div>' +
            '<div class="availability-day-none">空きなし</div></div>';
        }

        var slotsHTML = availability.anySlots.map(function (time) {
          var staffHere = staffNames.filter(function (name) {
            return availability.byStaff[name] && availability.byStaff[name].indexOf(time) !== -1;
          });
          return '<button type="button" class="slot-btn" data-date="' + dateKey + '" data-time="' + time +
            '" data-staff="' + escapeHTML(staffHere.join(',')) + '">' + time + '</button>';
        }).join('');

        return '<div class="availability-day" data-date="' + dateKey + '">' +
          '<div class="availability-day-header">' + label + '</div>' +
          '<div class="availability-slots">' + slotsHTML + '</div></div>';
      }).join('');

      availabilityList.innerHTML = html;
    }

    menuSelect.addEventListener('change', renderAvailability);
    staffSelect.addEventListener('change', renderAvailability);

    if (refreshAvailabilityBtn) {
      refreshAvailabilityBtn.addEventListener('click', function () {
        availabilityMessage.textContent = '最新の空き状況を確認しています…';
        availabilityMessage.className = 'form-message';
        loadShiftsAndBookedSlots().then(function () {
          availabilityMessage.textContent = '';
          renderAvailability();
        }).catch(function (err) {
          console.error('空き状況の更新に失敗しました:', err);
          availabilityMessage.textContent = '空き状況の更新に失敗しました。時間をおいて再度お試しください。';
          availabilityMessage.className = 'form-message form-message-error';
        });
      });
    }

    availabilityList.addEventListener('click', function (e) {
      var btn = e.target.closest('.slot-btn');
      if (!btn) { return; }
      var menu = currentMenu();
      if (!menu) { return; }

      availabilityList.querySelectorAll('.slot-btn').forEach(function (b) { b.classList.remove('is-selected'); });
      btn.classList.add('is-selected');

      var staffCandidates = btn.getAttribute('data-staff').split(',').filter(Boolean);
      selectedSlot = {
        date: btn.getAttribute('data-date'),
        time: btn.getAttribute('data-time'),
        durationMinutes: getMenuDuration(menu.category),
        staffCandidates: staffCandidates,
        menuName: menu.name,
        menuCategory: menu.category || 'その他',
        staffLabel: staffSelect.value || 'おまかせ'
      };

      var dateObj = new Date(selectedSlot.date + 'T00:00:00');
      var dateLabel = (dateObj.getMonth() + 1) + '/' + dateObj.getDate() + '(' + WEEKDAYS[dateObj.getDay()] + ')';
      bookingSummary.textContent = dateLabel + ' ' + selectedSlot.time + '〜 / ' + menu.name +
        '(約' + selectedSlot.durationMinutes + '分) / 担当: ' + selectedSlot.staffLabel;

      bookingForm.hidden = false;
      formMessage.textContent = '';
      bookingForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    if (changeSlotBtn) {
      changeSlotBtn.addEventListener('click', function () {
        bookingForm.hidden = true;
        selectedSlot = null;
        availabilityList.querySelectorAll('.slot-btn').forEach(function (b) { b.classList.remove('is-selected'); });
        availabilitySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    function setFormMessage(text, type) {
      formMessage.textContent = text;
      formMessage.className = 'form-message' + (type ? ' form-message-' + type : '');
    }

    bookingForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var honeypot = document.getElementById('website');
      if (honeypot && honeypot.value) { return; }

      if (!selectedSlot) {
        setFormMessage('ご希望の日時を選択してください。', 'error');
        return;
      }

      var name = document.getElementById('name').value.trim();
      var phone = document.getElementById('phone').value.trim();
      var notes = document.getElementById('notes').value.trim();

      if (!name || !phone) {
        setFormMessage('未入力の項目があります。ご確認ください。', 'error');
        return;
      }

      submitBtn.disabled = true;
      setFormMessage('送信中です…', '');

      var requiredTimes = getRequiredSlotTimes(selectedSlot.time, selectedSlot.durationMinutes, SLOT_STEP_MINUTES);
      var candidates = selectedSlot.staffCandidates.slice();
      var bookingRef = mod.doc(mod.collection(mod.db, 'bookings'));

      mod.runTransaction(mod.db, function (transaction) {
        return Promise.resolve().then(function () {
          var checks = candidates.map(function (staffName) {
            var slots = requiredTimes.map(function (t) {
              return { time: t, ref: mod.doc(mod.db, 'booked_slots', buildBookedSlotId(selectedSlot.date, staffName, t)) };
            });
            return Promise.all(slots.map(function (s) { return transaction.get(s.ref); })).then(function (snaps) {
              var allFree = snaps.every(function (snap) { return !snap.exists(); });
              return allFree ? { staffName: staffName, slots: slots } : null;
            });
          });

          return checks.reduce(function (chain, checkPromise) {
            return chain.then(function (found) {
              if (found) { return found; }
              return checkPromise;
            });
          }, Promise.resolve(null));
        }).then(function (assigned) {
          if (!assigned) {
            throw new Error('SLOT_TAKEN');
          }

          var bookingData = {
            name: name,
            phone: phone,
            date: selectedSlot.date,
            time: selectedSlot.time,
            menu: selectedSlot.menuName,
            category: selectedSlot.menuCategory,
            durationMinutes: selectedSlot.durationMinutes,
            staffName: assigned.staffName,
            status: 'pending',
            createdAt: mod.serverTimestamp()
          };
          if (notes) { bookingData.notes = notes; }
          transaction.set(bookingRef, bookingData);

          assigned.slots.forEach(function (s) {
            transaction.set(s.ref, {
              date: selectedSlot.date,
              staffName: assigned.staffName,
              time: s.time,
              bookingId: bookingRef.id
            });
          });
        });
      }).then(function () {
        setFormMessage('予約リクエストを受け付けました。空き状況を確認のうえ、店舗よりご連絡いたします。', 'success');
        bookingForm.reset();
        bookingForm.hidden = true;
        selectedSlot = null;
        submitBtn.disabled = false;
        loadShiftsAndBookedSlots().then(renderAvailability);
      }).catch(function (err) {
        submitBtn.disabled = false;
        if (err && err.message === 'SLOT_TAKEN') {
          setFormMessage('ちょうどその枠は埋まってしまいました。恐れ入りますが、別の日時をお選びください。', 'error');
          bookingForm.hidden = true;
          loadShiftsAndBookedSlots().then(renderAvailability);
          return;
        }
        console.error('予約の送信に失敗しました:', err);
        setFormMessage('送信できませんでした。恐れ入りますが、お電話でご連絡いただくか、時間をおいて再度お試しください。', 'error');
      });
    });

    Promise.all([loadMenu(), loadStaff(), loadShiftsAndBookedSlots()]).catch(function (err) {
      console.error('予約フォームの初期化に失敗しました:', err);
      setFormMessage('読み込みに失敗しました。時間をおいて再度お試しください。', 'error');
    });
  }
})();
