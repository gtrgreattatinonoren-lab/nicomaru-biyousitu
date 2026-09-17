# -*- coding: utf-8 -*-
"""
にこまる美容室 顧客カルテ管理アプリ(ローカル版)

ネットには一切つながらず、指定したデータベースファイル(.db)だけに
お客様情報を保存します。スタッフの複数パソコンで同じデータを見たい場合は、
共有フォルダの中に置いた同じファイルを指定してください。
"""

import hashlib
import os
import sys
import tkinter as tk
from datetime import datetime
from tkinter import ttk, messagebox, filedialog, simpledialog

import config
import db


def resource_path(filename):
    """アイコンなどの同梱ファイルの場所を返す(.exe化してもソースのままでも動くようにする)"""
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, filename)


def set_app_icon(root):
    try:
        root.iconbitmap(resource_path("app_icon.ico"))
    except Exception:
        pass  # Windows以外や、アイコンファイルが見つからない場合は無視してそのまま起動する

PASSWORD_SALT = "nikomaru-biyoushitsu-karte-v1"

MEMO_FIELDS = [
    ("memo_hobby", "趣味"),
    ("memo_family", "ご家族"),
    ("memo_work", "お仕事"),
    ("memo_pet", "ペット"),
    ("memo_topic", "好きな話題・エピソード"),
]

KARTE_FIELDS = [
    ("hair_type", "髪質"),
    ("chemical_notes", "薬剤配合(パーマ液・カラー剤など)"),
    ("allergy", "アレルギー・注意事項"),
]


def hash_password(password):
    return hashlib.sha256((PASSWORD_SALT + password).encode("utf-8")).hexdigest()


def choose_db_path():
    """初回起動、またはDBファイルの場所が分からなくなった時に呼ばれる設定ウィザード"""
    use_existing = messagebox.askyesno(
        "データベースの場所",
        "すでに他のパソコンでこのアプリを使っていて、\n"
        "共有フォルダなどに顧客データベースのファイルがありますか?\n\n"
        "「はい」: 既存のファイルを選ぶ\n"
        "「いいえ」: 新しく作る(初めて使うパソコンの場合)",
    )
    if use_existing:
        path = filedialog.askopenfilename(
            title="顧客データベースファイルを選んでください",
            filetypes=[("顧客データベース", "*.db"), ("すべてのファイル", "*.*")],
        )
    else:
        messagebox.showinfo(
            "保存場所の選択",
            "複数のパソコンで同じデータを見る場合は、共有フォルダの中を選んでください。\n"
            "1台のパソコンだけで使う場合は、わかりやすい場所(デスクトップなど)で構いません。",
        )
        path = filedialog.asksaveasfilename(
            title="新しい顧客データベースの保存先",
            defaultextension=".db",
            initialfile="nikomaru_customers.db",
            filetypes=[("顧客データベース", "*.db")],
        )
    return path or None


def ensure_db_path():
    path = config.get_db_path()
    if path and os.path.exists(os.path.dirname(path) or "."):
        return path
    path = choose_db_path()
    if not path:
        messagebox.showerror("終了", "データベースの場所が選ばれなかったため、アプリを終了します。")
        return None
    config.set_db_path(path)
    return path


def check_password(root, conn):
    """settingsテーブルにパスワードが設定されていれば、起動時に入力を求める"""
    stored_hash = db.get_setting(conn, "app_password_hash")
    if not stored_hash:
        return True
    for _ in range(5):
        pw = simpledialog.askstring(
            "パスワード", "起動パスワードを入力してください", show="*", parent=root
        )
        if pw is None:
            return False
        if hash_password(pw) == stored_hash:
            return True
        messagebox.showerror("エラー", "パスワードが違います。")
    return False


def offer_set_password(root, conn):
    """初めて使う人向けに、任意で起動パスワードを設定してもらう"""
    if db.get_setting(conn, "app_password_hash"):
        return
    if not messagebox.askyesno(
        "起動パスワードの設定(任意)",
        "個人情報を扱うアプリのため、起動時にパスワードを求めることができます。\n"
        "設定しますか?(あとから「設定」メニューでいつでも変更できます)",
        parent=root,
    ):
        return
    set_password_dialog(root, conn)


