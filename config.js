// Load .env file when running locally (GitHub Actions uses repo secrets instead)
require("dotenv").config();

// ─── API KEYS ─────────────────────────────────────────────────────────────────
const HUNTER_API_KEY = process.env.HUNTER_API_KEY;
const APIFY_API_KEY  = process.env.APIFY_API_KEY;

// ─── GMAIL ────────────────────────────────────────────────────────────────────
const GMAIL_USER     = process.env.GMAIL_USER;
const GMAIL_PASSWORD = process.env.GMAIL_PASSWORD;

// ─── SENDER IDENTITY ──────────────────────────────────────────────────────────
const SENDER_NAME = "Abdelrahman Shehata";

// ─── SCHEDULE ─────────────────────────────────────────────────────────────────
const EMAILS_PER_BATCH = 3;

// ─── EMAIL TEMPLATE ───────────────────────────────────────────────────────────
const EMAIL_SUBJECT = (company) =>
  `Quick question — ${company}`;

const EMAIL_BODY = (firstName, company) => `Hey ${firstName},

I'm Abdelrahman Shehata. I'm starting a business that helps SaaS companies, but I want to make sure I understand the real challenges first — not just guess.

I came across ${company} and saw that you've built something impressive. Because of that, I was wondering if I could get some guidance or advice on the real problems that SaaS companies face.

It will be completely anonymous, and we don't have to talk about anything you're not comfortable sharing.

Could you spare me 15 minutes this week? I'd just like to ask you a couple of questions about the SaaS business model.

Thanks,
Abdelrahman Shehata`;

module.exports = {
  HUNTER_API_KEY, APIFY_API_KEY,
  GMAIL_USER, GMAIL_PASSWORD, SENDER_NAME,
  EMAILS_PER_BATCH,
  EMAIL_SUBJECT, EMAIL_BODY,
};
