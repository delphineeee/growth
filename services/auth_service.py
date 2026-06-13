"""用户认证服务 —— SQLite + 密码哈希"""

import sqlite3
import hashlib
import secrets
from pathlib import Path
from datetime import datetime
from typing import Optional

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "growth.db"


def _get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """初始化用户表"""
    conn = _get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            last_login TEXT
        )
    """)
    conn.commit()
    conn.close()


def _hash_password(password: str, salt: str = "") -> tuple[str, str]:
    """SHA-256 密码哈希"""
    if not salt:
        salt = secrets.token_hex(16)
    h = hashlib.sha256((password + salt).encode()).hexdigest()
    return h, salt


def register_user(username: str, email: str, password: str) -> tuple[bool, str]:
    """注册新用户。返回 (成功, 消息)"""
    if len(username) < 2:
        return False, "用户名至少 2 个字符"
    if len(password) < 6:
        return False, "密码至少 6 个字符"
    if "@" not in email:
        return False, "请输入有效的邮箱地址"

    conn = _get_conn()
    try:
        pw_hash, salt = _hash_password(password)
        conn.execute(
            "INSERT INTO users (username, email, password_hash, salt) VALUES (?, ?, ?, ?)",
            (username, email, pw_hash, salt),
        )
        conn.commit()
        return True, "注册成功"
    except sqlite3.IntegrityError:
        return False, "用户名或邮箱已被注册"
    finally:
        conn.close()


def login_user(identifier: str, password: str) -> tuple[bool, str, Optional[dict]]:
    """用户登录。identifier 可以是用户名或邮箱。返回 (成功, 消息, 用户信息)"""
    conn = _get_conn()
    user = conn.execute(
        "SELECT * FROM users WHERE username = ? OR email = ?",
        (identifier, identifier),
    ).fetchone()
    conn.close()

    if not user:
        return False, "用户名或邮箱不存在", None

    pw_hash, _ = _hash_password(password, user["salt"])
    if pw_hash != user["password_hash"]:
        return False, "密码错误", None

    # 更新最后登录时间
    conn2 = _get_conn()
    conn2.execute("UPDATE users SET last_login = datetime('now') WHERE id = ?", (user["id"],))
    conn2.commit()
    conn2.close()

    user_info = {
        "id": str(user["id"]),
        "username": user["username"],
        "email": user["email"],
        "created_at": user["created_at"],
    }
    return True, "登录成功", user_info


def get_user_by_id(user_id: str) -> Optional[dict]:
    conn = _get_conn()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (int(user_id),)).fetchone()
    conn.close()
    if user:
        return {
            "id": str(user["id"]),
            "username": user["username"],
            "email": user["email"],
        }
    return None


# 启动时自动建表
init_db()
