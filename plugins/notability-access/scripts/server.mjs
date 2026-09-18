import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SERVER_NAME = "notability-access";
const SERVER_VERSION = "0.1.0";
const SUPPORTED = new Set([
  ".pdf", ".rtf", ".rtfd", ".txt", ".md", ".html", ".htm",
  ".note", ".zip", ".m4a", ".mp3", ".wav", ".png", ".jpg", ".jpeg"
]);
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".rtf", ".html", ".htm"]);
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const MAX_SCAN_BYTES = 20 * 1024 * 1024;
const MAX_RETURN_CHARS = 120000;

function configPath() {
  const base = process.env.LOCALAPPDATA || path.join(os.homedir(), ".config");
  return path.join(base, "Codex", "notability-access", "config.json");
}

function jsonText(value) {
  return { type: "text", text: JSON.stringify(value, null, 2) };
}

function toolError(message) {
  return { isError: true, content: [{ type: "text", text: message }] };
}

function loadConfiguredRoot() {
  const fromEnv = process.env.NOTABILITY_BACKUP_DIR?.trim();
  if (fromEnv) return fromEnv;
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath(), "utf8"));
    return typeof parsed.root === "string" ? parsed.root : null;
  } catch {
    return null;
  }
}

function validateRoot(candidate) {
  if (!candidate || typeof candidate !== "string") {
    throw new Error("No backup folder is configured. Call configure_backup with an absolute folder path.");
  }
  if (!path.isAbsolute(candidate)) throw new Error("The backup folder must be an absolute path.");
  const real = fs.realpathSync(candidate);
  if (!fs.statSync(real).isDirectory()) throw new Error("The configured path is not a directory.");
  return real;
}

function getRoot() {
  return validateRoot(loadConfiguredRoot());
}

function safeRelative(root, requested) {
  if (!requested || typeof requested !== "string" || path.isAbsolute(requested)) {
    throw new Error("Use a relative note path returned by list_notes or search_notes.");
  }
  const candidate = fs.realpathSync(path.resolve(root, requested));
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("The requested file is outside the configured Notability folder.");
  }
  if (!fs.statSync(candidate).isFile()) throw new Error("The requested path is not a file.");
  return candidate;
}

function normalizeLimit(value) {
  const parsed = Number(value ?? DEFAULT_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(parsed)));
}

function walk(root, maxResults = MAX_LIMIT) {
  const results = [];
  const pending = [root];
  while (pending.length && results.length < maxResults) {
    const current = pending.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(full);
      else if (entry.isFile() && SUPPORTED.has(path.extname(entry.name).toLowerCase())) {
        const stat = fs.statSync(full);
        results.push({
          path: path.relative(root, full),
          title: path.basename(entry.name, path.extname(entry.name)),
          format: path.extname(entry.name).slice(1).toLowerCase(),
          sizeBytes: stat.size,
          modifiedAt: stat.mtime.toISOString()
        });
        if (results.length >= maxResults) break;
      }
    }
  }
  return results;
}

function decodeBuffer(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.toString("utf16le");
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.allocUnsafe(buffer.length - 2);
    for (let i = 2; i + 1 < buffer.length; i += 2) {
      swapped[i - 2] = buffer[i + 1];
      swapped[i - 1] = buffer[i];
    }
    return swapped.toString("utf16le");
  }
  return buffer.toString("utf8");
}

function stripRtf(input) {
  return input
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\tab\b/g, "\t")
    .replace(/\\'[0-9a-fA-F]{2}/g, match => String.fromCharCode(parseInt(match.slice(2), 16)))
    .replace(/\\u(-?\d+)\??/g, (_, number) => String.fromCharCode(Number(number) < 0 ? Number(number) + 65536 : Number(number)))
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\\([{}\\])/g, "$1");
}

function stripHtml(input) {
  return input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ");
}

function extractText(fullPath) {
  const stat = fs.statSync(fullPath);
  if (stat.size > MAX_SCAN_BYTES) throw new Error(`Text export is too large to scan (${stat.size} bytes).`);
  const ext = path.extname(fullPath).toLowerCase();
  let text = decodeBuffer(fs.readFileSync(fullPath));
  if (ext === ".rtf") text = stripRtf(text);
  if (ext === ".html" || ext === ".htm") text = stripHtml(text);
  return text.replace(/\0/g, "").trim();
}

function listNotes(args) {
  const root = getRoot();
  const limit = normalizeLimit(args.limit);
  const query = String(args.query || "").trim().toLowerCase();
  const format = String(args.format || "").replace(/^\./, "").trim().toLowerCase();
  const all = walk(root, MAX_LIMIT)
    .filter(item => !query || item.title.toLowerCase().includes(query) || item.path.toLowerCase().includes(query))
    .filter(item => !format || item.format === format)
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
    .slice(0, limit);
  return { root, count: all.length, notes: all };
}

