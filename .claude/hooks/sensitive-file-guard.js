#!/usr/bin/env node
// sensitive-file-guard.js -- PreToolUse hook that blocks writes to sensitive files
// EXIT 0 = allow the tool call to proceed
// EXIT 2 = BLOCK the tool call (Claude Code PreToolUse convention per D-12)

'use strict';

const path = require('path');

// Sensitive file patterns (same denylist as auto-commit for consistency)
const SENSITIVE_PATTERNS = [
  /\.env($|\.)/i,
  /\.pem$/i,
  /\.key$/i,
  /^credentials/i,
  /\.secret$/i,
  /serviceAccount.*\.json$/i,
];

// Allowlist: conventional env-template filenames that hold placeholders, not secrets.
// These are meant to be committed and documented, so Claude must be able to edit them.
// Covers both the plain files and their Handlebars/EJS/tmpl template sources.
const SAFE_ENV_BASENAMES = new Set([
  '.env.example',
  '.env.sample',
  '.env.template',
  '.env.defaults',
  '.env.example.hbs',
  '.env.sample.hbs',
  '.env.template.hbs',
  '.env.defaults.hbs',
  '.env.example.ejs',
  '.env.sample.ejs',
  '.env.template.ejs',
  '.env.defaults.ejs',
  '.env.example.tmpl',
  '.env.sample.tmpl',
  '.env.template.tmpl',
  '.env.defaults.tmpl',
]);

// --- Stdin reading with 3-second timeout (PreToolUse hooks must be fast) ---

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);

    // Extract file path from tool input
    const filePath = data.tool_input && data.tool_input.file_path;
    if (!filePath) {
      // No file path -- not a file write, allow
      process.exit(0);
    }

    // Check basename against sensitive patterns
    const baseName = path.basename(filePath);

    // Short-circuit: env-template files are documentation, allow edits.
    if (SAFE_ENV_BASENAMES.has(baseName.toLowerCase())) {
      process.exit(0);
    }

    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(baseName) || pattern.test(filePath)) {
        // Sensitive file detected -- block the write
        const output = {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            decision: 'block',
            reason:
              'BLOCKED: Write to sensitive file ' +
              baseName +
              ' is not allowed. Files matching ' +
              pattern.source +
              ' are protected during scaffolding.',
          },
        };
        process.stdout.write(JSON.stringify(output));
        process.exit(2);
      }
    }

    // No match -- allow the write
    process.exit(0);
  } catch (e) {
    // On error, allow the tool call (fail-open for PreToolUse)
    process.exit(0);
  }
});
