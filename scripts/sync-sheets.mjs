#!/usr/bin/env node
// ==========================================================================
// Googleスプレッドシートの内容を data/*.json に変換するスクリプト
// ==========================================================================
// GitHub Actions (.github/workflows/sync-sheets.yml) から定期的に実行されます。
// ブラウザから直接Googleに読みに行く方式(CORS・リダイレクトの影響を受けやすい)
// をやめて、サーバー側(GitHubのビルド環境)であらかじめJSONに変換しておき、
// サイトは同じオリジンのJSONファイルを読むだけにすることで安定させています。
// ==========================================================================
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const SHEETS = {
  'menu.json': 'https://docs.google.com/spreadsheets/d/1RImllNJFktSgC_on3u8TwsrB2Ml9VY_REjnZurUeWXQ/gviz/tq?tqx=out:csv&gid=0',
  'shop.json': 'https://docs.google.com/spreadsheets/d/1tUm9vcwxFQcmePR6c52iKO0d6asNkS28m19FpAoTXGs/gviz/tq?tqx=out:csv&gid=0',
  'store-info.json': 'https://docs.google.com/spreadsheets/d/18XFhut26DxMbK4YUnTcoa2FV4pW5U-bembK3WdokPdo/gviz/tq?tqx=out:csv&gid=0',
  'staff.json': 'https://docs.google.com/spreadsheets/d/1tT4duASTJzG3G8KtR0s5cxJbaK10KS79YgGdAB428K8/gviz/tq?tqx=out:csv&gid=0'
};

// CSVテキストを配列に変換(ダブルクォート・カンマ・改行に対応)
function parseCSV(text) {
  var rows = [];
  var row = [];
  var field = '';
  var inQuotes = false;
  text = text.replace(/\r\n/g, '\n');
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  if (!rows.length) { return []; }
  var headers = rows[0].map(function (h) { return h.trim(); });
  return rows.slice(1)
    .filter(function (r) { return r.some(function (v) { return v.trim() !== ''; }); })
    .map(function (r) {
      var obj = {};
      headers.forEach(function (h, idx) { obj[h] = (r[idx] || '').trim(); });
      return obj;
    });
}

async function fetchSheetRows(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (nicomaru-biyousitu sync-sheets)' }
  });
  if (!res.ok) {
    throw new Error('HTTP ' + res.status + ' for ' + url);
  }
  const text = await res.text();
  return parseCSV(text);
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });

  for (const [file, url] of Object.entries(SHEETS)) {
    const rows = await fetchSheetRows(url);
    const filePath = path.join(DATA_DIR, file);
    await writeFile(filePath, JSON.stringify(rows, null, 2) + '\n', 'utf8');
    console.log('Wrote data/' + file + ' (' + rows.length + ' rows)');
  }
}

main().catch(function (err) {
  console.error('スプレッドシートの同期に失敗しました:', err);
  process.exit(1);
});
