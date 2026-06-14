import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const errors = [];

const requiredFiles = [
  "manifest.json",
  "icon-128.png",
  "src/background.js",
  "src/content.js",
  "src/sidepanel.html",
  "src/sidepanel.js",
  "src/options.html",
  "src/options.js",
  "src/oauth.js",
  "src/native.js",
  "src/tasks.js",
  "docs/BRIDGE_CONTRACT.md",
  "examples/native-host/node-host.mjs"
];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) errors.push(`Missing required file: ${file}`);
}

const manifest = readJson("manifest.json");
if (manifest) {
  assert(manifest.manifest_version === 3, "manifest_version must be 3");
  assert(manifest.name === "Codex in Chrome", "manifest name must be Codex in Chrome");
  for (const permission of ["sidePanel", "identity", "nativeMessaging", "tabGroups", "tabs", "storage"]) {
    assert(manifest.permissions?.includes(permission), `manifest missing permission: ${permission}`);
  }
  assert(manifest.side_panel?.default_path === "src/sidepanel.html", "side panel path mismatch");
  assert(manifest.background?.service_worker === "src/background.js", "background service worker mismatch");
}

for (const file of listFiles(root).filter((file) => /\.(js|html|css|json|md)$/.test(file))) {
  const text = readFileSync(join(root, file), "utf8");
  if (!file.startsWith("README.md") && !file.startsWith("docs/")) {
    assert(!/\bClaude\b|Anthropic|demo/i.test(text), `Unexpected Claude/Anthropic/demo text in ${file}`);
  }
}

const readme = readFileSync(join(root, "README.md"), "utf8");
assert(!/\bscaffold\b/i.test(readme), "README must not describe the extension as a scaffold");
assert(!/demo login|fake login/i.test(readme), "README must not describe a demo or fake login path");

for (const file of listFiles(join(root, "src")).filter((file) => file.endsWith(".js"))) {
  execFileSync("node", ["--check", join(root, "src", file)], { stdio: "pipe" });
}
execFileSync("node", ["--check", join(root, "examples/native-host/node-host.mjs")], { stdio: "pipe" });

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("Extension validation passed.");

function readJson(file) {
  try {
    return JSON.parse(readFileSync(join(root, file), "utf8"));
  } catch (error) {
    errors.push(`Invalid JSON in ${file}: ${error.message}`);
    return null;
  }
}

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function listFiles(dir, prefix = "") {
  return readdirSync(dir).flatMap((name) => {
    const fullPath = join(dir, name);
    const relative = prefix ? `${prefix}/${name}` : name;
    if (statSync(fullPath).isDirectory()) return listFiles(fullPath, relative);
    return relative;
  });
}
