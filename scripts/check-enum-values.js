#!/usr/bin/env node
/**
 * check-enum-values.js
 *
 * Scans all SQL migration files for INSERT statements that write to
 * credit_ledger.transaction_type or notifications.type and validates
 * that every literal string value used is a known-valid enum member.
 *
 * Exit 0  — all values are valid (safe to deploy)
 * Exit 1  — one or more invalid values found (blocks CI)
 *
 * Usage:
 *   node scripts/check-enum-values.js
 *   npm run check:enums
 *
 * To add a new valid value, update VALID_TRANSACTION_TYPES or
 * VALID_NOTIFICATION_TYPES below AND add an ALTER TYPE migration.
 * See supabase/enum_reference.sql for full guidance.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

// ─── Canonical enum sets ──────────────────────────────────────────────────────
// Keep in sync with supabase/enum_reference.sql

const VALID_TRANSACTION_TYPES = new Set([
  'purchase',
  'post_rfq',
  'post_job',
  'send_message',
  'request_contact',
  'boost_listing',
  'repost_listing',
  'verification_fee',
  'refund',
  'admin_adjustment',
]);

const VALID_NOTIFICATION_TYPES = new Set([
  'connection_request',
  'connection_accepted',
  'post_liked',
  'post_commented',
  'bid_received',
  'bid_awarded',
  'bid_not_awarded',
  'job_application',
  'rfq_closing_soon',
  'credential_expiring',
  'referral_received',
  'safety_alert',
  'message_received',
  'credits_added',
  'profile_viewed',
]);

// ─── Known historical suppressions ───────────────────────────────────────────
// These files predate the enum corrections introduced in migration 029 and
// 20260804_fix_remaining_enum_values.sql.  Their RPC functions have been fully
// replaced by later migrations, so the invalid values they contain are inert at
// runtime.  Listing them here is intentional: it documents the known debt rather
// than hiding it, while keeping CI green for all post-fix additions.
//
// Do NOT add new entries to this list.  Any file not listed here must use only
// valid enum values.

const SUPPRESSED_FILES = new Set([
  // Original RPC definitions – contained 'new_bid' (notification_type) and
  // 'spend' (transaction_type); both superseded by migration 029.
  'supabase/migrations/021_rpc_functions.sql',
  // Intermediate rewrites also using 'spend' before the 029 fix.
  'supabase/migrations/024_fix_trade_type_cast.sql',
  'supabase/migrations/027_text_trades_and_post_comment_rpc.sql',
  'supabase/migrations/028_fix_rfq_osha_default.sql',
]);

// ─── File discovery ───────────────────────────────────────────────────────────

const MIGRATIONS_DIR = 'supabase/migrations';

function collectSqlFiles(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => extname(f) === '.sql')
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

// ─── Balanced-parenthesis extractor ──────────────────────────────────────────

/**
 * Given a string and the index of an opening '(' character, returns the
 * content INSIDE the outermost parens — excluding the outer parens themselves.
 * Correctly handles:
 *   - Nested function calls:  auth.uid(), coalesce(...), round(...)::text
 *   - Single-quoted strings:  'literal', 'it''s escaped'
 *   - Multi-line content
 *
 * Returns null if the opening paren is not found or parens are unbalanced.
 */
function extractParenContent(str, openIdx) {
  if (str[openIdx] !== '(') return null;
  let depth = 0;
  let inStr = false;
  let result = '';

  for (let i = openIdx; i < str.length; i++) {
    const ch = str[i];

    if (inStr) {
      if (ch === "'") {
        if (str[i + 1] === "'") {
          // escaped single-quote inside string
          result += "''";
          i++;
        } else {
          inStr = false;
          result += ch;
        }
      } else {
        result += ch;
      }
      continue;
    }

    // Not inside a string
    if (ch === "'") {
      inStr = true;
      result += ch;
      continue;
    }
    if (ch === '(') {
      depth++;
      if (depth > 1) result += ch; // collect nested ( but not the outermost
      continue;
    }
    if (ch === ')') {
      depth--;
      if (depth === 0) return result; // done — outer ) reached
      result += ch;
      continue;
    }
    result += ch;
  }

  return null; // unbalanced
}

/**
 * Find the index of the '(' that immediately follows the keyword VALUES
 * (case-insensitive, with optional whitespace between VALUES and the paren).
 * Returns -1 if not found.
 */
