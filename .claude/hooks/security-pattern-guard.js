#!/usr/bin/env node
// security-pattern-guard.js -- PreToolUse hook that scans content for dangerous
// security anti-patterns before the write is committed.
//
// EXIT 0 = allow (optionally with permissionDecision: "ask" to prompt user)
// EXIT 2 = BLOCK the tool call
//
// Distinct from sensitive-file-guard.js which checks WHICH file is written.
// This hook checks WHAT content is being written.

'use strict';

// --- Hard-block patterns (exit 2): never legitimate in source ---

const BLOCK_PATTERNS = [
  {
    regex: /AKIA[0-9A-Z]{16}/,
    reason: 'Hardcoded AWS access key detected. Use environment variables or a secrets manager.',
  },
  {
    regex: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY/,
    reason: 'Embedded private key detected. Never commit private keys to source code.',
  },
];

// --- Ask patterns (exit 0 with permissionDecision: "ask"): review needed ---

const ASK_PATTERNS = [
  {
    regex: /\beval\s*\(\s*[^'")\s]/,
    reason:
      'eval() with a non-literal argument. This is a code injection risk unless the input is strictly controlled.',
  },
  {
    regex: /\.innerHTML\s*=\s*[^'"]/,
    reason:
      'innerHTML assignment with a variable. Use textContent or sanitize with DOMPurify to prevent XSS.',
  },
  {
    regex: /dangerouslySetInnerHTML\s*=\s*\{/,
    reason:
      'dangerouslySetInnerHTML detected. Ensure the value is sanitized with DOMPurify or equivalent.',
  },
  {
    regex: /["'`]\s*SELECT\s+[\s\S]{0,40}\+\s*(?!['"])/m,
    reason:
      'SQL string concatenation detected. Use parameterized queries to prevent SQL injection.',
  },
  {
    regex: /`\s*(?:SELECT|INSERT|UPDATE|DELETE)\s+[\s\S]{0,60}\$\{/m,
    reason: 'SQL template literal with interpolation detected. Use parameterized queries instead.',
  },
  {
    regex:
      /console\.log\s*\([\s\S]{0,80}(?:password|secret|token|apiKey|api_key|credential|private_key)/i,
    reason:
      'Logging a potentially sensitive variable. Remove before committing to prevent credential leakage.',
  },
  {
    regex: /chmod\s+777/,
    reason: 'chmod 777 grants world-writable permissions. Use the minimum permissions needed.',
  },
];

// --- CORS + credentials combo: hard block ---

function checkCorsCredentials(content) {
  const hasWildcardOrigin =
    /Access-Control-Allow-Origin['":\s]*\*/.test(content) ||
    /cors\(\s*\{[^}]*origin\s*:\s*['"]?\*['"]?/s.test(content) ||
    /allowedOrigins?\s*[\(=]\s*['"]?\*['"]?/.test(content);

  const hasCredentials =
    /Access-Control-Allow-Credentials['":\s]*true/.test(content) ||
    /credentials\s*:\s*true/.test(content);

  if (hasWildcardOrigin && hasCredentials) {
    return 'CORS wildcard origin (*) with credentials enabled is a security misconfiguration. Allowlist specific origins.';
  }
  return null;
}

// --- Stdin reading with 3-second timeout ---

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const toolInput = data.tool_input;
    if (!toolInput) process.exit(0);

    // Extract content to scan: Write uses .content, Edit uses .new_string
    const content = toolInput.content || toolInput.new_string || '';
    if (!content) process.exit(0);

    // Skip scanning non-code files (images, binaries, lock files)
    const filePath = toolInput.file_path || '';
    if (/\.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|lock)$/i.test(filePath)) {
      process.exit(0);
    }

    // --- Hard blocks ---

    for (const { regex, reason } of BLOCK_PATTERNS) {
      if (regex.test(content)) {
        const output = {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: 'BLOCKED: ' + reason,
            decision: 'block',
            reason: 'BLOCKED: ' + reason,
          },
        };
        process.stdout.write(JSON.stringify(output));
        process.exit(2);
      }
    }

    // CORS + credentials combo
    const corsIssue = checkCorsCredentials(content);
    if (corsIssue) {
      const output = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'BLOCKED: ' + corsIssue,
          decision: 'block',
          reason: 'BLOCKED: ' + corsIssue,
        },
      };
      process.stdout.write(JSON.stringify(output));
      process.exit(2);
    }

    // --- Ask patterns (prompt user) ---

    for (const { regex, reason } of ASK_PATTERNS) {
      if (regex.test(content)) {
        const output = {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'ask',
            permissionDecisionReason: 'Security review: ' + reason,
          },
        };
        process.stdout.write(JSON.stringify(output));
        process.exit(0);
      }
    }

    // No issues found
    process.exit(0);
  } catch (e) {
    // Fail-open on any unexpected error
    process.exit(0);
  }
});