def set_password_dialog(root, conn):
    pw1 = simpledialog.askstring("パスワード設定", "新しいパスワードを入力してください", show="*", parent=root)
    if not pw1:
        return
    pw2 = simpledialog.askstring("パスワード設定", "確認のため、もう一度入力してください", show="*", parent=root)
    if pw1 != pw2:
        messagebox.showerror("エラー", "パスワードが一致しませんでした。設定を中止します。")
        return
    db.set_setting(conn, "app_password_hash", hash_password(pw1))
    messagebox.showinfo("完了", "起動パスワードを設定しました。")


class VisitDialog(tk.Toplevel):
    """来店履歴の追加・編集用ダイアログ"""

    def __init__(self, parent, initial=None):
        super().__init__(parent)
        self.title("来店履歴")
        self.result = None
        self.transient(parent)
        self.grab_set()

        initial = initial or {}
        ttk.Label(self, text="来店日 (例: 2026-09-17)").grid(row=0, column=0, sticky="w", padx=8, pady=4)
        self.date_var = tk.StringVar(value=initial.get("visit_date", datetime.now().strftime("%Y-%m-%d")))
        ttk.Entry(self, textvariable=self.date_var, width=30).grid(row=0, column=1, padx=8, pady=4)

        ttk.Label(self, text="メニュー").grid(row=1, column=0, sticky="w", padx=8, pady=4)
        self.menu_var = tk.StringVar(value=initial.get("menu", ""))
        ttk.Entry(self, textvariable=self.menu_var, width=30).grid(row=1, column=1, padx=8, pady=4)

        ttk.Label(self, text="担当").grid(row=2, column=0, sticky="w", padx=8, pady=4)
        self.staff_var = tk.StringVar(value=initial.get("staff", ""))
        ttk.Entry(self, textvariable=self.staff_var, width=30).grid(row=2, column=1, padx=8, pady=4)

        ttk.Label(self, text="メモ").grid(row=3, column=0, sticky="nw", padx=8, pady=4)
        self.memo_text = tk.Text(self, width=30, height=4)
        self.memo_text.insert("1.0", initial.get("memo", ""))
        self.memo_text.grid(row=3, column=1, padx=8, pady=4)

        btn_frame = ttk.Frame(self)
        btn_frame.grid(row=4, column=0, columnspan=2, pady=8)
        ttk.Button(btn_frame, text="保存", command=self._on_save).pack(side="left", padx=4)
        ttk.Button(btn_frame, text="キャンセル", command=self.destroy).pack(side="left", padx=4)

    def _on_save(self):
        if not self.date_var.get().strip():
            messagebox.showerror("エラー", "来店日を入力してください。", parent=self)
            return
        self.result = {
            "visit_date": self.date_var.get().strip(),
            "menu": self.menu_var.get().strip(),
            "staff": self.staff_var.get().strip(),
            "memo": self.memo_text.get("1.0", "end-1c").strip(),
        }
        self.destroy()


