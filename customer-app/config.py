# -*- coding: utf-8 -*-
"""
設定ファイル(データベースの保存場所)の読み書き

このアプリはスタッフの複数のパソコンから同じお客様データを見られるように、
「共有フォルダの中のデータベースファイル」を指定して使う仕組みになっています。
初回起動時にどこに保存するか選んでもらい、その場所を config.json に覚えておきます。
"""

import json
import os

APP_NAME = "にこまる美容室カルテ"


def config_dir():
    """設定ファイルの置き場所(Windowsなら %APPDATA%\\にこまる美容室カルテ)"""
    base = os.environ.get("APPDATA") or os.path.expanduser("~")
    path = os.path.join(base, APP_NAME)
    os.makedirs(path, exist_ok=True)
    return path


def config_path():
    return os.path.join(config_dir(), "config.json")


def load_config():
    path = config_path()
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_config(data):
    with open(config_path(), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_db_path():
    return load_config().get("db_path")


def set_db_path(db_path):
    cfg = load_config()
    cfg["db_path"] = db_path
    save_config(cfg)
