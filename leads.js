/**
 * Lead generation pipeline:
 *  1. Apify (Google Search Scraper) — finds SaaS founders from Google results
 *  2. Hunter.io                     — finds their email by company domain
 *  3. database                      — stores new leads, skips duplicates
 *
 * Apify scrapes Google for queries like:
 *   "CEO" "SaaS" startup founder company site:linkedin.com
 * giving us real SaaS founders with names + company domains.
 */

const axios    = require("axios");
const config   = require("./config");
const database = require("./database");
const fs       = require("fs");
const path     = require("path");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── APIFY ────────────────────────────────────────────────────────────────────

const APIFY_BASE = "https://api.apify.com/v2";

// Targeted Google queries to find SaaS CEOs/Founders
const SEARCH_QUERIES = [
  '"CEO" "SaaS" startup founder company site:linkedin.com',
  '"Founder" "B2B SaaS" company site:linkedin.com/in',
  '"Co-Founder" SaaS software startup site:linkedin.com/in',
  '"CEO" "SaaS platform" site:linkedin.com/in',
  '"Founder" "SaaS company" site:linkedin.com/in',
  '"CEO" saas b2b startup "about" contact',
  'saas startup founder CEO "our team" site:*.io OR site:*.co',
];

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function extractNameFromLinkedIn(url) {
  try {
    // LinkedIn URLs: linkedin.com/in/john-doe → "John Doe"
    const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
    if (!match) return null;
    const slug = match[1].replace(/-\d+$/, ""); // remove trailing -123 suffix
    const parts = slug.split("-").filter(p => p.length > 1 && !/\d/.test(p));
    if (parts.length < 2) return null;
    const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    const lastName  = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
    return { firstName, lastName };
  } catch {
    return null;
  }
}

