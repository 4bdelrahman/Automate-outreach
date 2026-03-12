"""
main.py — Autopilot orchestrator

Run once:   python main.py --now
Scheduler:  python main.py          (runs every day at config.SEND_TIME)
Stats only: python main.py --stats
"""

import sys
import schedule
import time
import datetime

import config
import database
import leads
import sender


def daily_job():
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n{'='*55}")
    print(f" AUTOPILOT RUN — {now}")
    print(f"{'='*55}")

    # Step 1: Init DB
    database.init_db()

    # Step 2: Find new leads (Apollo → Hunter)
    print(f"\n[STEP 1] Finding {config.EMAILS_PER_DAY} new SaaS leads…")
    leads.collect_leads(target_count=config.EMAILS_PER_DAY)

    # Step 3: Send emails to pending leads
    print(f"\n[STEP 2] Sending emails…")
    sender.send_batch(limit=config.EMAILS_PER_DAY)

    # Step 4: Show stats
    database.print_stats()
    print(f"\n[DONE] Next run at {config.SEND_TIME} tomorrow.\n")


def run_scheduler():
    database.init_db()
    print(f"[AUTOPILOT] Scheduler started. Will run every day at {config.SEND_TIME}.")
    print(f"[AUTOPILOT] Press Ctrl+C to stop.\n")

    schedule.every().day.at(config.SEND_TIME).do(daily_job)

    # Run immediately on first launch so you don't wait until tomorrow
    print("[AUTOPILOT] Running initial job now…")
    daily_job()

    while True:
        schedule.run_pending()
        time.sleep(30)


if __name__ == "__main__":
    if "--stats" in sys.argv:
        database.init_db()
        database.print_stats()
    elif "--now" in sys.argv:
        # One-shot manual run
        daily_job()
    else:
        # Default: start the autopilot scheduler
        run_scheduler()
