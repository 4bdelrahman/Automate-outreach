/**
 * SQLite database — tracks every lead so we never email the same person twice.
 *
 * Duplicate protection has TWO layers:
 *  1. SQLite DB (outreach.db) — full lead records
 *  2. sent.txt — plain text list of every sent email address (one per line)
 *     This is a git-friendly backup. Even if the binary DB gets out of sync
 *     between GitHub Actions runs, sent.txt catches duplicates.
 */

const Database = require("better-sqlite3");
const path     = require("path");
const fs       = require("fs");

const DB_PATH   = path.join(__dirname, "outreach.db");
const SENT_PATH = path.join(__dirname, "sent.txt");

let db;
let sentSet = new Set(); // in-memory set loaded from sent.txt

function getDB() {
  if (!db) db = new Database(DB_PATH);
  return db;
}

// Load sent.txt into memory on startup
function loadSentLog() {
  if (fs.existsSync(SENT_PATH)) {
    const lines = fs.readFileSync(SENT_PATH, "utf8").split("\n").map(l => l.trim()).filter(Boolean);
    sentSet = new Set(lines);
  }
}

// Append an email to sent.txt
function appendSentLog(email) {
  fs.appendFileSync(SENT_PATH, email + "\n", "utf8");
  sentSet.add(email);
}

function initDB() {
  loadSentLog();
  getDB().exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT,
      last_name  TEXT,
      email      TEXT UNIQUE,
      company    TEXT,
      title      TEXT,
      domain     TEXT,
      status     TEXT DEFAULT 'pending',
      sent_at    TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Sync: any email in sent.txt but still 'pending' in DB → mark as sent
  if (sentSet.size > 0) {
    const stmt = getDB().prepare("UPDATE leads SET status='sent' WHERE email=? AND status='pending'");
    let synced = 0;
    for (const email of sentSet) {
      const result = stmt.run(email);
      if (result.changes > 0) synced++;
    }
    if (synced > 0) console.log(`[DB] Synced ${synced} leads from sent.txt → DB`);
  }

  console.log("[DB] Database ready. Sent log:", sentSet.size, "emails.");
}

function leadExists(email) {
  // Check both DB and sent.txt
  if (sentSet.has(email)) return true;
  const row = getDB().prepare("SELECT 1 FROM leads WHERE email = ?").get(email);
  return !!row;
}

function insertLead({ firstName, lastName, email, company, title, domain }) {
  if (leadExists(email)) return false;
  getDB()
    .prepare(`INSERT OR IGNORE INTO leads (first_name, last_name, email, company, title, domain)
              VALUES (?, ?, ?, ?, ?, ?)`)
    .run(firstName, lastName, email, company, title, domain);
  return true;
}

function markSent(email) {
  getDB()
    .prepare("UPDATE leads SET status='sent', sent_at=datetime('now') WHERE email=?")
    .run(email);
  // Also write to sent.txt immediately as backup
  if (!sentSet.has(email)) appendSentLog(email);
}

function markFailed(email) {
  getDB()
    .prepare("UPDATE leads SET status='failed' WHERE email=?")
    .run(email);
}

function getPendingLeads(limit) {
  return getDB()
    .prepare(`SELECT first_name, last_name, email, company, title, domain
              FROM leads WHERE status='pending' LIMIT ?`)
    .all(limit)
    .map((r) => ({
      firstName: r.first_name,
      lastName:  r.last_name,
      email:     r.email,
      company:   r.company,
      title:     r.title,
      domain:    r.domain,
    }))
    // Extra safety: filter out anything already in sent.txt
    .filter((r) => !sentSet.has(r.email));
}

function printStats() {
  const d       = getDB();
  const total   = d.prepare("SELECT COUNT(*) as c FROM leads").get().c;
  const sent    = d.prepare("SELECT COUNT(*) as c FROM leads WHERE status='sent'").get().c;
  const pending = d.prepare("SELECT COUNT(*) as c FROM leads WHERE status='pending'").get().c;
  const failed  = d.prepare("SELECT COUNT(*) as c FROM leads WHERE status='failed'").get().c;
  console.log(`\n[STATS] Total: ${total} | Sent: ${sent} | Pending: ${pending} | Failed: ${failed}`);
  console.log(`[STATS] sent.txt backup: ${sentSet.size} unique emails`);
}

module.exports = { initDB, leadExists, insertLead, markSent, markFailed, getPendingLeads, printStats };
