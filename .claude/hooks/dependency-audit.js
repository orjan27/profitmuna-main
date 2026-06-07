#!/usr/bin/env node
// dependency-audit.js -- PostToolUse hook that runs npm audit after package.json changes.
// Emits warnings via additionalContext; cannot block (PostToolUse).
// Fail-open on all errors (missing npm, no node_modules, network issues).

'use strict';

const { execSync } = require('child_process');
const path = require('path');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 10000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const filePath = data.tool_input && data.tool_input.file_path;
    if (!filePath) process.exit(0);

    // Only fire for package.json files
    if (path.basename(filePath) !== 'package.json') process.exit(0);

    // Check if node_modules exists (audit needs installed deps)
    const pkgDir = path.dirname(filePath);
    const fs = require('fs');
    const nodeModules = path.join(pkgDir, 'node_modules');
    if (!fs.existsSync(nodeModules)) process.exit(0);

    // Check if npm is available
    try {
      execSync('which npm', { stdio: 'ignore' });
    } catch (e) {
      process.exit(0);
    }

    // Run npm audit from the package.json's directory
    let auditJson;
    try {
      const result = execSync('npm audit --json 2>/dev/null', {
        cwd: pkgDir,
        encoding: 'utf8',
        timeout: 12000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      auditJson = JSON.parse(result);
    } catch (e) {
      // npm audit exits non-zero when vulnerabilities are found -- parse stdout
      if (e.stdout) {
        try {
          auditJson = JSON.parse(e.stdout);
        } catch (parseErr) {
          process.exit(0);
        }
      } else {
        process.exit(0);
      }
    }

    if (!auditJson || !auditJson.metadata || !auditJson.metadata.vulnerabilities) {
      process.exit(0);
    }

    const vuln = auditJson.metadata.vulnerabilities;
    const critical = vuln.critical || 0;
    const high = vuln.high || 0;
    const moderate = vuln.moderate || 0;

    if (critical === 0 && high === 0) process.exit(0);

    // Build warning message
    const parts = [];
    if (critical > 0) parts.push(critical + ' critical');
    if (high > 0) parts.push(high + ' high');
    if (moderate > 0) parts.push(moderate + ' moderate');

    const message =
      'npm audit found ' +
      parts.join(', ') +
      ' severity vulnerabilit' +
      (critical + high + moderate === 1 ? 'y' : 'ies') +
      ' in ' +
      path.basename(pkgDir) +
      '/package.json. ' +
      'Run `npm audit` for details and `npm audit fix` to auto-fix where possible.';

    const output = {
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: message,
      },
    };
    process.stdout.write(JSON.stringify(output));
    process.exit(0);
  } catch (e) {
    // Fail-open
    process.exit(0);
  }
});
