# -*- coding: utf-8 -*-
"""起動パスワード関連のロジックのテスト(ダイアログはモックで代用)"""

import os
import sys
import tempfile
import tkinter as tk
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(__file__))

import db
import app


class TestAuthFlow(unittest.TestCase):
    def setUp(self):
        fd, self.path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        os.remove(self.path)
        self.conn = db.init_db(self.path)
        self.root = tk.Tk()
        self.root.withdraw()

    def tearDown(self):
        self.root.destroy()
        self.conn.close()
        for suffix in ("", "-wal", "-shm"):
            p = self.path + suffix
            if os.path.exists(p):
                os.remove(p)

    def test_no_password_set_allows_through(self):
        self.assertTrue(app.check_password(self.root, self.conn))

    def test_correct_password_allows_through(self):
        db.set_setting(self.conn, "app_password_hash", app.hash_password("himitsu123"))
        with mock.patch("app.simpledialog.askstring", return_value="himitsu123"):
            self.assertTrue(app.check_password(self.root, self.conn))

    def test_wrong_then_correct_password(self):
        db.set_setting(self.conn, "app_password_hash", app.hash_password("himitsu123"))
        with mock.patch("app.simpledialog.askstring", side_effect=["wrong", "himitsu123"]), \
             mock.patch("app.messagebox.showerror"):
            self.assertTrue(app.check_password(self.root, self.conn))

    def test_cancel_dialog_blocks_access(self):
        db.set_setting(self.conn, "app_password_hash", app.hash_password("himitsu123"))
        with mock.patch("app.simpledialog.askstring", return_value=None):
            self.assertFalse(app.check_password(self.root, self.conn))

    def test_set_password_dialog_mismatch_does_not_save(self):
        with mock.patch("app.simpledialog.askstring", side_effect=["abc", "xyz"]), \
             mock.patch("app.messagebox.showerror") as mock_error:
            app.set_password_dialog(self.root, self.conn)
        mock_error.assert_called_once()
        self.assertIsNone(db.get_setting(self.conn, "app_password_hash"))

    def test_set_password_dialog_match_saves_hash(self):
        with mock.patch("app.simpledialog.askstring", side_effect=["abc123", "abc123"]), \
             mock.patch("app.messagebox.showinfo"):
            app.set_password_dialog(self.root, self.conn)
        self.assertEqual(db.get_setting(self.conn, "app_password_hash"), app.hash_password("abc123"))

    def test_offer_set_password_skips_if_already_set(self):
        db.set_setting(self.conn, "app_password_hash", "already-set")
        with mock.patch("app.messagebox.askyesno") as mock_ask:
            app.offer_set_password(self.root, self.conn)
        mock_ask.assert_not_called()

    def test_offer_set_password_declined(self):
        with mock.patch("app.messagebox.askyesno", return_value=False):
            app.offer_set_password(self.root, self.conn)
        self.assertIsNone(db.get_setting(self.conn, "app_password_hash"))


if __name__ == "__main__":
    unittest.main()