class MainWindow:
    def __init__(self, root, conn):
        self.root = root
        self.conn = conn
        self.current_customer_id = None

        root.title("にこまる美容室 顧客カルテ")
        root.geometry("1080x680")

        self._build_menu()
        self._build_layout()
        self.refresh_customer_list()

    # ---------- 画面構築 ----------
    def _build_menu(self):
        menubar = tk.Menu(self.root)
        file_menu = tk.Menu(menubar, tearoff=0)
        file_menu.add_command(label="CSVエクスポート(バックアップ)", command=self.export_csv)
        file_menu.add_separator()
        file_menu.add_command(label="終了", command=self.root.quit)
        menubar.add_cascade(label="ファイル", menu=file_menu)

        settings_menu = tk.Menu(menubar, tearoff=0)
        settings_menu.add_command(label="起動パスワードを設定/変更", command=lambda: set_password_dialog(self.root, self.conn))
        menubar.add_cascade(label="設定", menu=settings_menu)

        self.root.config(menu=menubar)

    def _build_layout(self):
        outer = ttk.Frame(self.root, padding=8)
        outer.pack(fill="both", expand=True)

        # 左側: 検索 + 顧客一覧
        left = ttk.Frame(outer, width=300)
        left.pack(side="left", fill="y", padx=(0, 8))

        search_frame = ttk.Frame(left)
        search_frame.pack(fill="x", pady=(0, 6))
        ttk.Label(search_frame, text="検索(お名前・フリガナ・電話番号)").pack(anchor="w")
        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", lambda *_: self.refresh_customer_list())
        ttk.Entry(search_frame, textvariable=self.search_var).pack(fill="x")

        self.tree = ttk.Treeview(left, columns=("name", "kana", "phone"), show="headings", height=25)
        self.tree.heading("name", text="お名前")
        self.tree.heading("kana", text="フリガナ")
        self.tree.heading("phone", text="電話番号")
        self.tree.column("name", width=110)
        self.tree.column("kana", width=110)
        self.tree.column("phone", width=110)
        self.tree.pack(fill="both", expand=True)
        self.tree.bind("<<TreeviewSelect>>", self._on_select_customer)

        ttk.Button(left, text="＋ 新規顧客", command=self.new_customer).pack(fill="x", pady=(6, 0))

        # 右側: タブ + 保存ボタン
        right = ttk.Frame(outer)
        right.pack(side="left", fill="both", expand=True)

        self.notebook = ttk.Notebook(right)
        self.notebook.pack(fill="both", expand=True)

        self._build_basic_tab()
        self._build_karte_tab()
        self._build_memo_tab()
        self._build_visits_tab()

        bottom = ttk.Frame(right)
        bottom.pack(fill="x", pady=8)
        ttk.Button(bottom, text="保存", command=self.save_customer).pack(side="left", padx=4)
        ttk.Button(bottom, text="このお客様を削除", command=self.delete_customer).pack(side="left", padx=4)
        self.status_var = tk.StringVar(value="")
        ttk.Label(bottom, textvariable=self.status_var).pack(side="left", padx=12)

    def _build_basic_tab(self):
        tab = ttk.Frame(self.notebook, padding=10)
        self.notebook.add(tab, text="基本情報")

        self.basic_vars = {}
        fields = [("name", "お名前 *"), ("kana", "フリガナ"), ("phone", "電話番号"), ("birthday", "生年月日 (例: 1990-05-01)")]
        for i, (key, label) in enumerate(fields):
            ttk.Label(tab, text=label).grid(row=i, column=0, sticky="w", pady=6)
            var = tk.StringVar()
            ttk.Entry(tab, textvariable=var, width=40).grid(row=i, column=1, sticky="w", pady=6, padx=8)
            self.basic_vars[key] = var

    def _build_karte_tab(self):
        tab = ttk.Frame(self.notebook, padding=10)
        self.notebook.add(tab, text="カルテ情報")

        self.karte_texts = {}
        for i, (key, label) in enumerate(KARTE_FIELDS):
            ttk.Label(tab, text=label).grid(row=i * 2, column=0, sticky="w", pady=(6, 0))
            text = tk.Text(tab, width=60, height=3)
            text.grid(row=i * 2 + 1, column=0, sticky="w", pady=(0, 6))
            self.karte_texts[key] = text

    def _build_memo_tab(self):
        tab = ttk.Frame(self.notebook, padding=10)
        self.notebook.add(tab, text="雑談メモ")

        ttk.Label(
            tab, text="会話でよく話題になることを、思い出すヒントとして記録しておけます。"
        ).grid(row=0, column=0, columnspan=2, sticky="w", pady=(0, 8))

        self.memo_vars = {}
        for i, (key, label) in enumerate(MEMO_FIELDS):
            ttk.Label(tab, text=label).grid(row=i + 1, column=0, sticky="w", pady=4)
            var = tk.StringVar()
            ttk.Entry(tab, textvariable=var, width=45).grid(row=i + 1, column=1, sticky="w", pady=4, padx=8)
            self.memo_vars[key] = var

        ttk.Label(tab, text="自由メモ(その他なんでも)").grid(row=len(MEMO_FIELDS) + 1, column=0, sticky="nw", pady=(10, 0))
        self.memo_free_text = tk.Text(tab, width=60, height=6)
        self.memo_free_text.grid(row=len(MEMO_FIELDS) + 2, column=0, columnspan=2, sticky="w", pady=4)

    def _build_visits_tab(self):
        tab = ttk.Frame(self.notebook, padding=10)
        self.notebook.add(tab, text="来店履歴")

        ttk.Label(tab, text="※ 来店履歴は「追加・編集・削除」ボタンで、その場ですぐ保存されます。").pack(anchor="w", pady=(0, 6))

        self.visit_tree = ttk.Treeview(tab, columns=("date", "menu", "staff"), show="headings", height=15)
        self.visit_tree.heading("date", text="来店日")
        self.visit_tree.heading("menu", text="メニュー")
        self.visit_tree.heading("staff", text="担当")
        self.visit_tree.column("date", width=100)
        self.visit_tree.column("menu", width=150)
        self.visit_tree.column("staff", width=100)
        self.visit_tree.pack(fill="both", expand=True)

        btns = ttk.Frame(tab)
        btns.pack(fill="x", pady=6)
        ttk.Button(btns, text="追加", command=self.add_visit).pack(side="left", padx=4)
        ttk.Button(btns, text="編集", command=self.edit_visit).pack(side="left", padx=4)
        ttk.Button(btns, text="削除", command=self.delete_visit).pack(side="left", padx=4)

    # ---------- データの読み書き ----------
    def refresh_customer_list(self):
        self.tree.delete(*self.tree.get_children())
        for c in db.list_customers(self.conn, self.search_var.get()):
            self.tree.insert("", "end", iid=str(c["id"]), values=(c["name"], c["kana"], c["phone"]))

    def _on_select_customer(self, _event):
        selection = self.tree.selection()
        if not selection:
            return
        self.load_customer(int(selection[0]))

    def load_customer(self, customer_id):
        customer = db.get_customer(self.conn, customer_id)
        if not customer:
            return
        self.current_customer_id = customer_id

        for key, var in self.basic_vars.items():
            var.set(customer.get(key, ""))
        for key, text in self.karte_texts.items():
            text.delete("1.0", "end")
            text.insert("1.0", customer.get(key, ""))
        for key, var in self.memo_vars.items():
            var.set(customer.get(key, ""))
        self.memo_free_text.delete("1.0", "end")
        self.memo_free_text.insert("1.0", customer.get("memo_free", ""))

        self.refresh_visit_list()
        self.status_var.set("")

    def new_customer(self):
        self.current_customer_id = None
        for var in self.basic_vars.values():
            var.set("")
        for text in self.karte_texts.values():
            text.delete("1.0", "end")
        for var in self.memo_vars.values():
            var.set("")
        self.memo_free_text.delete("1.0", "end")
        self.tree.selection_remove(self.tree.selection())
        self.visit_tree.delete(*self.visit_tree.get_children())
        self.status_var.set("新規顧客を入力してください")

    def _collect_form_data(self):
        data = {key: var.get().strip() for key, var in self.basic_vars.items()}
        for key, text in self.karte_texts.items():
            data[key] = text.get("1.0", "end-1c").strip()
        for key, var in self.memo_vars.items():
            data[key] = var.get().strip()
        data["memo_free"] = self.memo_free_text.get("1.0", "end-1c").strip()
        return data

    def save_customer(self):
        data = self._collect_form_data()
        try:
            if self.current_customer_id is None:
                self.current_customer_id = db.add_customer(self.conn, data)
                self.status_var.set("新規登録しました")
            else:
                db.update_customer(self.conn, self.current_customer_id, data)
                self.status_var.set("保存しました")
        except ValueError as e:
            messagebox.showerror("入力エラー", str(e))
            return
        self.refresh_customer_list()
        self.tree.selection_set(str(self.current_customer_id))

    def delete_customer(self):
        if self.current_customer_id is None:
            messagebox.showinfo("削除", "削除するお客様が選ばれていません。")
            return
        if not messagebox.askyesno("削除確認", "このお客様のデータを削除します。よろしいですか?(元に戻せません)"):
            return
        db.delete_customer(self.conn, self.current_customer_id)
        self.new_customer()
        self.refresh_customer_list()

    # ---------- 来店履歴 ----------
    def refresh_visit_list(self):
        self.visit_tree.delete(*self.visit_tree.get_children())
        if self.current_customer_id is None:
            return
        for v in db.list_visits(self.conn, self.current_customer_id):
            self.visit_tree.insert("", "end", iid=str(v["id"]), values=(v["visit_date"], v["menu"], v["staff"]))

    def add_visit(self):
        if self.current_customer_id is None:
            messagebox.showinfo("来店履歴", "先にお客様を選択または保存してください。")
            return
        dialog = VisitDialog(self.root)
        self.root.wait_window(dialog)
        if dialog.result:
            db.add_visit(self.conn, self.current_customer_id, dialog.result)
            self.refresh_visit_list()

    def edit_visit(self):
        selection = self.visit_tree.selection()
        if not selection:
            messagebox.showinfo("来店履歴", "編集する履歴を選んでください。")
            return
        visit_id = int(selection[0])
        visits = db.list_visits(self.conn, self.current_customer_id)
        target = next((v for v in visits if v["id"] == visit_id), None)
        if not target:
            return
        dialog = VisitDialog(self.root, initial=target)
        self.root.wait_window(dialog)
        if dialog.result:
            db.update_visit(self.conn, visit_id, dialog.result)
            self.refresh_visit_list()

    def delete_visit(self):
        selection = self.visit_tree.selection()
        if not selection:
            messagebox.showinfo("来店履歴", "削除する履歴を選んでください。")
            return
        if not messagebox.askyesno("削除確認", "この来店履歴を削除します。よろしいですか?"):
            return
        db.delete_visit(self.conn, int(selection[0]))
        self.refresh_visit_list()

    # ---------- その他 ----------
    def export_csv(self):
        path = filedialog.asksaveasfilename(
            title="CSVの保存先",
            defaultextension=".csv",
            initialfile="nikomaru_customers.csv",
            filetypes=[("CSVファイル", "*.csv")],
        )
        if not path:
            return
        db.export_customers_csv(self.conn, path)
        messagebox.showinfo("完了", "CSVファイルを書き出しました。\n{0}".format(path))


