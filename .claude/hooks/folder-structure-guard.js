#!/usr/bin/env node
// folder-structure-guard.js -- PreToolUse hook that enforces the project's
// folder contract declared in .claude/allowed-paths.json.
//
// Three possible decisions:
//   - deny (hard block): path matches a forbiddenGlobs entry. Exit 2 with
//     permissionDecision="deny". These are known-bad patterns; not bypassable.
//   - ask (prompt user): new file outside the allowlist. Exit 0 with
//     permissionDecision="ask". The user can approve the bypass if needed.
//   - allow (silent pass): existing file edit, or new file inside the allowlist.
//
// If .claude/allowed-paths.json is missing or malformed, the hook fails open
// (exit 0). The AI should never be wedged by a broken guard.

'use strict';

const fs = require('fs');
const path = require('path');

// ---------- Repo root detection ----------

function findRepoRoot(startDir) {
  let dir = startDir;
  while (true) {
    if (fs.existsSync(path.join(dir, '.claude', 'allowed-paths.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// ---------- Glob matching (hand-rolled, no deps) ----------
//
// Supports: `*` (single segment), `**` (any segments), `{a,b,c}` (alternation),
// `?` (single char). Good enough for our allowlist; not a full fnmatch.

function globToRegex(glob) {
  let i = 0;
  let out = '^';
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // `**` → match any number of path segments (including zero)
        // Consume trailing `/` if present so `**/foo` matches `foo` too.
        if (glob[i + 2] === '/') {
          out += '(?:.*/)?';
          i += 3;
        } else {
          out += '.*';
          i += 2;
        }
      } else {
        // `*` → match any characters except `/`
        out += '[^/]*';
        i += 1;
      }
    } else if (c === '?') {
      out += '[^/]';
      i += 1;
    } else if (c === '{') {
      const end = glob.indexOf('}', i);
      if (end === -1) {
        out += '\\{';
        i += 1;
      } else {
        const parts = glob
          .slice(i + 1, end)
          .split(',')
          .map((s) => s.trim());
        out += '(?:' + parts.map((p) => p.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('|') + ')';
        i = end + 1;
      }
    } else if ('.+^$()|[]\\'.includes(c)) {
      out += '\\' + c;
      i += 1;
    } else {
      out += c;
      i += 1;
    }
  }
  out += '$';
  return new RegExp(out);
}

function matchesAny(relPath, globs) {
  for (const g of globs) {
    if (globToRegex(g).test(relPath)) return true;
  }
  return false;
}

// ---------- Main ----------

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const filePath = data.tool_input && data.tool_input.file_path;
    if (!filePath) process.exit(0);

    const cwd = data.cwd && typeof data.cwd === 'string' ? data.cwd : process.cwd();
    const repoRoot = findRepoRoot(cwd) || findRepoRoot(path.dirname(filePath));
    if (!repoRoot) process.exit(0); // no contract -> fail open

    const manifestPath = path.join(repoRoot, '.claude', 'allowed-paths.json');
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (e) {
      process.exit(0); // malformed -> fail open
    }

    const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
    const relPath = path.relative(repoRoot, absPath).split(path.sep).join('/');

    // Path escapes the repo -- not our problem, let other guards handle it.
    if (relPath.startsWith('..')) process.exit(0);

    const allowedGlobs = Array.isArray(manifest.allowedGlobs) ? manifest.allowedGlobs : [];
    const forbiddenGlobs = Array.isArray(manifest.forbiddenGlobs) ? manifest.forbiddenGlobs : [];
    const rootOnlyFiles = Array.isArray(manifest.rootOnlyFiles) ? manifest.rootOnlyFiles : [];

    function emitDeny(reason) {
      const payload = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: reason,
          // Keep legacy fields for older Claude Code versions that check `decision`.
          decision: 'block',
          reason,
        },
      };
      process.stdout.write(JSON.stringify(payload));
      process.exit(2);
    }

    function emitAsk(reason) {
      const payload = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: reason,
        },
      };
      process.stdout.write(JSON.stringify(payload));
      process.exit(0);
    }

    // Rule 1: forbiddenGlobs -> hard deny, no user bypass. Known-bad patterns.
    for (const g of forbiddenGlobs) {
      if (globToRegex(g).test(relPath)) {
        emitDeny(
          'BLOCKED: ' +
            relPath +
            ' matches forbidden pattern "' +
            g +
            '" from .claude/allowed-paths.json. This pattern is explicitly disallowed ' +
            'by CLAUDE.md "Project Structure (STRICT)" / "Forbidden Patterns" and cannot be bypassed. ' +
            'If you genuinely need this path, the user must first remove the pattern from forbiddenGlobs.'
        );
      }
    }

    // Rule 2: edits to existing files are always allowed.
    if (fs.existsSync(absPath)) process.exit(0);

    // Rule 3a: Root-level .md files not in exemptRootMd -> hard deny.
    const exemptRootMd = Array.isArray(manifest.exemptRootMd) ? manifest.exemptRootMd : [];
    if (!relPath.includes('/') && relPath.endsWith('.md')) {
      if (exemptRootMd.includes(relPath)) process.exit(0);
      emitDeny(
        'BLOCKED: "' +
          relPath +
          '" is a Markdown file at the project root. ' +
          'All .md files must be created inside docs/ (e.g. "docs/' +
          relPath +
          '"). ' +
          'Only these are allowed at root: ' +
          exemptRootMd.join(', ') +
          '. ' +
          'To permanently allow this file at root, add it to "exemptRootMd" in .claude/allowed-paths.json.'
      );
    }

    // Rule 3: new files in the repo root. Must be allowlisted or in rootOnlyFiles,
    // otherwise ask the user (do not hard-block) since there are legitimate
    // reasons to add new root-level files (PR templates, CI configs, etc.).
    if (!relPath.includes('/')) {
      if (rootOnlyFiles.includes(relPath)) process.exit(0);
      if (matchesAny(relPath, allowedGlobs)) process.exit(0);
      emitAsk(
        'Creating new root-level file "' +
          relPath +
          '" is outside the allowlist. ' +
          'Approve only if this file genuinely belongs at the repo root. ' +
          'To permanently allow this path, add it to "rootOnlyFiles" in .claude/allowed-paths.json. ' +
          'See CLAUDE.md "Project Structure (STRICT)".'
      );
    }

    // Rule 4: new files in subdirectories must match allowedGlobs, else ASK.
    if (matchesAny(relPath, allowedGlobs)) process.exit(0);

    emitAsk(
      'Creating new file "' +
        relPath +
        '" is outside the folder contract in .claude/allowed-paths.json. ' +
        'Approve only if a new folder is genuinely needed — and in that case, update CLAUDE.md ' +
        '"Project Structure (STRICT)" and add the glob to "allowedGlobs" so future edits don\'t re-prompt.'
    );
  } catch (e) {
    process.exit(0); // fail-open on any unexpected error
  }
});
