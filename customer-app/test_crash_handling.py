# -*- coding: utf-8 -*-
"""
起動直後に予期しないエラーが起きた時、画面が一瞬で消えて原因不明にならないかの確認。
(「すぐ閉じられる」という問い合わせを受けて追加したテスト)
"""

import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(__file__))

import app


class TestCrashHandling(unittest.TestCase):
    def setUp(self):
        self.log_path = app.resource_path("error_log.txt")
        if os.path.exists(self.log_path):
            os.remove(self.log_path)

    def tearDown(self):
        if os.path.exists(self.log_path):
            os.remove(self.log_path)

    def test_crash_message_writes_log_and_shows_dialog(self):
        with mock.patch("app.messagebox.showerror") as mock_error:
            app._show_crash_message("Traceback (most recent call last):\n  ...\nValueError: test")

        mock_error.assert_called_once()
        self.assertTrue(os.path.exists(self.log_path))
        with open(self.log_path, encoding="utf-8") as f:
            content = f.read()
        self.assertIn("ValueError: test", content)

    def test_crash_message_falls_back_to_console_if_tk_unavailable(self):
        with mock.patch("app.tk.Tk", side_effect=RuntimeError("no display")), \
             mock.patch("builtins.input", return_value=""):
            # 例外が外に漏れず、代わりにコンソール出力にフォールバックすることだけ確認する
            app._show_crash_message("some error")
        self.assertTrue(os.path.exists(self.log_path))


if __name__ == "__main__":
    unittest.main()
