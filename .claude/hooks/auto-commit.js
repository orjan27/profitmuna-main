#!/usr/bin/env node
// Auto-commit hook for Claude Code.
// Fires on PostToolUse for Edit and Write — see .claude/settings.json.
// Only active when enable_auto_commit=yes was chosen during /scaffold-app.
// Failures are logged to .claude/.tmp/auto-commit.log; the hook never blocks the tool.
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const tool = process.argv[2] || 'Edit';

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

let p = process.env.TOOL_INPUT_FILE_PATH || process.env.CLAUDE_TOOL_FILE_PATH || '';
if (!p) {
  const raw = readStdinSync();
  if (raw) {
    try {
      const payload = JSON.parse(raw);
      p =
        (payload.tool_input && (payload.tool_input.file_path || payload.tool_input.filePath)) ||
        (payload.toolInput && (payload.toolInput.file_path || payload.toolInput.filePath)) ||
        '';
    } catch {}
  }
}
if (!p) process.exit(0);

const SKIP = [
  '/node_modules/',
  '/dist/',
  '/build/',
  '/.next/',
  '/.scaffold/',
  '/.claude/.tmp/',
  '/coverage/',
];
if (SKIP.some((s) => ('/' + p).indexOf(s) >= 0)) process.exit(0);

try {
  execSync('git rev-parse --git-dir', { stdio: 'ignore' });
} catch {
  process.exit(0);
}

function logFailure(err) {
  try {
    const logPath = path.join('.claude', '.tmp', 'auto-commit.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const errText = (err.stderr || err.message || '')
      .toString()
      .split('\n')
      .join(' ')
      .slice(0, 200);
    fs.appendFileSync(
      logPath,
      `${new Date().toISOString()} ${tool} ${p} ${err.status || '?'} ${errText}\n`
    );
  } catch {}
}

try {
  execSync(`git add -- ${JSON.stringify(p)}`, { stdio: 'ignore' });
  const name = path.basename(p);
  let message;

  if (tool === 'Write') {
    const history = execSync(`git log --oneline -1 -- ${JSON.stringify(p)}`, {
      encoding: 'utf8',
    }).trim();
    message = `chore(${name}): ${history ? 'overwrite existing file' : 'add new file'}`;
  } else {
    const stat = execSync(`git diff --cached --numstat -- ${JSON.stringify(p)}`, {
      encoding: 'utf8',
    }).trim();
    if (!stat) process.exit(0);
    const parts = stat.split('\t');
    const changed = (+parts[0] || 0) + (+parts[1] || 0);
    if (!changed) process.exit(0);
    const size = changed < 10 ? 'minor' : changed < 50 ? 'moderate' : 'major';
    const isMd = name.endsWith('.md') || name.endsWith('.mdx');
    const isTest =
      p.indexOf('__tests__') >= 0 || name.indexOf('.test.') >= 0 || name.indexOf('.spec.') >= 0;
    const type = isMd ? 'docs' : isTest ? 'test' : 'chore';
    message = `${type}(${name}): ${size} changes (${changed} lines)`;
  }

  execSync(`git commit -m ${JSON.stringify(message)} -- ${JSON.stringify(p)}`, {
    stdio: 'ignore',
  });
} catch (e) {
  logFailure(e);
}
