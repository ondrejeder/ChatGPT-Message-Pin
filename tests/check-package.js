"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ["storage"]);
assert.deepEqual(manifest.host_permissions, ["https://chatgpt.com/*"]);
assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required, ["none"]);

const sourceFiles = manifest.content_scripts.flatMap((entry) => [...(entry.js || []), ...(entry.css || [])]);
for (const relativePath of sourceFiles) {
  assert.ok(fs.existsSync(path.join(root, relativePath)), `Missing manifest file: ${relativePath}`);
}
for (const relativePath of Object.values(manifest.icons)) {
  assert.ok(fs.existsSync(path.join(root, relativePath)), `Missing icon: ${relativePath}`);
}

for (const relativePath of manifest.content_scripts.flatMap((entry) => entry.js || [])) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  assert.doesNotMatch(source, /\beval\s*\(|\bnew\s+Function\s*\(/);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket/);
}

console.log("Manifest and package checks passed.");