def main():
    root = tk.Tk()
    root.withdraw()
    set_app_icon(root)

    db_path = ensure_db_path()
    if not db_path:
        return
    conn = db.init_db(db_path)

    offer_set_password(root, conn)
    if not check_password(root, conn):
        return

    root.deiconify()
    MainWindow(root, conn)
    root.mainloop()


def _show_crash_message(error_text):
    """起動直後に予期しないエラーで落ちた場合、画面が一瞬で消えて原因が分からなくなるのを防ぐ。
    エラー内容をファイルに書き出したうえで、可能であれば画面にも表示する。"""
    log_path = resource_path("error_log.txt")
    try:
        with open(log_path, "w", encoding="utf-8") as f:
            f.write(error_text)
    except OSError:
        log_path = None

    message = "起動中にエラーが発生しました。\n\n" + error_text
    if log_path:
        message += "\n\nこの内容は次の場所にも保存されました:\n{0}".format(log_path)

    try:
        error_root = tk.Tk()
        error_root.withdraw()
        messagebox.showerror("起動エラー", message)
        error_root.destroy()
    except Exception:
        # tkinter自体が使えない(例: tkinterが正しくインストールされていない)場合は
        # コンソールに表示する。run.batから起動していれば、この文字が読めるはず。
        print(message)
        try:
            input("Enterキーを押すと閉じます...")
        except Exception:
            pass


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback

        _show_crash_message(traceback.format_exc())
