import { readFile, readdir, access } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const extension = join(root, "extension");
const manifest = JSON.parse(await readFile(join(extension, "manifest.json"), "utf8"));
const errors = [];

if (manifest.manifest_version !== 3) errors.push("manifest_version must be 3");
if (!/^\d+\.\d+\.\d+(\.\d+)?$/.test(manifest.version || "")) errors.push("manifest version is invalid");

const required = [
  "service_worker.js", "content.js", "content.css", "popup.html", "popup.js",
  "popup.css", "options.html", "options.js", "options.css",
  "icons/icon16.png", "icons/icon32.png", "icons/icon48.png", "icons/icon128.png"
];

for (const file of required) {
  try { await access(join(extension, file)); }
  catch { errors.push(`missing required file: ${file}`); }
}

const ids = new Map();
for (const resource of manifest.declarative_net_request?.rule_resources || []) {
  const path = join(extension, resource.path);
  let rules;
  try { rules = JSON.parse(await readFile(path, "utf8")); }
  catch (error) { errors.push(`cannot parse ${resource.path}: ${error.message}`); continue; }
  if (!Array.isArray(rules)) { errors.push(`${resource.path} must contain a JSON array`); continue; }
  for (const rule of rules) {
    if (!Number.isInteger(rule.id)) errors.push(`${resource.path} contains a rule without an integer id`);
    if (ids.has(rule.id)) errors.push(`duplicate rule id ${rule.id} in ${resource.path} and ${ids.get(rule.id)}`);
    else ids.set(rule.id, resource.path);
    if (!rule.action?.type || !rule.condition) errors.push(`rule ${rule.id} in ${resource.path} is incomplete`);
  }
}

const files = await readdir(extension);
if (files.includes("package.json")) errors.push("extension package should not contain repository package.json");

if (errors.length) {
  console.error("Validation failed:\n- " + errors.join("\n- "));
  process.exit(1);
}

console.log(`Validation passed: ${ids.size} DNR rules across ${manifest.declarative_net_request.rule_resources.length} rulesets.`);
