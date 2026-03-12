/**
 * main.js — Autopilot orchestrator
 *
 * node main.js          → start local scheduler (every 30 min)
 * node main.js --now    → run one batch immediately
 * node main.js --stats  → print stats only
 * node main.js --import leads.csv  → import leads from CSV
 *
 * On GitHub Actions: just runs --now (the cloud cron handles the schedule)
 */

const schedule = require("node-schedule");
const config   = require("./config");
const database = require("./database");
const leads    = require("./leads");
const sender   = require("./sender");

async function runBatch() {
  const now = new Date().toLocaleString();
  console.log(`\n${"=".repeat(55)}`);
  console.log(` BATCH RUN — ${now}`);
  console.log("=".repeat(55));

  // Step 1: Find new leads (HN Show posts → Hunter)
  console.log(`\n[STEP 1] Finding ${config.EMAILS_PER_BATCH} new SaaS leads…`);
  await leads.collectLeads(config.EMAILS_PER_BATCH);

  // Step 2: Send emails to pending leads
  console.log(`\n[STEP 2] Sending up to ${config.EMAILS_PER_BATCH} emails…`);
  await sender.sendBatch(config.EMAILS_PER_BATCH);

  // Step 3: Print stats
  database.printStats();
  console.log(`\n[DONE] Batch complete.\n`);
}

async function main() {
  database.initDB();

  const args = process.argv.slice(2);

  if (args.includes("--stats")) {
    database.printStats();
    return;
  }

  if (args.includes("--now")) {
    await runBatch();
    return;
  }

  const importIdx = args.indexOf("--import");
  if (importIdx !== -1) {
    const file = args[importIdx + 1];
    if (!file) { console.log("Usage: node main.js --import <file.csv>"); return; }
    leads.importFromCSV(file);
    return;
  }

  // ── Local autopilot: run immediately then every 30 minutes ──────────────────
  console.log("[AUTOPILOT] Starting — will run every 30 minutes.");
  console.log("[AUTOPILOT] Press Ctrl+C to stop.\n");

  // Run once right away
  await runBatch();

  // Then every 30 minutes
  schedule.scheduleJob("*/30 * * * *", runBatch);
  console.log("[AUTOPILOT] Next run in 30 minutes. Keeping process alive…");
}

main().catch((err) => {
  console.error("[ERROR]", err.message);
  process.exit(1);
});
