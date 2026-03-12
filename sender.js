/**
 * Gmail SMTP sender — sends personalised cold emails.
 * Reads pending leads from DB and marks them sent / failed.
 */

const nodemailer = require("nodemailer");
const config     = require("./config");
const database   = require("./database");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createTransport() {
  return nodemailer.createTransport({
    host:   "smtp.gmail.com",
    port:   587,
    secure: false,
    auth: {
      user: config.GMAIL_USER,
      pass: config.GMAIL_PASSWORD,
    },
  });
}

async function sendBatch(limit) {
  const leads = database.getPendingLeads(limit);

  if (!leads.length) {
    console.log("[SENDER] No pending leads to email.");
    return;
  }

  const transport = createTransport();

  // Verify connection once before sending
  try {
    await transport.verify();
    console.log("[SENDER] Gmail connection verified.");
  } catch (err) {
    console.log(`[SENDER] Gmail connection failed: ${err.message}`);
    return;
  }

  // Filter out domain-marker placeholders (no real email to send to)
  const realLeads = leads.filter((l) => !l.email.startsWith("__domain__") && l.firstName !== "__searched__");
  const skipped   = leads.length - realLeads.length;
  if (skipped > 0) {
    // Mark placeholders as failed so they don't reappear
    leads
      .filter((l) => l.email.startsWith("__domain__") || l.firstName === "__searched__")
      .forEach((l) => database.markFailed(l.email));
  }

  let sentCount = 0;

  for (const lead of realLeads) {
    const company = lead.company || "your company";

    const mailOptions = {
      from:    `"${config.SENDER_NAME}" <${config.GMAIL_USER}>`,
      to:      lead.email,
      subject: config.EMAIL_SUBJECT(company),
      text:    config.EMAIL_BODY(lead.firstName, company),
    };

    try {
      await transport.sendMail(mailOptions);
      database.markSent(lead.email);
      sentCount++;
      console.log(`[SENT] ${lead.firstName} ${lead.lastName} <${lead.email}> — ${company}`);
    } catch (err) {
      database.markFailed(lead.email);
      console.log(`[FAILED] ${lead.email}: ${err.message}`);
    }

    // Small delay between sends to avoid spam triggers
    await sleep(3000);
  }

  console.log(`\n[SENDER] Done. ${sentCount}/${realLeads.length} emails sent.`);
  transport.close();
}

module.exports = { sendBatch };
