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


def send_email_async(to_address, subject, html_body):
    """
    Send email in a background thread so it never blocks a request
    or gets killed by gunicorn's worker timeout.
    """
    import threading
    t = threading.Thread(
        target=send_email,
        args=(to_address, subject, html_body),
        daemon=True,
    )
    t.start()


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
    return send_email_async(to_email, "Link your Bespoke Library accounts", html)


def send_application_received(admin_email, applicant_name, applicant_email, project_desc):
    """Notify admin that a new author application has been submitted."""
    html = f"""
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 32px; color: #222;">
        <h2 style="font-size: 1.2em; margin-bottom: 4px;">New Author Application</h2>
        <p style="color: #888; font-size: 0.85em; margin-top: 0;">Bespoke Library</p>

        <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
            <tr>
                <td style="padding: 8px 0; color: #555; font-size:0.85em; width:100px;">Name</td>
                <td style="padding: 8px 0; font-weight: bold;">{applicant_name}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #555; font-size:0.85em;">Email</td>
                <td style="padding: 8px 0;">{applicant_email}</td>
            </tr>
        </table>

        <p style="color: #555; font-size: 0.85em; font-weight: bold; margin-bottom: 4px;">Project</p>
        <p style="color: #333; line-height: 1.6; font-size: 0.9em;
                  background: #f5f5f5; padding: 12px; border-radius: 4px;">
            {project_desc[:400]}{'…' if len(project_desc) > 400 else ''}
        </p>

        <a href="{APP_BASE_URL}/?admin=1" style="display:inline-block; margin-top: 20px;
           padding: 10px 20px; background: #3498db; color: #fff; text-decoration: none;
           border-radius: 6px; font-size: 0.85em; font-weight: bold;">
            Review in Admin Panel →
        </a>
    </div>
    """
    return send_email_async(admin_email, f"New application: {applicant_name}", html)


def send_application_decision(to_email, applicant_name, status, review_note=None):
    """Notify applicant of the decision on their application."""
    approved  = status == "approved"
    color     = "#2ecc71" if approved else "#e74c3c"
    outcome   = "approved" if approved else "not accepted at this time"
    next_step = (
        "You can now log in to Bespoke Library to set up your author account."
        if approved else
        "We appreciate you taking the time to apply."
    )

    note_block = ""
    if review_note:
        note_block = f"""
        <p style="color: #555; font-size: 0.85em; font-weight: bold; margin: 20px 0 4px;">
            Note from the team
        </p>
        <p style="color: #333; line-height: 1.6; font-size: 0.9em;
                  background: #f5f5f5; padding: 12px; border-radius: 4px;">
            {review_note}
        </p>
        """

    html = f"""
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 32px; color: #222;">
        <h2 style="font-size: 1.2em; margin-bottom: 4px;">Your Bespoke Library Application</h2>
        <p style="color: #888; font-size: 0.85em; margin-top: 0;">A decision has been made</p>

        <div style="border-left: 3px solid {color}; padding: 12px 16px; margin: 20px 0;
                    background: #fafafa; border-radius: 0 4px 4px 0;">
            <p style="margin: 0; font-size: 0.95em;">
                Hi {applicant_name}, your application has been <strong>{outcome}</strong>.
            </p>
        </div>

        <p style="color: #555; line-height: 1.6; font-size: 0.9em;">{next_step}</p>

        {note_block}

        <a href="{APP_BASE_URL}" style="display:inline-block; margin-top: 20px;
           padding: 10px 20px; background: #3498db; color: #fff; text-decoration: none;
           border-radius: 6px; font-size: 0.85em; font-weight: bold;">
            Visit Bespoke Library →
        </a>

        <p style="color: #bbb; font-size: 0.75em; margin-top: 32px;">
            Bespoke Library · bespoke.nicholasnevins.org
        </p>
    </div>
    """
    subject = "Your Bespoke Library application has been approved" if approved \
              else "Update on your Bespoke Library application"
    return send_email_async(to_email, subject, html)


def send_application_approved_with_invite(to_email, applicant_name, invite_token, review_note=None):
    """Notify approved applicant with their unique author invite link."""
    link = f"{APP_BASE_URL}/?author_invite={invite_token}"

    note_block = ""
    if review_note:
        note_block = f"""
        <p style="color:#555;font-size:0.85em;font-weight:bold;margin:20px 0 4px;">
            Note from the team
        </p>
        <p style="color:#333;line-height:1.6;font-size:0.9em;
                  background:#f5f5f5;padding:12px;border-radius:4px;">
            {review_note}
        </p>
        """

    html = f"""
    <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px;color:#222;">
        <h2 style="font-size:1.2em;margin-bottom:4px;">You've been approved!</h2>
        <p style="color:#888;font-size:0.85em;margin-top:0;">Bespoke Library</p>

        <div style="border-left:3px solid #2ecc71;padding:12px 16px;margin:20px 0;
                    background:#fafafa;border-radius:0 4px 4px 0;">
            <p style="margin:0;font-size:0.95em;">
                Hi {applicant_name} — your application to be an author on Bespoke Library
                has been <strong>approved</strong>.
            </p>
        </div>

        <p style="color:#555;line-height:1.6;font-size:0.9em;">
            Click the button below to activate your author account and create your first project.
            You'll be prompted to log in or register if you haven't already.
            This link expires in 30 days and can only be used once.
        </p>

        {note_block}

        <a href="{link}" style="display:inline-block;margin-top:20px;
           padding:12px 24px;background:#3498db;color:#fff;text-decoration:none;
           border-radius:6px;font-size:0.9em;font-weight:bold;">
            Activate Author Account &rarr;
        </a>

        <p style="color:#bbb;font-size:0.75em;margin-top:32px;">
            Bespoke Library &middot; bespoke.nicholasnevins.org
        </p>
    </div>
    """
    return send_email_async(to_email, "You've been approved — Bespoke Library", html)
