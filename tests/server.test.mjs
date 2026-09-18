import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverPath = path.join(repositoryRoot, "plugins", "notability-access", "scripts", "server.mjs");

let backupRoot;
let outsideFile;
let server;
let nextId = 1;
let output = "";
const pending = new Map();

function call(method, params = {}) {
  const id = nextId++;
  server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for ${method}`));
    }, 5000);
    pending.set(id, value => {
      clearTimeout(timeout);
      resolve(value);
    });
  });
}

function parseContent(response) {
  return JSON.parse(response.result.content[0].text);
}

before(async () => {
  backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), "notability-access-"));
  const course = path.join(backupRoot, "Course");
  fs.mkdirSync(course);
  fs.writeFileSync(path.join(course, "Lecture 01.txt"), "The Calvin cycle fixes carbon dioxide.\n", "utf8");
  fs.writeFileSync(path.join(backupRoot, "Kickoff.rtf"), "{\\rtf1\\ansi Project kickoff\\par Next step: draft the brief.}", "utf8");
  outsideFile = path.join(path.dirname(backupRoot), `${path.basename(backupRoot)}-outside.txt`);
  fs.writeFileSync(outsideFile, "private", "utf8");

  server = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    env: { ...process.env, NOTABILITY_BACKUP_DIR: backupRoot },
    stdio: ["pipe", "pipe", "pipe"]
  });

  server.stdout.setEncoding("utf8");
  server.stdout.on("data", chunk => {
    output += chunk;
    while (output.includes("\n")) {
      const newline = output.indexOf("\n");
      const line = output.slice(0, newline).trim();
      output = output.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      const resolver = pending.get(message.id);
      if (resolver) {
        pending.delete(message.id);
        resolver(message);
      }
    }
  });

  const initialized = await call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test", version: "1.0.0" }
  });
  assert.equal(initialized.result.serverInfo.name, "notability-access");
});

after(() => {
  server?.kill();
  fs.rmSync(backupRoot, { recursive: true, force: true });
  fs.rmSync(outsideFile, { force: true });
});

test("lists the expected tools", async () => {
  const response = await call("tools/list");
  assert.deepEqual(
    response.result.tools.map(tool => tool.name),
    ["configure_backup", "status", "list_notes", "search_notes", "read_note"]
  );
});

test("reports indexed exports", async () => {
  const response = await call("tools/call", { name: "status", arguments: {} });
  const status = parseContent(response);
  assert.equal(status.configured, true);
  assert.equal(status.indexedFiles, 2);
});

test("searches extracted text", async () => {
  const response = await call("tools/call", {
    name: "search_notes",
    arguments: { query: "Calvin" }
  });
  const result = parseContent(response);
  assert.equal(result.count, 1);
  assert.equal(result.matches[0].matched, "text");
});

test("extracts basic RTF text", async () => {
  const response = await call("tools/call", {
    name: "read_note",
    arguments: { path: "Kickoff.rtf" }
  });
  const result = parseContent(response);
  assert.match(result.text, /Project kickoff/);
  assert.match(result.text, /draft the brief/);
});

test("rejects access outside the configured folder", async () => {
  const response = await call("tools/call", {
    name: "read_note",
    arguments: { path: path.relative(backupRoot, outsideFile) }
  });
  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /outside the configured Notability folder/);
});
