# ─── API KEYS ────────────────────────────────────────────────────────────────
APOLLO_API_KEY  = "jXVitKwqmdolYiV6QTxK8A"
HUNTER_API_KEY  = "3260ecc1e0bd8a5995271c9fcb722d55845e3729"

# ─── GMAIL ───────────────────────────────────────────────────────────────────
GMAIL_USER      = "abdelrhman.ahmedmyp1@gmail.com"
GMAIL_PASSWORD  = "ujvm iuop qsup mulo"   # Gmail App Password

# ─── SENDER IDENTITY ─────────────────────────────────────────────────────────
SENDER_NAME     = "Abdelrahman Shehata"

# ─── TARGETING ───────────────────────────────────────────────────────────────
# Job titles to target
TARGET_TITLES = ["CEO", "Founder", "Co-Founder", "Owner", "Managing Director"]

# SaaS-related keywords Apollo will use to filter companies
SAAS_KEYWORDS = ["saas", "software as a service", "b2b software", "cloud software"]

# How many leads to find and email per daily run
EMAILS_PER_DAY = 20

# Time of day to run automatically (24h format)
SEND_TIME = "09:00"

# ─── EMAIL TEMPLATE ──────────────────────────────────────────────────────────
EMAIL_SUBJECT = "Quick question — {company}"

EMAIL_BODY = """\
Hey {first_name},

I'm Abdelrahman Shehata. I'm starting a business that helps SaaS companies, \
but I want to make sure I understand the real challenges first — not just guess.

I came across {company} and saw that you've built something great. \
Because of that, I was wondering if I could get some guidance or advice on \
the problems that SaaS companies face.

It will be completely anonymous, and we don't have to talk about anything \
you're not comfortable sharing.

Could you spare me 15 minutes today or tomorrow? I'd just like to ask you \
a couple of questions about the SaaS business model.

Thanks,
Abdelrahman Shehata
"""
