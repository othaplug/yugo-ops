#!/usr/bin/env node
/**
 * Phantom-column guard. Parses every `.from("table").select("...")` in src/ and
 * checks each selected column against the generated schema in
 * src/lib/database.types.ts. A column a table does not have makes PostgREST
 * error the WHOLE query and return null (silent data loss) — this catches it at
 * CI time instead. Regenerate the schema after migrations:
 *   supabase gen types typescript --linked > src/lib/database.types.ts
 *
 * Exit 1 if any phantom column is found.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const typesPath = path.join(root, "src/lib/database.types.ts");

// ── Parse table → columns from the generated types (public schema Tables) ──
function parseSchema() {
  const lines = fs.readFileSync(typesPath, "utf8").split("\n");
  const tables = {};
  let inPublic = false, inTables = false, curTable = null, inRow = false;
  for (const line of lines) {
    if (/^  public: \{/.test(line)) { inPublic = true; continue; }
    if (inPublic && /^  \w+: \{/.test(line) && !/^  public/.test(line)) inPublic = false;
    if (!inPublic) continue;
    if (/^    Tables: \{/.test(line)) { inTables = true; continue; }
    if (inTables && /^    \w+: \{/.test(line) && !/^    Tables/.test(line)) inTables = false;
    if (!inTables) continue;
    const tm = line.match(/^      (\w+): \{$/);
    if (tm) { curTable = tm[1]; tables[curTable] = new Set(); inRow = false; continue; }
    if (curTable && /^        Row: \{/.test(line)) { inRow = true; continue; }
    if (curTable && inRow && /^        \}/.test(line)) { inRow = false; continue; }
    if (curTable && inRow) {
      const cm = line.match(/^          (\w+)\??: /);
      if (cm) tables[curTable].add(cm[1]);
    }
  }
  return tables;
}

// ── Walk src for .ts/.tsx files ──
function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") walk(p, acc); }
    else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".d.ts")) acc.push(p);
  }
  return acc;
}

// Split a select string on top-level commas (respecting parentheses).
function splitTop(s) {
  const out = []; let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

// Resolve the real column name a token refers to (handles `alias:col`).
function columnOf(token) {
  let t = token.trim();
  if (!t || t === "*") return null;
  if (t.includes("(")) return null;          // embedded relationship, not a column
  if (t.includes("->")) return null;          // json path
  if (t.includes("::")) t = t.split("::")[0]; // cast
  if (t.includes(":")) t = t.split(":").pop().trim(); // alias:col -> col
  if (t.startsWith("...")) return null;       // spread
  return /^[a-z_][a-z0-9_]*$/.test(t) ? t : null;
}

const tables = parseSchema();
const files = walk(path.join(root, "src"));
const findings = [];

const selectRe = /\.from\(\s*["'`](\w+)["'`]\s*\)([\s\S]{0,400}?)\.select\(\s*(["'`])([\s\S]*?)\3/g;

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  let m;
  selectRe.lastIndex = 0;
  while ((m = selectRe.exec(text)) !== null) {
    const table = m[1];
    const between = m[2];
    const sel = m[4];
    if (between.includes(".from(")) continue;   // select belongs to a different table
    const cols = tables[table];
    if (!cols) continue;                          // unknown table (view/rpc) — skip
    if (sel.trim() === "*" || sel.includes("count")) continue;
    for (const tok of splitTop(sel)) {
      const col = columnOf(tok);
      if (col && !cols.has(col)) {
        const line = text.slice(0, m.index).split("\n").length;
        findings.push({ file: path.relative(root, file), line, table, col });
      }
    }
  }
}

if (findings.length === 0) {
  console.log("✓ db column check: no phantom columns found");
  process.exit(0);
}
console.error(`✗ db column check: ${findings.length} phantom column reference(s)\n`);
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  ${f.table}.${f.col}  (column does not exist)`);
}
process.exit(1);
