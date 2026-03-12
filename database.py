"""
SQLite database — tracks every lead so we never email the same person twice
and can monitor the status of every outreach.
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "outreach.db")


def get_conn():
    return sqlite3.connect(DB_PATH)


def init_db():
    """Create tables if they don't exist yet."""
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS leads (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name  TEXT,
                last_name   TEXT,
                email       TEXT UNIQUE,
                company     TEXT,
                title       TEXT,
                domain      TEXT,
                status      TEXT DEFAULT 'pending',
                -- pending | sent | failed | replied
                sent_at     TEXT,
                created_at  TEXT DEFAULT (datetime('now'))
            )
        """)
        conn.commit()
    print("[DB] Database ready.")


def lead_exists(email: str) -> bool:
    """Return True if this email is already in the database."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT 1 FROM leads WHERE email = ?", (email,)
        ).fetchone()
    return row is not None


def insert_lead(first_name, last_name, email, company, title, domain):
    """Insert a new lead. Returns True if inserted, False if already exists."""
    if lead_exists(email):
        return False
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO leads (first_name, last_name, email, company, title, domain)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (first_name, last_name, email, company, title, domain),
        )
        conn.commit()
    return True


def mark_sent(email: str):
    with get_conn() as conn:
        conn.execute(
            "UPDATE leads SET status='sent', sent_at=datetime('now') WHERE email=?",
            (email,),
        )
        conn.commit()


def mark_failed(email: str):
    with get_conn() as conn:
        conn.execute(
            "UPDATE leads SET status='failed' WHERE email=?", (email,)
        )
        conn.commit()


def get_pending_leads(limit: int):
    """Return leads that haven't been emailed yet."""
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT first_name, last_name, email, company, title, domain
               FROM leads WHERE status='pending' LIMIT ?""",
            (limit,),
        ).fetchall()
    return [
        {
            "first_name": r[0],
            "last_name":  r[1],
            "email":      r[2],
            "company":    r[3],
            "title":      r[4],
            "domain":     r[5],
        }
        for r in rows
    ]


def print_stats():
    with get_conn() as conn:
        total   = conn.execute("SELECT COUNT(*) FROM leads").fetchone()[0]
        sent    = conn.execute("SELECT COUNT(*) FROM leads WHERE status='sent'").fetchone()[0]
        pending = conn.execute("SELECT COUNT(*) FROM leads WHERE status='pending'").fetchone()[0]
        failed  = conn.execute("SELECT COUNT(*) FROM leads WHERE status='failed'").fetchone()[0]
    print(f"\n[STATS] Total: {total} | Sent: {sent} | Pending: {pending} | Failed: {failed}")