function searchNotes(args) {
  const root = getRoot();
  const query = String(args.query || "").trim();
  if (!query) throw new Error("query is required.");
  const needle = query.toLowerCase();
  const limit = normalizeLimit(args.limit);
  const candidates = walk(root, MAX_LIMIT);
  const matches = [];
  for (const item of candidates) {
    const filenameMatch = item.path.toLowerCase().includes(needle);
    let excerpt = null;
    let textMatch = false;
    if (TEXT_EXTENSIONS.has(`.${item.format}`) && item.sizeBytes <= MAX_SCAN_BYTES) {
      try {
        const full = safeRelative(root, item.path);
        const text = extractText(full);
        const index = text.toLowerCase().indexOf(needle);
        if (index >= 0) {
          textMatch = true;
          excerpt = text.slice(Math.max(0, index - 180), Math.min(text.length, index + query.length + 360));
        }
      } catch {
        // A single unreadable export must not fail the whole search.
      }
    }
    if (filenameMatch || textMatch) matches.push({ ...item, matched: textMatch ? "text" : "filename", excerpt });
    if (matches.length >= limit) break;
  }
  return { query, count: matches.length, matches };
}

const tools = [
  {
    name: "configure_backup",
    description: "Configure the absolute local folder containing Notability Auto-Backup or exported notes. Stores only the folder path.",
    inputSchema: {
      type: "object",
      properties: { root: { type: "string", description: "Absolute path to the synced Notability backup folder." } },
      required: ["root"],
      additionalProperties: false
    }
  },
  {
    name: "status",
    description: "Check whether Notability Access is configured and summarize available export files.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "list_notes",
    description: "List Notability exports, sorted by most recently modified.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional filename or path filter." },
        format: { type: "string", description: "Optional extension such as pdf, rtf, note, or m4a." },
        limit: { type: "integer", minimum: 1, maximum: 500 }
      },
      additionalProperties: false
    }
  },
  {
    name: "search_notes",
    description: "Search filenames and extracted text from TXT, Markdown, RTF, and HTML exports. Binary formats are searched by filename.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 500 }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: "read_note",
    description: "Read extracted text from a text/RTF/HTML export, or return a local file link for PDF, Note, ZIP, audio, or image exports.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path returned by list_notes or search_notes." },
        maxChars: { type: "integer", minimum: 1000, maximum: 120000 }
      },
      required: ["path"],
      additionalProperties: false
    }
  }
];

async function callTool(name, args = {}) {
  try {
    if (name === "configure_backup") {
      const root = validateRoot(args.root);
      const target = configPath();
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, JSON.stringify({ root }, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
      return { content: [jsonText({ configured: true, root, configFile: target })] };
    }
    if (name === "status") {
      const configured = loadConfiguredRoot();
      if (!configured) return { content: [jsonText({ configured: false, nextStep: "Call configure_backup with the local Notability backup folder." })] };
      const root = validateRoot(configured);
      const notes = walk(root, MAX_LIMIT);
      const byFormat = {};
      for (const note of notes) byFormat[note.format] = (byFormat[note.format] || 0) + 1;
      return { content: [jsonText({ configured: true, root, indexedFiles: notes.length, byFormat })] };
    }
    if (name === "list_notes") return { content: [jsonText(listNotes(args))] };
    if (name === "search_notes") return { content: [jsonText(searchNotes(args))] };
    if (name === "read_note") {
      const root = getRoot();
      const full = safeRelative(root, args.path);
      const ext = path.extname(full).toLowerCase();
      const stat = fs.statSync(full);
      const metadata = {
        path: path.relative(root, full),
        format: ext.slice(1),
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString()
      };
      const link = { type: "resource_link", name: path.basename(full), uri: pathToFileURL(full).href, description: "Local Notability export" };
      if (TEXT_EXTENSIONS.has(ext)) {
        const maximum = Math.max(1000, Math.min(MAX_RETURN_CHARS, Number(args.maxChars || MAX_RETURN_CHARS)));
        const extracted = extractText(full);
        return { content: [jsonText({ ...metadata, truncated: extracted.length > maximum, text: extracted.slice(0, maximum) }), link] };
      }
      return { content: [jsonText({ ...metadata, message: "Use the linked local export with the appropriate PDF, document, image, or audio workflow." }), link] };
    }
    return toolError(`Unknown tool: ${name}`);
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }
}

async function handle(request) {
  const { id, method, params = {} } = request;
  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: params.protocolVersion || "2024-11-05",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION }
      }
    };
  }
  if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
  if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools } };
  if (method === "tools/call") return { jsonrpc: "2.0", id, result: await callTool(params.name, params.arguments || {}) };
  if (method?.startsWith("notifications/")) return null;
  if (id === undefined) return null;
  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", async chunk => {
  buffer += chunk;
  while (true) {
    const newline = buffer.indexOf("\n");
    if (newline < 0) break;
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    try {
      const response = await handle(JSON.parse(line));
      if (response) process.stdout.write(JSON.stringify(response) + "\n");
    } catch (error) {
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: String(error) } }) + "\n");
    }
  }
});

process.stdin.resume();
