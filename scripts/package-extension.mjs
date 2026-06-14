import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, "dist");
const packageDir = join(distDir, "codex-in-chrome");
const zipPath = join(distDir, "codex-in-chrome.zip");

const runtimeFiles = [
  "manifest.json",
  "icon-128.png",
  "src"
];

rmSync(packageDir, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(packageDir, { recursive: true });

for (const file of runtimeFiles) {
  copyRecursive(join(root, file), join(packageDir, file));
}

writeFileSync(
  join(packageDir, "RELEASE_NOTES.txt"),
  [
    "Codex in Chrome",
    "",
    "Runtime extension package.",
    "Configure OAuth, API, and native host settings from the extension options page before production use.",
    ""
  ].join("\n")
);

execFileSync(
  "powershell",
  [
    "-NoProfile",
    "-Command",
    `$items = Get-ChildItem -LiteralPath '${escapePowerShell(packageDir)}'; Compress-Archive -Path $items.FullName -DestinationPath '${escapePowerShell(zipPath)}' -Force`
  ],
  { stdio: "inherit" }
);

console.log(`Created ${zipPath}`);

function escapePowerShell(value) {
  return value.replace(/'/g, "''");
}

function copyRecursive(source, destination) {
  const stat = statSync(source);
  if (stat.isDirectory()) {
    mkdirSync(destination, { recursive: true });
    for (const name of readdirSync(source)) {
      copyRecursive(join(source, name), join(destination, name));
    }
    return;
  }
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}
