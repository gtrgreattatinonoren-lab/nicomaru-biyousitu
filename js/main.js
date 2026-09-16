(function () {
  'use strict';

  // ==========================================================================
  // スプレッドシート連携データ
  // GitHub Actions(.github/workflows/sync-sheets.yml)がGoogleスプレッドシートの
  // 内容を定期的に data/*.json に変換してくれるので、サイト側は同じオリジンの
  // JSONファイルを読むだけです(ブラウザから直接Googleに読みに行かないため安定します)。
  // ==========================================================================
  var MENU_JSON_URL = 'data/menu.json';
  var SHOP_JSON_URL = 'data/shop.json';
  var STORE_INFO_JSON_URL = 'data/store-info.json';
  var STAFF_JSON_URL = 'data/staff.json';
  var SITE_TEXT_JSON_URL = 'data/site-text.json';

  var MENU_ICONS = {
    'カット': '✂️',
    'カラー': '🎨',
    'パーマ': '💫',
    'トリートメント': '💆'
  };
  var DEFAULT_MENU_ICON = '✨';
  var SHOP_IMG_CLASSES = ['shop-img-1', 'shop-img-2', 'shop-img-3'];

  function formatYen(price) {
    var n = parseInt(String(price).replace(/[^0-9]/g, ''), 10);
    if (isNaN(n)) { return price; }
    return '¥' + n.toLocaleString('ja-JP');
  }

  function fetchJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) { throw new Error('HTTP ' + res.status); }
      return res.json();
    });
  }

  function showSyncNote(id) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = '🔄 スプレッドシートの最新情報を表示しています';
      el.classList.add('visible');
    }
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el && value) { el.textContent = value; }
  }

  // メニュー・料金セクションをスプレッドシートの内容で描画
  function renderMenu(rows) {
    var grid = document.getElementById('menuGrid');
    if (!grid || !rows.length) { return; }

    var categories = [];
    var byCategory = {};
    rows.forEach(function (row) {
      var cat = row.category || 'メニュー';
      if (!byCategory[cat]) { byCategory[cat] = []; categories.push(cat); }
      byCategory[cat].push(row);
    });

    var html = categories.map(function (cat) {
      var icon = MENU_ICONS[cat] || DEFAULT_MENU_ICON;
      var items = byCategory[cat].map(function (item) {
        var note = item.note ? '(' + item.note + ')' : '';
        return '<li><span>' + escapeHTML(item.name) + escapeHTML(note) + '</span>' +
          '<span class="price">' + escapeHTML(formatYen(item.price)) + '〜</span></li>';
      }).join('');
      return '<div class="menu-block reveal in-view">' +
        '<h3>' + icon + ' ' + escapeHTML(cat) + '</h3>' +
        '<ul class="menu-list">' + items + '</ul></div>';
    }).join('');

    grid.innerHTML = html;
    showSyncNote('menuSyncNote');
  }

  // 物販セクションをスプレッドシートの内容で描画
  function renderShop(rows) {
    var grid = document.getElementById('shopGrid');
    if (!grid || !rows.length) { return; }

    var html = rows.map(function (item, idx) {
      var imgStyle = item.image_url
        ? ' style="background-image:url(\'' + escapeHTML(item.image_url) + '\')"'
        : '';
      var imgClass = item.image_url ? '' : SHOP_IMG_CLASSES[idx % SHOP_IMG_CLASSES.length];
      var note = item.note ? '<br><small>' + escapeHTML(item.note) + '</small>' : '';
      return '<div class="shop-card reveal in-view">' +
        '<div class="shop-img ' + imgClass + '"' + imgStyle + '></div>' +
        '<h3>' + escapeHTML(item.name) + '</h3>' +
        '<p class="shop-desc">' + escapeHTML(item.description || '') + note + '</p>' +
        '<span class="shop-price">' + escapeHTML(formatYen(item.price)) + '</span></div>';
    }).join('');

    grid.innerHTML = html;
    showSyncNote('shopSyncNote');
  }

  // 店舗情報(住所・電話・営業時間など)をスプレッドシートの内容で反映
  function renderStoreInfo(rows) {
    if (!rows.length) { return; }
    var info = {};
    rows.forEach(function (r) { info[r.key] = r.value; });

    setText('infoStoreName', info['店名']);

    if (info['郵便番号'] || info['住所']) {
      var addrEl = document.getElementById('infoAddress');
      if (addrEl) {
        addrEl.innerHTML = escapeHTML(info['郵便番号'] || '') + '<br>' + escapeHTML(info['住所'] || '');
      }
    }

    setText('infoHours', info['営業時間']);
    setText('infoHolidays', info['定休日']);
    setText('infoParking', info['駐車場']);

    if (info['電話番号']) {
      var telHref = 'tel:' + info['電話番号'].replace(/[^0-9]/g, '');
      ['infoPhone', 'heroCallBtn', 'accessCallBtn', 'contactPhoneLink'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) { el.setAttribute('href', telHref); }
      });
      setText('infoPhone', info['電話番号']);
      setText('contactPhoneNumber', info['電話番号']);
    }
    setText('contactPhoneHours', info['電話受付時間'] ? ('受付時間 ' + info['電話受付時間']) : '');

    setText('contactLineId', info['LINE_ID']);
    setText('contactLineHours', info['LINE_受付時間']);

    if (info['Instagram']) {
      setText('contactInstagramId', info['Instagram']);
      var igLink = document.getElementById('contactInstagramLink');
      if (igLink) {
        igLink.setAttribute('href', 'https://www.instagram.com/' + info['Instagram'].replace(/^@/, '') + '/');
      }
    }

    if (info['地図検索キーワード'] || info['住所']) {
      var mapFrame = document.getElementById('accessMapFrame');
      if (mapFrame) {
        var q = info['地図検索キーワード'] || info['住所'];
        mapFrame.setAttribute('src', 'https://www.google.com/maps?q=' + encodeURIComponent(q) + '&output=embed');
      }
    }

    showSyncNote('infoSyncNote');
  }

  // スタッフ紹介セクションをスプレッドシートの内容で描画
  function renderStaff(rows) {
    var grid = document.getElementById('staffGrid');
    if (!grid || !rows.length) { return; }

    var html = rows.map(function (member) {
      var photo = member.photo_url ? escapeHTML(member.photo_url) : 'assets/img/logo.png';
      return '<div class="staff-card reveal in-view">' +
        '<img src="' + photo + '" alt="スタッフ ' + escapeHTML(member.name) + '" class="staff-avatar">' +
        '<h3>' + escapeHTML(member.name) + ' <span>' + escapeHTML(member.role || '') + '</span></h3>' +
        '<p>「' + escapeHTML(member.comment || '') + '」</p></div>';
    }).join('');

    grid.innerHTML = html;
    showSyncNote('staffSyncNote');
  }

  // トップページ内の見出し・説明文をスプレッドシートの内容で反映
  function renderSiteText(rows) {
    if (!rows.length) { return; }
    var text = {};
    rows.forEach(function (r) { text[r.key] = r.value; });

    setText('heroTitle', text['hero_title']);
    setText('heroLead', text['hero_lead']);
    setText('conceptLead', text['concept_lead']);
    setText('conceptCard1Title', text['concept_card1_title']);
    setText('conceptCard1Text', text['concept_card1_text']);
    setText('conceptCard2Title', text['concept_card2_title']);
    setText('conceptCard2Text', text['concept_card2_text']);
    setText('conceptCard3Title', text['concept_card3_title']);
    setText('conceptCard3Text', text['concept_card3_text']);
    setText('conceptCard4Title', text['concept_card4_title']);
    setText('conceptCard4Text', text['concept_card4_text']);
    setText('menuLead', text['menu_lead']);
    setText('menuNote', text['menu_note']);
    setText('shopLead', text['shop_lead']);
    setText('staffLead', text['staff_lead']);
    setText('galleryLead', text['gallery_lead']);
    setText('contactLead', text['contact_lead']);
  }

  function escapeHTML(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  fetchJSON(MENU_JSON_URL).then(renderMenu).catch(function (err) {
    console.warn('メニューデータの読み込みに失敗しました(仮の内容を表示中):', err);
  });
  fetchJSON(SHOP_JSON_URL).then(renderShop).catch(function (err) {
    console.warn('物販データの読み込みに失敗しました(仮の内容を表示中):', err);
  });
  fetchJSON(STORE_INFO_JSON_URL).then(renderStoreInfo).catch(function (err) {
    console.warn('店舗情報データの読み込みに失敗しました(仮の内容を表示中):', err);
  });
  fetchJSON(STAFF_JSON_URL).then(renderStaff).catch(function (err) {
    console.warn('スタッフ情報データの読み込みに失敗しました(仮の内容を表示中):', err);
  });
  fetchJSON(SITE_TEXT_JSON_URL).then(renderSiteText).catch(function (err) {
    console.warn('サイト文言データの読み込みに失敗しました(仮の内容を表示中):', err);
  });

  // モバイルナビゲーションの開閉
  var navToggle = document.getElementById('navToggle');
  var nav = document.getElementById('nav');

  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      navToggle.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
    });

    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'メニューを開く');
      });
    });
  }

  // スクロールで要素をふわっと表示
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    reveals.forEach(function (el) { observer.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in-view'); });
  }

  // トップへ戻るボタン
  var toTop = document.getElementById('toTop');
  if (toTop) {
    window.addEventListener('scroll', function () {
      toTop.classList.toggle('visible', window.scrollY > 480);
    });
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // フッターの年号を自動更新
  var yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
})();
