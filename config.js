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
// 7 runs/day × 5 emails = exactly 35 emails/day
const EMAILS_PER_BATCH = 5;

// ─── EMAIL VARIATIONS (rotated so every email looks slightly different) ────────
// Spam filters flag identical bulk emails — rotating these lines keeps you safe

const OPENERS = [
  `I'm starting a business that helps SaaS companies, but I want to make sure I understand the real challenges first — not just guess.`,
  `I'm building something for SaaS founders, but before I go any further I want to hear directly from people in the trenches.`,
  `I'm doing research into the biggest challenges SaaS founders face — and I'd much rather hear it from someone living it than read about it online.`,
];

const COMPLIMENTS = [
  `I came across {company} and was genuinely impressed by what you've built.`,
  `I looked at {company} and it's clear you've put serious work into it.`,
  `I stumbled across {company} and it immediately caught my attention.`,
];

const ASKS = [
  `Could you spare me 15 minutes this week? I'd just like to ask you a couple of questions about the SaaS business model.`,
  `Would you be open to a quick 15-minute chat? I just have a few questions I'd love to get your perspective on.`,
  `If you have 15 minutes sometime this week, I'd love to ask you a few questions — completely informal, no agenda.`,
];

// Pick a random item from an array
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── EMAIL TEMPLATE ───────────────────────────────────────────────────────────

const EMAIL_SUBJECT = (company) => {
  const subjects = [
    `Quick question — ${company}`,
    `A question for you, ${company}`,
    `15 minutes? — ${company}`,
  ];
  return pick(subjects);
};

const EMAIL_BODY = (firstName, company) => {
  const name      = firstName || "there";
  const opener    = pick(OPENERS);
  const compliment = pick(COMPLIMENTS).replace("{company}", company);
  const ask       = pick(ASKS);

  return `Hey ${name},

${opener}

${compliment} Because of that, I was wondering if I could get some guidance on the real problems SaaS founders face.

It will be completely anonymous — we don't have to talk about anything you're not comfortable sharing.

${ask}

Thanks,
Abdelrahman Shehata

---
Not interested? Just reply "no thanks" and I won't contact you again.`;
};

module.exports = {
  HUNTER_API_KEY, APIFY_API_KEY,
  GMAIL_USER, GMAIL_PASSWORD, SENDER_NAME,
  EMAILS_PER_BATCH,
  EMAIL_SUBJECT, EMAIL_BODY,
};
