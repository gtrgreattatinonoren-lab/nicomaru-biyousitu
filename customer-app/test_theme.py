# -*- coding: utf-8 -*-
"""
テーマ(色・フォント)が実際の起動手順どおりに適用されてもエラーにならないかの確認。
(theme.apply_theme() を呼んでから画面を組み立てる、main() と同じ順番でテストする)
"""

import os
import sys
import tempfile
import tkinter as tk
import unittest

sys.path.insert(0, os.path.dirname(__file__))

import db
import theme
from app import MainWindow, VisitDialog


class TestTheme(unittest.TestCase):
    def setUp(self):
        fd, self.path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        os.remove(self.path)
        self.conn = db.init_db(self.path)
        self.root = tk.Tk()

    def tearDown(self):
        self.root.destroy()
        self.conn.close()
        for suffix in ("", "-wal", "-shm"):
            p = self.path + suffix
            if os.path.exists(p):
                os.remove(p)

    def test_apply_theme_then_build_main_window(self):
        fonts = theme.apply_theme(self.root)
        self.assertTrue(fonts["family"])

        win = MainWindow(self.root, self.conn)
        # スタイルを指定しているボタン類が、未定義スタイルのままではないことを確認
        style = win.root.tk.call("ttk::style", "theme", "use")
        self.assertEqual(style, "clam")

    def test_visit_dialog_after_theme(self):
        theme.apply_theme(self.root)
        win = MainWindow(self.root, self.conn)
        win.new_customer()
        win.basic_vars["name"].set("山田花子")
        win.save_customer()

        dialog = VisitDialog(self.root)
        self.assertEqual(str(dialog.cget("bg")), theme.CREAM_LIGHT)
        dialog.destroy()

    def test_pick_font_family_falls_back_when_none_available(self):
        family = theme.pick_font_family(self.root, preferred=["存在しないフォント名12345"])
        self.assertEqual(family, "TkDefaultFont")


if __name__ == "__main__":
    unittest.main()