async function runApifyScraper(queries) {
  console.log("[APIFY] Starting Google Search scraper…");

  // Start actor run
  let runResp;
  try {
    runResp = await axios.post(
      `${APIFY_BASE}/acts/apify~google-search-scraper/runs`,
      {
        queries:           queries.join("\n"),
        resultsPerPage:    10,
        maxPagesPerQuery:  1,
        languageCode:      "en",
        countryCode:       "us",
        saveHtml:          false,
        saveHtmlToKeyValueStore: false,
      },
      {
        params:  { token: config.APIFY_API_KEY },
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );
  } catch (err) {
    console.log(`[APIFY] Failed to start actor: ${err.message}`);
    return [];
  }

  const runId      = runResp.data.data.id;
  const datasetId  = runResp.data.data.defaultDatasetId;
  console.log(`[APIFY] Run started: ${runId}`);

  // Poll until finished (max 3 minutes)
  for (let i = 0; i < 36; i++) {
    await sleep(5000);
    const statusResp = await axios.get(
      `${APIFY_BASE}/actor-runs/${runId}`,
      { params: { token: config.APIFY_API_KEY }, timeout: 10000 }
    );
    const status = statusResp.data.data.status;
    console.log(`[APIFY] Status: ${status}`);
    if (status === "SUCCEEDED") break;
    if (status === "FAILED" || status === "ABORTED") {
      console.log("[APIFY] Run failed.");
      return [];
    }
  }

  // Fetch results
  const itemsResp = await axios.get(
    `${APIFY_BASE}/datasets/${datasetId}/items`,
    {
      params:  { token: config.APIFY_API_KEY, format: "json", limit: 200 },
      timeout: 20000,
    }
  );

  const results = itemsResp.data || [];
  console.log(`[APIFY] Got ${results.length} search result items`);
  return results;
}

function parseApifyResults(results) {
  const leads = [];
  const seenDomains = new Set();

  for (const page of results) {
    const items = page.organicResults || page.items || [];
    for (const item of items) {
      const url   = item.url || item.link || "";
      const title = item.title || "";

      if (!url) continue;

      const isLinkedIn = url.includes("linkedin.com/in/");
      const domain     = extractDomain(url);

      if (!domain) continue;

      // Skip irrelevant domains
      const skip = ["google.com","youtube.com","twitter.com","facebook.com",
                    "reddit.com","medium.com","github.com","wikipedia.org"];
      if (skip.some(s => domain.includes(s))) continue;

      if (isLinkedIn) {
        const name = extractNameFromLinkedIn(url);
        if (name && !seenDomains.has(url)) {
          seenDomains.add(url);
          // Extract company domain from title if possible
          // Title often: "John Doe - CEO at Acme Inc | LinkedIn"
          const companyMatch = title.match(/(?:at|@)\s+([^|]+)/i);
          const company = companyMatch ? companyMatch[1].trim() : "";
          leads.push({
            firstName: name.firstName,
            lastName:  name.lastName,
            company,
            domain:    null, // will resolve via Hunter domain search
            linkedInUrl: url,
            title: title,
          });
        }
      } else {
        // Non-LinkedIn result — use the domain for Hunter domain search
        if (!seenDomains.has(domain)) {
          seenDomains.add(domain);
          // Try to extract company name from title
          const company = title.split(/[-|]/)[0].trim();
          leads.push({
            firstName: "",
            lastName:  "",
            company,
            domain,
            linkedInUrl: null,
            title: "",
          });
        }
      }
    }
  }

  console.log(`[APIFY] Parsed ${leads.length} potential leads`);
  return leads;
}

// ─── HUNTER.IO ────────────────────────────────────────────────────────────────

const FOUNDER_KEYWORDS = ["ceo","founder","co-founder","owner","president","managing director"];

async function findEmailByDomain(domain) {
  try {
    const resp = await axios.get("https://api.hunter.io/v2/domain-search", {
      params: { domain, type: "personal", api_key: config.HUNTER_API_KEY },
      timeout: 15000,
    });
    const emails = (resp.data.data || {}).emails || [];
    const founder = emails.find(e =>
      FOUNDER_KEYWORDS.some(k => (e.position || "").toLowerCase().includes(k))
    ) || emails[0];
    if (!founder) return null;
    return {
      email:     founder.value,
      firstName: founder.first_name || "",
      lastName:  founder.last_name  || "",
      title:     founder.position   || "",
    };
  } catch (err) {
    console.log(`[HUNTER] Error for ${domain}: ${err.message}`);
    return null;
  }
}

async function findEmailByName(firstName, lastName, domain) {
  try {
    const resp = await axios.get("https://api.hunter.io/v2/email-finder", {
      params: { first_name: firstName, last_name: lastName, domain, api_key: config.HUNTER_API_KEY },
      timeout: 15000,
    });
    const email = (resp.data.data || {}).email;
    return email || null;
  } catch {
    return null;
  }
}

// ─── PIPELINE ─────────────────────────────────────────────────────────────────

async function collectLeads(targetCount) {
  let added = 0;

  // Pick a rotating subset of queries to stay within Apify free tier
  const hour    = new Date().getHours();
  const queries = SEARCH_QUERIES.slice(
    (hour % SEARCH_QUERIES.length),
    (hour % SEARCH_QUERIES.length) + 3
  ).concat(SEARCH_QUERIES.slice(0, Math.max(0, 3 - (SEARCH_QUERIES.length - (hour % SEARCH_QUERIES.length)))));

  // Run Apify scraper
  const rawResults = await runApifyScraper(queries);
  const candidates = parseApifyResults(rawResults);

  for (const candidate of candidates) {
    if (added >= targetCount) break;

    let result = null;

    if (candidate.firstName && candidate.lastName && candidate.domain) {
      // Best case: we have name + domain
      const email = await findEmailByName(candidate.firstName, candidate.lastName, candidate.domain);
      if (email) result = { email, firstName: candidate.firstName, lastName: candidate.lastName, title: candidate.title };
    } else if (candidate.domain) {
      // Domain only: use domain search
      if (!database.leadExists("__domain__" + candidate.domain)) {
        result = await findEmailByDomain(candidate.domain);
        database.insertLead({ firstName: "__searched__", lastName: "", email: "__domain__" + candidate.domain, company: candidate.domain, title: "", domain: candidate.domain });
      }
    } else if (candidate.firstName && candidate.lastName) {
      // LinkedIn name only: skip (no domain to search)
      continue;
    }

    if (!result || !result.email) {
      await sleep(1000);
      continue;
    }

    if (database.leadExists(result.email)) {
      console.log(`[DB] Already exists: ${result.email}`);
      continue;
    }

    const inserted = database.insertLead({
      firstName: result.firstName || candidate.firstName,
      lastName:  result.lastName  || candidate.lastName,
      email:     result.email,
      company:   candidate.company || candidate.domain || "",
      title:     result.title || candidate.title || "",
      domain:    candidate.domain || "",
    });

    if (inserted) {
      added++;
      console.log(`[NEW LEAD] ${result.firstName} ${result.lastName} <${result.email}> — ${candidate.company || candidate.domain}`);
    }

    await sleep(1200);
  }

  // Fallback: if Apify didn't give enough leads, top up from HN
  if (added < targetCount) {
    console.log(`[LEADS] Apify gave ${added}/${targetCount} — topping up from HN…`);
    const hnLeads = await collectFromHN(targetCount - added);
    added += hnLeads;
  }

  console.log(`[LEADS] Done. ${added} new leads added.`);
  return added;
}

// ─── HN FALLBACK ──────────────────────────────────────────────────────────────

async function collectFromHN(targetCount) {
  let added = 0;
  const HN_TERMS = ["saas b2b","software startup","show hn saas"];

  for (const term of HN_TERMS) {
    if (added >= targetCount) break;
    try {
      const resp = await axios.get("https://hn.algolia.com/api/v1/search", {
        params: { query: term, tags: "show_hn", hitsPerPage: 20, page: 0 },
        timeout: 15000,
      });
      for (const hit of (resp.data.hits || [])) {
        if (added >= targetCount) break;
        const url = hit.url || "";
        const domain = extractDomain(url);
        if (!domain) continue;
        const skip = ["github.com","youtube.com","twitter.com","reddit.com","medium.com","linkedin.com","google.com"];
        if (skip.some(s => domain.includes(s))) continue;
        if (database.leadExists("__domain__" + domain)) continue;

        const result = await findEmailByDomain(domain);
        database.insertLead({ firstName: "__searched__", lastName: "", email: "__domain__" + domain, company: domain, title: "", domain });

        if (!result) { await sleep(1000); continue; }
        if (database.leadExists(result.email)) continue;

        const inserted = database.insertLead({
          firstName: result.firstName, lastName: result.lastName,
          email: result.email, company: domain, title: result.title, domain,
        });
        if (inserted) { added++; console.log(`[HN LEAD] ${result.firstName} ${result.lastName} <${result.email}> — ${domain}`); }
        await sleep(1200);
      }
    } catch (err) {
      console.log(`[HN] Error: ${err.message}`);
    }
  }
  return added;
}

// ─── CSV IMPORT ───────────────────────────────────────────────────────────────

function importFromCSV(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) { console.log(`[CSV] Not found: ${abs}`); return 0; }
  const lines  = fs.readFileSync(abs, "utf8").split("\n").filter(Boolean);
  const header = lines[0].toLowerCase().split(",").map(h => h.trim());
  let count = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim().replace(/"/g, ""));
    const row  = {};
    header.forEach((h, idx) => (row[h] = cols[idx] || ""));
    if (!row.email) continue;
    const inserted = database.insertLead({
      firstName: row.first_name || row.firstname || "",
      lastName:  row.last_name  || row.lastname  || "",
      email: row.email, company: row.company || "", title: row.title || "", domain: row.domain || "",
    });
    if (inserted) count++;
  }
  console.log(`[CSV] Imported ${count} new leads`);
  return count;
}

module.exports = { collectLeads, importFromCSV };
