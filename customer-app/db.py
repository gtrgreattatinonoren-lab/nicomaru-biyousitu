# -*- coding: utf-8 -*-
"""
顧客管理アプリ - データベース処理(見た目には関係ない部分だけをまとめたファイル)

このファイルは画面(app.py)から呼び出される「データの読み書き」だけを行います。
画面のコードと分けてあるのは、動作確認(テスト)をしやすくするためです。
"""

import sqlite3
from datetime import datetime

CUSTOMER_FIELDS = [
    "name", "kana", "phone", "birthday",
    "hair_type", "chemical_notes", "allergy",
    "memo_hobby", "memo_family", "memo_work", "memo_pet", "memo_topic", "memo_free",
]

VISIT_FIELDS = ["visit_date", "menu", "staff", "memo"]

SCHEMA = """
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    kana TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    birthday TEXT DEFAULT '',
    hair_type TEXT DEFAULT '',
    chemical_notes TEXT DEFAULT '',
    allergy TEXT DEFAULT '',
    memo_hobby TEXT DEFAULT '',
    memo_family TEXT DEFAULT '',
    memo_work TEXT DEFAULT '',
    memo_pet TEXT DEFAULT '',
    memo_topic TEXT DEFAULT '',
    memo_free TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    visit_date TEXT NOT NULL,
    menu TEXT DEFAULT '',
    staff TEXT DEFAULT '',
    memo TEXT DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_visits_customer ON visits(customer_id);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


def get_connection(db_path):
    """DBファイルへの接続を作る(複数台のPCが同時に開いてもロック待ちで壊れにくいようWALモードにする)"""
    conn = sqlite3.connect(db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db(db_path):
    conn = get_connection(db_path)
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


def _now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def add_customer(conn, data):
    if not data.get("name", "").strip():
        raise ValueError("お名前は必須です")
    now = _now()
    values = [data.get(f, "") for f in CUSTOMER_FIELDS]
    cols = ", ".join(CUSTOMER_FIELDS)
    placeholders = ", ".join(["?"] * len(CUSTOMER_FIELDS))
    cur = conn.execute(
        "INSERT INTO customers ({0}, created_at, updated_at) VALUES ({1}, ?, ?)".format(cols, placeholders),
        values + [now, now],
    )
    conn.commit()
    return cur.lastrowid


def update_customer(conn, customer_id, data):
    if not data.get("name", "").strip():
        raise ValueError("お名前は必須です")
    assignments = ", ".join(["{0} = ?".format(f) for f in CUSTOMER_FIELDS])
    values = [data.get(f, "") for f in CUSTOMER_FIELDS]
    conn.execute(
        "UPDATE customers SET {0}, updated_at = ? WHERE id = ?".format(assignments),
        values + [_now(), customer_id],
    )
    conn.commit()


def delete_customer(conn, customer_id):
    conn.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
    conn.commit()


def get_customer(conn, customer_id):
    row = conn.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
    return dict(row) if row else None


def list_customers(conn, search=""):
    search = (search or "").strip()
    if search:
        like = "%{0}%".format(search)
        rows = conn.execute(
            "SELECT id, name, kana, phone FROM customers "
            "WHERE name LIKE ? OR kana LIKE ? OR phone LIKE ? "
            "ORDER BY kana, name",
            (like, like, like),
        ).fetchall()
    else:
        rows = conn.execute("SELECT id, name, kana, phone FROM customers ORDER BY kana, name").fetchall()
    return [dict(r) for r in rows]


def add_visit(conn, customer_id, data):
    if not data.get("visit_date", "").strip():
        raise ValueError("来店日は必須です")
    values = [data.get(f, "") for f in VISIT_FIELDS]
    cols = ", ".join(VISIT_FIELDS)
    placeholders = ", ".join(["?"] * len(VISIT_FIELDS))
    cur = conn.execute(
        "INSERT INTO visits (customer_id, {0}, created_at) VALUES (?, {1}, ?)".format(cols, placeholders),
        [customer_id] + values + [_now()],
    )
    conn.commit()
    return cur.lastrowid


def update_visit(conn, visit_id, data):
    assignments = ", ".join(["{0} = ?".format(f) for f in VISIT_FIELDS])
    values = [data.get(f, "") for f in VISIT_FIELDS]
    conn.execute(
        "UPDATE visits SET {0} WHERE id = ?".format(assignments),
        values + [visit_id],
    )
    conn.commit()


def delete_visit(conn, visit_id):
    conn.execute("DELETE FROM visits WHERE id = ?", (visit_id,))
    conn.commit()


def list_visits(conn, customer_id):
    rows = conn.execute(
        "SELECT * FROM visits WHERE customer_id = ? ORDER BY visit_date DESC, id DESC",
        (customer_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_setting(conn, key, default=None):
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def set_setting(conn, key, value):
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )
    conn.commit()


def export_customers_csv(conn, csv_path):
    """お客様の基本情報+カルテ情報をCSVに書き出す(バックアップ・Excelで見る用)"""
    import csv

    rows = conn.execute("SELECT * FROM customers ORDER BY kana, name").fetchall()
    headers = ["id"] + CUSTOMER_FIELDS + ["created_at", "updated_at"]
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        for row in rows:
            writer.writerow([row[h] for h in headers])
