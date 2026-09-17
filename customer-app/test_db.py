# -*- coding: utf-8 -*-
"""db.py の動作確認テスト。python3 test_db.py で実行できます。"""

import os
import tempfile
import unittest

import db


class TestCustomerDB(unittest.TestCase):
    def setUp(self):
        fd, self.path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        os.remove(self.path)
        self.conn = db.init_db(self.path)

    def tearDown(self):
        self.conn.close()
        for suffix in ("", "-wal", "-shm"):
            p = self.path + suffix
            if os.path.exists(p):
                os.remove(p)

    def test_add_and_get_customer(self):
        cid = db.add_customer(self.conn, {"name": "山田花子", "phone": "090-1111-2222"})
        row = db.get_customer(self.conn, cid)
        self.assertEqual(row["name"], "山田花子")
        self.assertEqual(row["phone"], "090-1111-2222")
        self.assertEqual(row["memo_hobby"], "")

    def test_add_customer_requires_name(self):
        with self.assertRaises(ValueError):
            db.add_customer(self.conn, {"name": "  "})

    def test_update_customer(self):
        cid = db.add_customer(self.conn, {"name": "山田花子"})
        db.update_customer(self.conn, cid, {"name": "山田花子", "memo_hobby": "旅行"})
        row = db.get_customer(self.conn, cid)
        self.assertEqual(row["memo_hobby"], "旅行")

    def test_delete_customer_cascades_visits(self):
        cid = db.add_customer(self.conn, {"name": "山田花子"})
        db.add_visit(self.conn, cid, {"visit_date": "2026-09-01", "menu": "カット"})
        db.delete_customer(self.conn, cid)
        self.assertIsNone(db.get_customer(self.conn, cid))
        rows = self.conn.execute("SELECT * FROM visits").fetchall()
        self.assertEqual(len(rows), 0)

    def test_list_customers_search(self):
        db.add_customer(self.conn, {"name": "山田花子", "kana": "ヤマダハナコ", "phone": "090-1111-2222"})
        db.add_customer(self.conn, {"name": "鈴木一郎", "kana": "スズキイチロウ", "phone": "080-3333-4444"})

        self.assertEqual(len(db.list_customers(self.conn)), 2)
        self.assertEqual(len(db.list_customers(self.conn, "山田")), 1)
        self.assertEqual(len(db.list_customers(self.conn, "090")), 1)
        self.assertEqual(len(db.list_customers(self.conn, "存在しない")), 0)

    def test_visit_crud(self):
        cid = db.add_customer(self.conn, {"name": "山田花子"})
        vid = db.add_visit(self.conn, cid, {"visit_date": "2026-09-01", "menu": "カット", "staff": "よう子"})
        visits = db.list_visits(self.conn, cid)
        self.assertEqual(len(visits), 1)
        self.assertEqual(visits[0]["menu"], "カット")

        db.update_visit(self.conn, vid, {"visit_date": "2026-09-01", "menu": "カラー", "staff": "よう子", "memo": "明るめ"})
        visits = db.list_visits(self.conn, cid)
        self.assertEqual(visits[0]["menu"], "カラー")

        db.delete_visit(self.conn, vid)
        self.assertEqual(len(db.list_visits(self.conn, cid)), 0)

    def test_visit_requires_date(self):
        cid = db.add_customer(self.conn, {"name": "山田花子"})
        with self.assertRaises(ValueError):
            db.add_visit(self.conn, cid, {"visit_date": ""})

    def test_visits_ordered_newest_first(self):
        cid = db.add_customer(self.conn, {"name": "山田花子"})
        db.add_visit(self.conn, cid, {"visit_date": "2026-01-01"})
        db.add_visit(self.conn, cid, {"visit_date": "2026-06-01"})
        visits = db.list_visits(self.conn, cid)
        self.assertEqual(visits[0]["visit_date"], "2026-06-01")
        self.assertEqual(visits[1]["visit_date"], "2026-01-01")

    def test_settings_roundtrip(self):
        self.assertIsNone(db.get_setting(self.conn, "app_password_hash"))
        db.set_setting(self.conn, "app_password_hash", "abc123")
        self.assertEqual(db.get_setting(self.conn, "app_password_hash"), "abc123")
        db.set_setting(self.conn, "app_password_hash", "xyz789")
        self.assertEqual(db.get_setting(self.conn, "app_password_hash"), "xyz789")

    def test_export_csv(self):
        db.add_customer(self.conn, {"name": "山田花子", "memo_hobby": "旅行,読書"})
        csv_path = self.path + ".csv"
        db.export_customers_csv(self.conn, csv_path)
        with open(csv_path, encoding="utf-8-sig") as f:
            content = f.read()
        self.assertIn("山田花子", content)
        os.remove(csv_path)


if __name__ == "__main__":
    unittest.main()
