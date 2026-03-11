"""
email.py — Transactional email via Resend SMTP.
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_ADDRESS   = os.getenv("EMAIL_FROM", "noreply@nicholasnevins.org")
APP_BASE_URL   = os.getenv("APP_BASE_URL", "https://bespoke.nicholasnevins.org")

SMTP_HOST = "smtp.resend.com"
SMTP_PORT = 587


def send_email(to_address, subject, html_body):
    """Send an email via Resend SMTP."""
    if not RESEND_API_KEY:
        print(f"[email] RESEND_API_KEY not set — skipping email to {to_address}")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"Bespoke Library <{FROM_ADDRESS}>"
    msg["To"]      = to_address

    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login("resend", RESEND_API_KEY)
            server.sendmail(FROM_ADDRESS, to_address, msg.as_string())
        return True
    except Exception as e:
        print(f"[email] Failed to send to {to_address}: {e}")
        return False


def send_link_verification(to_email, username, token):
    """Send account linking verification email."""
    link = f"{APP_BASE_URL}/?link_token={token}"
    html = f"""
    <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; color: #222;">
        <h2 style="font-size: 1.3em; margin-bottom: 8px;">Link your Bespoke Library accounts</h2>
        <p style="color: #555; line-height: 1.6;">
            Someone is trying to link a new login method to your 
            <strong>@{username}</strong> account on Bespoke Library.
        </p>
        <p style="color: #555; line-height: 1.6;">
            If this was you, click the button below to confirm. 
            This link expires in 24 hours.
        </p>
        <a href="{link}" style="display:inline-block; margin: 24px 0; padding: 12px 24px; 
           background: #c9a96e; color: #fff; text-decoration: none; border-radius: 6px; 
           font-weight: bold;">
            Link accounts →
        </a>
        <p style="color: #999; font-size: 0.8em;">
            If you didn't request this, ignore this email. 
            Your account will not be changed.
        </p>
    </div>
    """
    return send_email(to_email, "Link your Bespoke Library accounts", html)
