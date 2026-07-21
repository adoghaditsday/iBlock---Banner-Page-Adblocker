import { readFile, mkdir, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const extension = join(root, "extension");
const manifest = JSON.parse(await readFile(join(extension, "manifest.json"), "utf8"));
const dist = join(root, "dist");
const output = join(dist, `iblock-banner-page-ad-blocker-v${manifest.version}.zip`);

await mkdir(dist, { recursive: true });
await rm(output, { force: true });

const validation = spawnSync(process.execPath, [join(root, "scripts", "validate.mjs")], { stdio: "inherit" });
if (validation.status !== 0) process.exit(validation.status ?? 1);

const result = spawnSync("zip", ["-q", "-r", output, "."], { cwd: extension, stdio: "inherit" });
if (result.error || result.status !== 0) {
  console.error("Packaging requires the `zip` command on PATH.");
  process.exit(result.status ?? 1);
}
console.log(`Created ${output}`);
