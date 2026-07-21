#!/usr/bin/env node
/**
 * Optional build helper: converts HaGeZi DNS/adblock-format domain lists into
 * Chrome MV3 declarativeNetRequest rules.
 *
 * It intentionally fetches data at developer build time, not extension runtime.
 * Review third-party licenses and Chrome Web Store policy before shipping the
 * generated rules inside a public extension release.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCES = {
  // Big broom / balanced. For browser packages, the mini list is usually safer.
  hagezi_pro_mini: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/pro.mini.txt',
  hagezi_popup_ads: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/popupads.txt',
  hagezi_native: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/native.txt'
};

const RESOURCE_TYPES = [
  'main_frame','sub_frame','stylesheet','script','image','font','object','xmlhttprequest','ping','csp_report','media','websocket','other'
];

const MAX_RULES_PER_FILE = Number(process.env.MAX_RULES || 25000);
const OUT = path.resolve('rules/generated_hagezi_sinkhole.json');

function extractDomain(line) {
  line = line.trim();
  if (!line || line.startsWith('!') || line.startsWith('#') || line.startsWith('[')) return null;
  // ABP style: ||example.com^
  let m = line.match(/^\|\|([a-z0-9.-]+)\^/i);
  if (m) return clean(m[1]);
  // hosts style: 0.0.0.0 example.com
  m = line.match(/^(?:0\.0\.0\.0|127\.0\.0\.1)\s+([a-z0-9.-]+)$/i);
  if (m) return clean(m[1]);
  // domain-only style
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(line)) return clean(line);
  return null;
}

function clean(d) {
  d = d.toLowerCase().replace(/^\*\./, '').replace(/^www\./, '');
  if (!d.includes('.') || d.includes('/') || d.includes('*')) return null;
  return d;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'iBlock-DNR-builder/2.1' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

const domains = new Set();
for (const [name, url] of Object.entries(SOURCES)) {
  try {
    console.log(`Fetching ${name}: ${url}`);
    const txt = await fetchText(url);
    for (const line of txt.split(/\r?\n/)) {
      const d = extractDomain(line);
      if (d) domains.add(d);
    }
  } catch (e) {
    console.warn(`Skipping ${name}: ${e.message}`);
  }
}

const allowlist = new Set([
  'twitch.tv','jtvnw.net','ttvnw.net','youtube.com','youtu.be','googlevideo.com','ytimg.com',
  'github.com','nexusmods.com','reddit.com','wikipedia.org'
]);
const finalDomains = [...domains].filter(d => ![...allowlist].some(a => d === a || d.endsWith('.' + a))).slice(0, MAX_RULES_PER_FILE);

const rules = finalDomains.map((d, i) => ({
  id: 100000 + i,
  priority: 35,
  action: { type: 'block' },
  condition: { urlFilter: `||${d}^`, resourceTypes: RESOURCE_TYPES }
}));
await fs.writeFile(OUT, JSON.stringify(rules, null, 2));
console.log(`Wrote ${rules.length} DNR rules to ${OUT}`);
console.log('Add this file as a static ruleset in manifest.json after testing rule count and false positives.');
