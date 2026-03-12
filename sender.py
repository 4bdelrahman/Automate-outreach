"""
Gmail SMTP sender — sends personalised cold emails using the app password.
Reads pending leads from the database and marks them sent/failed.
"""

import smtplib
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import config
import database


SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587


def build_email(lead: dict) -> MIMEMultipart:
    """Build a personalised MIMEMultipart email for one lead."""
    subject = config.EMAIL_SUBJECT.format(
        company=lead["company"] or "your company"
    )
    body = config.EMAIL_BODY.format(
        first_name=lead["first_name"],
        company=lead["company"] or "your company",
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"{config.SENDER_NAME} <{config.GMAIL_USER}>"
    msg["To"]      = lead["email"]
    msg.attach(MIMEText(body, "plain"))
    return msg


def send_batch(limit: int):
    """
    Pull up to `limit` pending leads from DB and send each an email.
    Opens one SMTP connection for the whole batch.
    """
    leads = database.get_pending_leads(limit)
    if not leads:
        print("[SENDER] No pending leads to email.")
        return

    print(f"[SENDER] Connecting to Gmail SMTP…")
    try:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30)
        server.ehlo()
        server.starttls()
        server.login(config.GMAIL_USER, config.GMAIL_PASSWORD)
        print("[SENDER] Connected.")
    except Exception as e:
        print(f"[SENDER] SMTP connection failed: {e}")
        return

    sent_count = 0
    for lead in leads:
        try:
            msg = build_email(lead)
            server.sendmail(config.GMAIL_USER, lead["email"], msg.as_string())
            database.mark_sent(lead["email"])
            sent_count += 1
            print(f"[SENT] {lead['first_name']} {lead['last_name']} <{lead['email']}> — {lead['company']}")
        except Exception as e:
            database.mark_failed(lead["email"])
            print(f"[FAILED] {lead['email']}: {e}")

        # Small delay between sends to avoid spam triggers
        time.sleep(3)

    server.quit()
    print(f"\n[SENDER] Done. {sent_count}/{len(leads)} emails sent.")
