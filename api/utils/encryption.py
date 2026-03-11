"""
encryption.py — Fernet symmetric encryption for PII fields.

Key must be a 32-byte base64-urlsafe string. Generate with:
    python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""

import os
from cryptography.fernet import Fernet

_fernet = None

def _get_fernet():
    global _fernet
    if _fernet:
        return _fernet
    key = os.getenv("FERNET_KEY", "")
    if not key:
        raise RuntimeError("FERNET_KEY env var not set")
    _fernet = Fernet(key.encode())
    return _fernet

def encrypt(plaintext):
    """Encrypt a string, return base64 ciphertext string."""
    if not plaintext:
        return None
    return _get_fernet().encrypt(plaintext.encode()).decode()

def decrypt(ciphertext):
    """Decrypt a ciphertext string, return plaintext."""
    if not ciphertext:
        return None
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except Exception:
        return None
