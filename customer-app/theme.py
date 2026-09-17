# -*- coding: utf-8 -*-
"""
見た目のテーマ(色・フォント)をまとめたファイル。

にこまる美容室のWebサイト(css/style.css)で使っている色をそのまま使い、
アプリの雰囲気をWebサイトに合わせています。tkinterはCSSのような角丸や
影は作れないので、そこは色づかいとフォント・余白の丸みで表現しています。
"""

import tkinter as tk
import tkinter.font as tkfont
from tkinter import ttk

# にこまる美容室サイト(css/style.css の :root)と同じ配色
CREAM = "#FBEFD3"
CREAM_LIGHT = "#FFFBF2"
CREAM_DEEP = "#F5E6BE"
RED = "#E2362B"
RED_DARK = "#C22A20"
YELLOW = "#F4B93E"
CHARCOAL = "#2B2420"
TEXT = "#4A3B2A"
WHITE = "#FFFFFF"

# サイトでは「M PLUS Rounded 1c」という丸ゴシックを使っているが、Webフォントなので
# Windowsパソコンには入っていないことが多い。そのパソコンに入っている中から、
# できるだけ雰囲気の近い丸っこい書体を順番に探して使う。
PREFERRED_FONTS = [
    "HGMaruGothicMPRO",
    "HG丸ゴシックM-PRO",
    "UD デジタル 教科書体 NP-R",
    "Yu Gothic UI",
    "Meiryo UI",
    "Meiryo",
]


def pick_font_family(root, preferred=PREFERRED_FONTS, fallback="TkDefaultFont"):
    try:
        available = set(tkfont.families(root))
    except tk.TclError:
        return fallback
    for name in preferred:
        if name in available:
            return name
    return fallback


def apply_theme(root):
    """rootウィンドウとttkウィジェット全体ににこまるカラーを適用する。戻り値はフォント設定。"""
    family = pick_font_family(root)
    base_font = (family, 10)
    bold_font = (family, 10, "bold")
    heading_font = (family, 13, "bold")

    root.configure(bg=CREAM_LIGHT)
    # tk.Text / tk.Listbox など、ttk化されていない素のtkinterウィジェットにも
    # 基本フォントが自動で当たるようにする
    root.option_add("*Font", base_font)

    style = ttk.Style(root)
    try:
        # "clam"は背景色・文字色を自由に変えられるテーマ。Windows既定の"vista"テーマは
        # 色の変更をほぼ受け付けないため、あえてclamに切り替える。
        style.theme_use("clam")
    except tk.TclError:
        pass

    style.configure(".", background=CREAM_LIGHT, foreground=TEXT, font=base_font)
    style.configure("TFrame", background=CREAM_LIGHT)
    style.configure("TLabel", background=CREAM_LIGHT, foreground=TEXT, font=base_font)
    style.configure("Heading.TLabel", background=CREAM_LIGHT, foreground=CHARCOAL, font=heading_font)

    # 基本のボタン(サイトの .btn-primary に相当・主要な操作)
    style.configure(
        "Primary.TButton",
        background=RED, foreground=WHITE, font=bold_font,
        padding=(16, 9), relief="flat", borderwidth=0,
    )
    style.map(
        "Primary.TButton",
        background=[("active", RED_DARK), ("pressed", RED_DARK), ("disabled", CREAM_DEEP)],
        foreground=[("disabled", TEXT)],
    )
    style.configure("TButton", background=RED, foreground=WHITE, font=bold_font,
                     padding=(16, 9), relief="flat", borderwidth=0)
    style.map("TButton", background=[("active", RED_DARK), ("pressed", RED_DARK)])

    # 控えめなボタン(サイトの .btn-outline に相当・キャンセルや補助的な操作)
    style.configure(
        "Outline.TButton",
        background=CREAM_LIGHT, foreground=RED, font=bold_font,
        padding=(16, 9), relief="flat", borderwidth=1,
        bordercolor=RED, lightcolor=RED, darkcolor=RED,
    )
    style.map(
        "Outline.TButton",
        background=[("active", CREAM), ("pressed", CREAM)],
    )

    # 削除など、注意を促すボタン(サイトの .btn-danger に相当)
    style.configure(
        "Danger.TButton",
        background=CREAM_LIGHT, foreground=RED_DARK, font=bold_font,
        padding=(16, 9), relief="flat", borderwidth=1,
        bordercolor=RED_DARK, lightcolor=RED_DARK, darkcolor=RED_DARK,
    )
    style.map("Danger.TButton", background=[("active", "#fdecea"), ("pressed", "#fdecea")])

    # タブ(ノートブック)
    style.configure("TNotebook", background=CREAM_LIGHT, borderwidth=0)
    style.configure(
        "TNotebook.Tab", background=CREAM, foreground=TEXT, font=bold_font,
        padding=(18, 10), borderwidth=0,
    )
    style.map(
        "TNotebook.Tab",
        background=[("selected", CREAM_LIGHT)],
        foreground=[("selected", RED_DARK)],
    )

    # 一覧表(顧客一覧・来店履歴)
    style.configure(
        "Treeview", background=WHITE, fieldbackground=WHITE, foreground=CHARCOAL,
        rowheight=28, font=base_font, borderwidth=0,
    )
    style.configure(
        "Treeview.Heading", background=CREAM, foreground=CHARCOAL, font=bold_font,
        relief="flat", padding=(6, 6),
    )
    style.map(
        "Treeview.Heading", background=[("active", CREAM_DEEP)]
    )
    style.map("Treeview", background=[("selected", YELLOW)], foreground=[("selected", CHARCOAL)])

    # 入力欄
    style.configure(
        "TEntry", fieldbackground=WHITE, foreground=CHARCOAL, padding=7,
        bordercolor=CREAM_DEEP, lightcolor=CREAM_DEEP, darkcolor=CREAM_DEEP,
    )
    style.map("TEntry", bordercolor=[("focus", RED)])

    return {"family": family, "base": base_font, "bold": bold_font, "heading": heading_font}


def style_text_widget(widget):
    """tk.Text(ttk化されていない素のウィジェット)を、テーマに合わせた見た目にする"""
    widget.configure(
        bg=WHITE, fg=CHARCOAL, insertbackground=CHARCOAL,
        relief="flat", highlightthickness=1,
        highlightbackground=CREAM_DEEP, highlightcolor=RED,
        padx=8, pady=6,
    )
