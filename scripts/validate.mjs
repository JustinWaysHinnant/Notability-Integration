import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = path.join(root, "plugins", "notability-access");

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

const manifest = readJson("plugins/notability-access/.codex-plugin/plugin.json");
assert.equal(manifest.name, "notability-access");
assert.match(manifest.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
assert.ok(manifest.description);
assert.equal(manifest.skills, "./skills/");
assert.equal(manifest.mcpServers, "./.mcp.json");
assert.ok(fs.existsSync(path.join(pluginRoot, ".mcp.json")));

const marketplace = readJson(".agents/plugins/marketplace.json");
assert.equal(marketplace.name, "notability-integration");
assert.equal(marketplace.plugins.length, 1);
assert.deepEqual(marketplace.plugins[0].policy, {
  installation: "AVAILABLE",
  authentication: "ON_INSTALL"
});
assert.equal(marketplace.plugins[0].source.path, "./plugins/notability-access");

const mcp = readJson("plugins/notability-access/.mcp.json");
assert.ok(mcp.mcpServers.notability_access);
assert.equal(mcp.mcpServers.notability_access.command, "node");

const skill = fs.readFileSync(
  path.join(pluginRoot, "skills", "notability-access", "SKILL.md"),
  "utf8"
);
assert.match(skill, /^---\n[\s\S]*?name: notability-access[\s\S]*?\n---/);
assert.doesNotMatch(skill, /\[TODO:/);

for (const file of [
  "plugins/notability-access/.codex-plugin/plugin.json",
  "plugins/notability-access/.mcp.json",
  ".agents/plugins/marketplace.json"
]) {
  assert.doesNotMatch(fs.readFileSync(path.join(root, file), "utf8"), /\[TODO:/);
}

console.log("Repository manifests are valid.");
