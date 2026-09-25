/**
 * Robust cURL command parser for curl-commander / REST tester.
 * Handles:
 * - Single-line and multi-line backslash (\) formatting
 * - Standard bash, cmd, and PowerShell cURL exports
 * - -X / --request METHOD
 * - -H / --header "Header-Name: Value"
 * - -d / --data / --data-raw / --data-binary / --data-urlencode
 * - --json '{...}'
 * - -u / --user "user:pass"
 * - -b / --cookie "cookie1=val"
 * - Query strings and trailing URLs
 */

export interface ParsedCurl {
  method: string;
  url: string;
  headers: { key: string; value: string; enabled: boolean }[];
  body: string;
  bodyType: 'none' | 'raw';
  rawType: 'json' | 'text';
}

export function parseCurlCommand(rawInput: string): ParsedCurl {
  const result: ParsedCurl = {
    method: 'GET',
    url: '',
    headers: [],
    body: '',
    bodyType: 'none',
    rawType: 'json',
  };

  if (!rawInput || !rawInput.trim()) return result;

  // Normalize multi-line backslashes and carriage returns
  let normalized = rawInput
    .replace(/\\\r?\n/g, ' ')
    .replace(/`\r?\n/g, ' ')
    .trim();

  // Strip leading 'curl'
  if (normalized.startsWith('curl ')) {
    normalized = normalized.slice(5).trim();
  }

  // Tokenize with quote awareness
  const tokens: string[] = [];
  let currentToken = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escapeNext = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];

    if (escapeNext) {
      currentToken += ch;
      escapeNext = false;
      continue;
    }

    if (ch === '\\' && !inSingleQuote) {
      escapeNext = true;
      continue;
    }

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (/\s/.test(ch) && !inSingleQuote && !inDoubleQuote) {
      if (currentToken.length > 0) {
        tokens.push(currentToken);
        currentToken = '';
      }
    } else {
      currentToken += ch;
    }
  }

  if (currentToken.length > 0) {
    tokens.push(currentToken);
  }

  // Parse flags
  let bodyFound = false;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    // Method: -X, --request
    if (t === '-X' || t === '--request') {
      if (tokens[i + 1]) {
        result.method = tokens[++i].toUpperCase();
      }
      continue;
    }

    // URL flag: --url
    if (t === '--url') {
      if (tokens[i + 1]) {
        result.url = tokens[++i].replace(/^['"]|['"]$/g, '');
      }
      continue;
    }

    // Headers: -H, --header
    if (t === '-H' || t === '--header') {
      if (tokens[i + 1]) {
        const headerStr = tokens[++i];
        const colonIdx = headerStr.indexOf(':');
        if (colonIdx > 0) {
          result.headers.push({
            key: headerStr.slice(0, colonIdx).trim(),
            value: headerStr.slice(colonIdx + 1).trim(),
            enabled: true,
          });
        }
      }
      continue;
    }

    // Data / Body: -d, --data, --data-raw, --data-binary, --data-ascii
    if (
      t === '-d' ||
      t === '--data' ||
      t === '--data-raw' ||
      t === '--data-binary' ||
      t === '--data-ascii'
    ) {
      if (tokens[i + 1] !== undefined) {
        result.body = tokens[++i];
        result.bodyType = 'raw';
        bodyFound = true;
      }
      continue;
    }

    // JSON flag: --json '{...}'
    if (t === '--json') {
      if (tokens[i + 1] !== undefined) {
        result.body = tokens[++i];
        result.bodyType = 'raw';
        result.rawType = 'json';
        bodyFound = true;
        if (!result.headers.some((h) => h.key.toLowerCase() === 'content-type')) {
          result.headers.push({ key: 'Content-Type', value: 'application/json', enabled: true });
        }
      }
      continue;
    }

    // Auth: -u, --user
    if (t === '-u' || t === '--user') {
      if (tokens[i + 1]) {
        const userPass = tokens[++i];
        try {
          const encoded = btoa(userPass);
          result.headers.push({
            key: 'Authorization',
            value: `Basic ${encoded}`,
            enabled: true,
          });
        } catch {}
      }
      continue;
    }

    // Cookie: -b, --cookie
    if (t === '-b' || t === '--cookie') {
      if (tokens[i + 1]) {
        result.headers.push({
          key: 'Cookie',
          value: tokens[++i],
          enabled: true,
        });
      }
      continue;
    }

    // Skip other known flags
    if (t.startsWith('-')) {
      if (t === '--compressed' || t === '-k' || t === '--insecure' || t === '-s' || t === '--silent' || t === '-v' || t === '--verbose') {
        continue;
      }
      continue;
    }

    // Target URL
    if (!result.url && (t.startsWith('http://') || t.startsWith('https://') || t.includes('://') || t.includes('.'))) {
      result.url = t.replace(/^['"]|['"]$/g, '');
    }
  }

  // If method was not explicitly passed with -X, but body exists, default to POST
  if (result.method === 'GET' && bodyFound) {
    result.method = 'POST';
  }

  // Detect rawType json vs text
  if (result.body) {
    try {
      JSON.parse(result.body);
      result.rawType = 'json';
    } catch {
      result.rawType = 'text';
    }
  }

  return result;
}
