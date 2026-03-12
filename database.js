/**
 * SQLite database — tracks every lead so we never email the same person twice.
 */

const Database = require("better-sqlite3");
const path     = require("path");

const DB_PATH = path.join(__dirname, "outreach.db");
let db;

function getDB() {
  if (!db) db = new Database(DB_PATH);
  return db;
}

function initDB() {
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
  console.log("[DB] Database ready.");
}

function leadExists(email) {
  const row = getDB()
    .prepare("SELECT 1 FROM leads WHERE email = ?")
    .get(email);
  return !!row;
}

function insertLead({ firstName, lastName, email, company, title, domain }) {
  if (leadExists(email)) return false;
  getDB()
    .prepare(
      `INSERT INTO leads (first_name, last_name, email, company, title, domain)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(firstName, lastName, email, company, title, domain);
  return true;
}

function markSent(email) {
  getDB()
    .prepare("UPDATE leads SET status='sent', sent_at=datetime('now') WHERE email=?")
    .run(email);
}

function markFailed(email) {
  getDB()
    .prepare("UPDATE leads SET status='failed' WHERE email=?")
    .run(email);
}

function getPendingLeads(limit) {
  return getDB()
    .prepare(
      `SELECT first_name, last_name, email, company, title, domain
       FROM leads WHERE status='pending' LIMIT ?`
    )
    .all(limit)
    .map((r) => ({
      firstName: r.first_name,
      lastName:  r.last_name,
      email:     r.email,
      company:   r.company,
      title:     r.title,
      domain:    r.domain,
    }));
}

function printStats() {
  const db   = getDB();
  const total   = db.prepare("SELECT COUNT(*) as c FROM leads").get().c;
  const sent    = db.prepare("SELECT COUNT(*) as c FROM leads WHERE status='sent'").get().c;
  const pending = db.prepare("SELECT COUNT(*) as c FROM leads WHERE status='pending'").get().c;
  const failed  = db.prepare("SELECT COUNT(*) as c FROM leads WHERE status='failed'").get().c;
  console.log(`\n[STATS] Total: ${total} | Sent: ${sent} | Pending: ${pending} | Failed: ${failed}`);
}

module.exports = { initDB, leadExists, insertLead, markSent, markFailed, getPendingLeads, printStats };
