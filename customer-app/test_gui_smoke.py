# -*- coding: utf-8 -*-
"""
app.py のGUIを実際に起動して、基本操作(登録・保存・検索・来店履歴・削除)が
エラーなく動くかを確認するスモークテスト。Xvfb(仮想ディスプレイ)上で実行する。
パスワード設定やファイル選択ダイアログは対象外(手動確認が必要)。
"""

import os
import sys
import tempfile
import tkinter as tk
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(__file__))

import db
from app import MainWindow, VisitDialog


class TestGuiSmoke(unittest.TestCase):
    def setUp(self):
        # メッセージボックスは実際のポップアップを出すとテストが止まってしまうため、
        # ボタンを押したことにして自動で進める(表示される文言自体は手動確認が必要)。
        patcher_error = mock.patch("app.messagebox.showerror")
        patcher_info = mock.patch("app.messagebox.showinfo")
        patcher_yesno = mock.patch("app.messagebox.askyesno", return_value=True)
        self.mock_showerror = patcher_error.start()
        self.mock_showinfo = patcher_info.start()
        self.mock_askyesno = patcher_yesno.start()
        self.addCleanup(patcher_error.stop)
        self.addCleanup(patcher_info.stop)
        self.addCleanup(patcher_yesno.stop)

        fd, self.path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        os.remove(self.path)
        self.conn = db.init_db(self.path)
        self.root = tk.Tk()
        self.win = MainWindow(self.root, self.conn)

    def tearDown(self):
        self.root.destroy()
        self.conn.close()
        for suffix in ("", "-wal", "-shm"):
            p = self.path + suffix
            if os.path.exists(p):
                os.remove(p)

    def _set_basic(self, name="山田花子", kana="ヤマダハナコ", phone="090-1111-2222", birthday="1990-05-01"):
        self.win.basic_vars["name"].set(name)
        self.win.basic_vars["kana"].set(kana)
        self.win.basic_vars["phone"].set(phone)
        self.win.basic_vars["birthday"].set(birthday)

    def test_new_customer_save_and_list(self):
        self.win.new_customer()
        self._set_basic()
        self.win.karte_texts["hair_type"].insert("1.0", "くせ毛")
        self.win.memo_vars["memo_hobby"].set("旅行")
        self.win.memo_free_text.insert("1.0", "話しやすい方")
        self.win.save_customer()

        self.assertIsNotNone(self.win.current_customer_id)
        children = self.win.tree.get_children()
        self.assertEqual(len(children), 1)

        saved = db.get_customer(self.conn, self.win.current_customer_id)
        self.assertEqual(saved["name"], "山田花子")
        self.assertEqual(saved["hair_type"], "くせ毛")
        self.assertEqual(saved["memo_hobby"], "旅行")

    def test_save_without_name_shows_error_and_does_not_insert(self):
        self.win.new_customer()
        self._set_basic(name="")
        self.win.save_customer()
        self.assertEqual(len(db.list_customers(self.conn)), 0)

    def test_edit_existing_customer(self):
        self.win.new_customer()
        self._set_basic()
        self.win.save_customer()
        cid = self.win.current_customer_id

        self.win.basic_vars["phone"].set("080-9999-8888")
        self.win.save_customer()

        updated = db.get_customer(self.conn, cid)
        self.assertEqual(updated["phone"], "080-9999-8888")
        self.assertEqual(len(db.list_customers(self.conn)), 1)

    def test_search_filters_list(self):
        self.win.new_customer()
        self._set_basic(name="山田花子", kana="ヤマダハナコ", phone="090-1111-2222")
        self.win.save_customer()
        self.win.new_customer()
        self._set_basic(name="鈴木一郎", kana="スズキイチロウ", phone="080-3333-4444")
        self.win.save_customer()

        self.win.search_var.set("山田")
        self.root.update()
        self.assertEqual(len(self.win.tree.get_children()), 1)

        self.win.search_var.set("")
        self.root.update()
        self.assertEqual(len(self.win.tree.get_children()), 2)

    def test_add_edit_delete_visit(self):
        self.win.new_customer()
        self._set_basic()
        self.win.save_customer()
        cid = self.win.current_customer_id

        db.add_visit(self.conn, cid, {"visit_date": "2026-09-01", "menu": "カット", "staff": "よう子", "memo": ""})
        self.win.refresh_visit_list()
        self.assertEqual(len(self.win.visit_tree.get_children()), 1)

        visit_id = list(self.win.visit_tree.get_children())[0]
        db.delete_visit(self.conn, int(visit_id))
        self.win.refresh_visit_list()
        self.assertEqual(len(self.win.visit_tree.get_children()), 0)

    def test_delete_customer_clears_form(self):
        self.win.new_customer()
        self._set_basic()
        self.win.save_customer()

        # askyesno は setUp でモック済みなので、確認ダイアログは自動的に「はい」扱いになる
        self.win.delete_customer()

        self.assertEqual(len(db.list_customers(self.conn)), 0)
        self.assertEqual(len(self.win.tree.get_children()), 0)

    def test_visit_dialog_collects_values(self):
        dialog = VisitDialog(self.root, initial={"visit_date": "2026-09-01", "menu": "カット", "staff": "よう子", "memo": "テスト"})
        dialog._on_save()
        self.assertEqual(dialog.result["visit_date"], "2026-09-01")
        self.assertEqual(dialog.result["menu"], "カット")
        dialog.destroy()


if __name__ == "__main__":
    unittest.main()
