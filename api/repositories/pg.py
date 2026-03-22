"""
pg.py — PostgreSQL connection.
Provides a single shared connection pool for all repos.
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import pool

_pool = None

def get_pool():
    global _pool
    if _pool:
        return _pool
    url = os.getenv("POSTGRES_URL")
    if not url:
        raise RuntimeError("POSTGRES_URL not set")
    _pool = pool.ThreadedConnectionPool(
        minconn=1,
        maxconn=10,
        dsn=url,
        cursor_factory=RealDictCursor,
    )
    return _pool

def get_conn():
    return get_pool().getconn()

def put_conn(conn):
    get_pool().putconn(conn)

class pg_cursor:
    """
    Context manager for safe connection + cursor handling.

    Usage:
        with pg_cursor() as cur:
            cur.execute("SELECT ...")
            rows = cur.fetchall()
    """
    def __init__(self):
        self.conn = None

    def __enter__(self):
        self.conn = get_conn()
        self.cur  = self.conn.cursor()
        return self.cur

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.conn.rollback()
        else:
            self.conn.commit()
        self.cur.close()
        put_conn(self.conn)
        return False
