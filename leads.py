"""
Lead generation pipeline:
  1. Apollo.io  — finds SaaS CEOs/Founders (name, company, domain)
  2. Hunter.io  — finds their email address
  3. database   — stores new leads, skips duplicates
"""

import requests
import time
import config
import database


# ─── APOLLO ──────────────────────────────────────────────────────────────────

APOLLO_URL = "https://api.apollo.io/v1/mixed_people/search"


def fetch_apollo_leads(page: int = 1, per_page: int = 25) -> list[dict]:
    """
    Search Apollo for SaaS founders/CEOs.
    Returns a list of dicts with: first_name, last_name, title, company, domain
    """
    headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
    }
    payload = {
        "api_key": config.APOLLO_API_KEY,
        "person_titles": config.TARGET_TITLES,
        "person_seniorities": ["owner", "founder", "c_suite"],
        "q_organization_keyword_tags": config.SAAS_KEYWORDS,
        "per_page": per_page,
        "page": page,
    }

    try:
        resp = requests.post(APOLLO_URL, json=payload, headers=headers, timeout=20)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        print(f"[APOLLO] Request error: {e}")
        return []

    people = data.get("people", [])
    leads = []
    for p in people:
        org = p.get("organization") or {}
        domain = org.get("primary_domain") or ""
        first  = (p.get("first_name") or "").strip()
        last   = (p.get("last_name") or "").strip()
        title  = (p.get("title") or "").strip()
        company = (org.get("name") or "").strip()

        if not first or not domain:
            continue

        leads.append({
            "first_name": first,
            "last_name":  last,
            "title":      title,
            "company":    company,
            "domain":     domain,
        })

    print(f"[APOLLO] Page {page} → {len(leads)} leads found")
    return leads


# ─── HUNTER ──────────────────────────────────────────────────────────────────

HUNTER_URL = "https://api.hunter.io/v2/email-finder"


def find_email(first_name: str, last_name: str, domain: str) -> str | None:
    """
    Use Hunter.io to find a person's email from their name + company domain.
    Returns email string or None.
    """
    params = {
        "first_name": first_name,
        "last_name":  last_name,
        "domain":     domain,
        "api_key":    config.HUNTER_API_KEY,
    }
    try:
        resp = requests.get(HUNTER_URL, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        print(f"[HUNTER] Request error for {domain}: {e}")
        return None

    email = (data.get("data") or {}).get("email")
    return email or None


# ─── PIPELINE ────────────────────────────────────────────────────────────────

def collect_leads(target_count: int):
    """
    Pull leads from Apollo, find their emails via Hunter,
    and store new ones in the database.
    Returns number of new leads added.
    """
    added = 0
    page  = 1

    while added < target_count:
        apollo_leads = fetch_apollo_leads(page=page, per_page=25)
        if not apollo_leads:
            print("[LEADS] No more leads from Apollo.")
            break

        for lead in apollo_leads:
            if added >= target_count:
                break

            email = find_email(
                lead["first_name"], lead["last_name"], lead["domain"]
            )

            if not email:
                print(f"[HUNTER] No email for {lead['first_name']} {lead['last_name']} @ {lead['domain']}")
                continue

            if database.lead_exists(email):
                print(f"[DB] Already exists: {email}")
                continue

            inserted = database.insert_lead(
                first_name = lead["first_name"],
                last_name  = lead["last_name"],
                email      = email,
                company    = lead["company"],
                title      = lead["title"],
                domain     = lead["domain"],
            )

            if inserted:
                added += 1
                print(f"[NEW LEAD] {lead['first_name']} {lead['last_name']} <{email}> — {lead['company']}")

            # Be polite to Hunter's API (free tier rate limits)
            time.sleep(1)

        page += 1
        time.sleep(2)

    print(f"[LEADS] Done. {added} new leads added to database.")
    return added