function findValuesOpenParen(str) {
  const re = /\bvalues\s*\(/gi;
  const m = re.exec(str);
  if (!m) return -1;
  return m.index + m[0].length - 1; // index of the '('
}

// ─── Value-list splitter ──────────────────────────────────────────────────────

/**
 * Split a comma-separated VALUES inner content into individual elements,
 * respecting single-quoted strings and nested parentheses.
 */
function splitValues(s) {
  const parts = [];
  let depth = 0;
  let inStr = false;
  let cur = '';

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (inStr) {
      if (ch === "'") {
        if (s[i + 1] === "'") { cur += "''"; i++; continue; }
        inStr = false;
        cur += ch;
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === "'") { inStr = true; cur += ch; continue; }
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth--; cur += ch; continue; }
    if (depth === 0 && ch === ',') { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

/** Return the unquoted string if raw is a single-quoted literal, else null. */
function unquote(raw) {
  const m = raw.trim().match(/^'(.*)'$/s);
  return m ? m[1].replace(/''/g, "'") : null;
}

// ─── Statement collector ──────────────────────────────────────────────────────

/**
 * Collect up to MAX_LINES lines starting at lineIdx until we find a line
 * ending with ';' (the end of a PL/pgSQL statement inside a function body).
 * Returns the joined multi-line statement as a single string.
 */
const MAX_STMT_LINES = 40;

function collectStatement(lines, startIdx) {
  const collected = [];
  for (let j = startIdx; j < Math.min(startIdx + MAX_STMT_LINES, lines.length); j++) {
    collected.push(lines[j]);
    if (/;\s*$/.test(lines[j].trimEnd())) break;
  }
  return collected.join('\n');
}

// ─── Per-table extractors ─────────────────────────────────────────────────────

/**
 * Scan a SQL file for INSERT … credit_ledger … VALUES and return all
 * transaction_type literals found, with their source line number.
 */
function extractTransactionTypeValues(sql, filePath) {
  const results = [];
  const lines = sql.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*--/.test(line)) continue;

    if (/\binsert\b/i.test(line) && /\bcredit_ledger\b/i.test(line)) {
      const stmt = collectStatement(lines, i);

      // Extract column list: INSERT INTO … credit_ledger ( col1, col2, … )
      const colMatch = stmt.match(/credit_ledger\s*\(([^)]+)\)/i);
      if (!colMatch) continue;

      const cols = colMatch[1].split(',').map((c) => c.trim().toLowerCase());
      const txIdx = cols.indexOf('transaction_type');
      if (txIdx === -1) continue;

      // Extract VALUES inner content with balanced-paren extractor
      const openIdx = findValuesOpenParen(stmt);
      if (openIdx === -1) continue;

      const inner = extractParenContent(stmt, openIdx);
      if (inner === null) continue;

      const vals = splitValues(inner);
      if (txIdx >= vals.length) continue;

      const literal = unquote(vals[txIdx]);
      if (literal !== null) {
        results.push({ value: literal, line: i + 1, file: filePath });
      }
    }
  }

  return results;
}

/**
 * Scan a SQL file for INSERT … notifications … VALUES and return all
 * notification type literals found, with their source line number.
 */
function extractNotificationTypeValues(sql, filePath) {
  const results = [];
  const lines = sql.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*--/.test(line)) continue;

    if (/\binsert\b/i.test(line) && /\bnotifications\b/i.test(line)) {
      const stmt = collectStatement(lines, i);

      // Extract column list: INSERT INTO … notifications ( col1, col2, … )
      const colMatch = stmt.match(/notifications\s*\(([^)]+)\)/i);
      if (!colMatch) continue;

      const cols = colMatch[1].split(',').map((c) => c.trim().toLowerCase());
      const typeIdx = cols.indexOf('type');
      if (typeIdx === -1) continue;

      // Extract VALUES inner content with balanced-paren extractor
      const openIdx = findValuesOpenParen(stmt);
      if (openIdx === -1) continue;

      const inner = extractParenContent(stmt, openIdx);
      if (inner === null) continue;

      const vals = splitValues(inner);
      if (typeIdx >= vals.length) continue;

      const literal = unquote(vals[typeIdx]);
      if (literal !== null) {
        results.push({ value: literal, line: i + 1, file: filePath });
      }
    }
  }

  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const files = collectSqlFiles(MIGRATIONS_DIR);

if (files.length === 0) {
  console.error(`No SQL files found in ${MIGRATIONS_DIR}`);
  process.exit(1);
}

let errors = 0;
let totalChecked = 0;

for (const filePath of files) {
  if (SUPPRESSED_FILES.has(filePath)) continue;

  const sql = readFileSync(filePath, 'utf8');

  const txValues = extractTransactionTypeValues(sql, filePath);
  const notifValues = extractNotificationTypeValues(sql, filePath);

  for (const { value, line, file } of txValues) {
    totalChecked++;
    if (!VALID_TRANSACTION_TYPES.has(value)) {
      console.error(
        `❌  INVALID transaction_type '${value}' in ${file}:${line}\n` +
        `   Valid values: ${[...VALID_TRANSACTION_TYPES].join(', ')}`
      );
      errors++;
    }
  }

  for (const { value, line, file } of notifValues) {
    totalChecked++;
    if (!VALID_NOTIFICATION_TYPES.has(value)) {
      console.error(
        `❌  INVALID notification_type '${value}' in ${file}:${line}\n` +
        `   Valid values: ${[...VALID_NOTIFICATION_TYPES].join(', ')}`
      );
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\n✖  ${errors} invalid enum value(s) found across ${files.length} SQL file(s).`);
  console.error(`   See supabase/enum_reference.sql for the full list of valid values.`);
  process.exit(1);
} else {
  console.log(
    `✔  All enum values valid (${totalChecked} literal(s) checked across ${files.length} SQL file(s)).`
  );
  process.exit(0);
}
