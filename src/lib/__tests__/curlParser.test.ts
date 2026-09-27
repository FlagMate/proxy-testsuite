import { describe, it, expect } from 'vitest';
import { parseCurlCommand } from '../curlParser';

describe('curlParser — parseCurlCommand', () => {
  it('returns default object for empty or whitespace input', () => {
    const emptyResult = parseCurlCommand('');
    expect(emptyResult.method).toBe('GET');
    expect(emptyResult.url).toBe('');
    expect(emptyResult.headers).toEqual([]);
    expect(emptyResult.body).toBe('');

    const spaceResult = parseCurlCommand('   ');
    expect(spaceResult.url).toBe('');
  });

  it('parses a basic GET request with a simple URL', () => {
    const result = parseCurlCommand('curl https://api.example.com/v1/users');
    expect(result.method).toBe('GET');
    expect(result.url).toBe('https://api.example.com/v1/users');
    expect(result.headers).toEqual([]);
    expect(result.body).toBe('');
    expect(result.bodyType).toBe('none');
  });

  it('parses explicit HTTP methods (-X or --request)', () => {
    const postCmd = parseCurlCommand('curl -X POST https://api.example.com/items');
    expect(postCmd.method).toBe('POST');
    expect(postCmd.url).toBe('https://api.example.com/items');

    const putCmd = parseCurlCommand('curl --request PUT https://api.example.com/items/42');
    expect(putCmd.method).toBe('PUT');

    const deleteCmd = parseCurlCommand('curl -X DELETE https://api.example.com/items/42');
    expect(deleteCmd.method).toBe('DELETE');
  });

  it('parses single and multiple headers (-H / --header)', () => {
    const cmd = parseCurlCommand(
      'curl https://api.example.com/data -H "Authorization: Bearer secret_token" -H "Accept: application/json"'
    );
    expect(cmd.headers).toHaveLength(2);
    expect(cmd.headers[0]).toEqual({
      key: 'Authorization',
      value: 'Bearer secret_token',
      enabled: true,
    });
    expect(cmd.headers[1]).toEqual({
      key: 'Accept',
      value: 'application/json',
      enabled: true,
    });
  });

  it('infers POST method and sets body when -d / --data / --data-raw is supplied', () => {
    const cmd = parseCurlCommand(
      'curl https://api.example.com/login --data-raw "{\\"username\\":\\"admin\\"}"'
    );
    expect(cmd.method).toBe('POST');
    expect(cmd.body).toBe('{"username":"admin"}');
    expect(cmd.bodyType).toBe('raw');
    expect(cmd.rawType).toBe('json');
  });

  it('parses --json flag and sets Content-Type automatically if not present', () => {
    const cmd = parseCurlCommand(
      'curl --json "{\\"action\\":\\"test\\"}" https://api.example.com/action'
    );
    expect(cmd.method).toBe('POST');
    expect(cmd.body).toBe('{"action":"test"}');
    expect(cmd.bodyType).toBe('raw');
    expect(cmd.rawType).toBe('json');
    const hasContentType = cmd.headers.some(
      (h) => h.key.toLowerCase() === 'content-type' && h.value === 'application/json'
    );
    expect(hasContentType).toBe(true);
  });

  it('parses basic authentication (-u / --user) into base64 Authorization header', () => {
    const cmd = parseCurlCommand('curl -u admin:secret123 https://api.example.com/admin');
    const authHeader = cmd.headers.find((h) => h.key.toLowerCase() === 'authorization');
    expect(authHeader).toBeDefined();
    expect(authHeader?.value).toMatch(/^Basic /);
  });

  it('parses cookies (-b / --cookie) into Cookie header', () => {
    const cmd = parseCurlCommand('curl -b "session_id=xyz987" https://api.example.com/me');
    const cookieHeader = cmd.headers.find((h) => h.key.toLowerCase() === 'cookie');
    expect(cookieHeader).toBeDefined();
    expect(cookieHeader?.value).toBe('session_id=xyz987');
  });

  it('handles multi-line backslash formatting gracefully', () => {
    const multiLine = `curl --location --request POST 'https://api.example.com/webhook' \\
      --header 'Content-Type: application/json' \\
      --header 'x-api-key: my-key' \\
      --data-raw '{
        "event": "user.created",
        "active": true
      }'`;
    const cmd = parseCurlCommand(multiLine);
    expect(cmd.method).toBe('POST');
    expect(cmd.url).toBe('https://api.example.com/webhook');
    expect(cmd.headers).toHaveLength(2);
    expect(cmd.body).toContain('"event": "user.created"');
  });

  it('handles PowerShell backtick line continuations', () => {
    const psCmd = `curl -X GET \`
      https://api.example.com/status \`
      -H "Cache-Control: no-cache"`;
    const cmd = parseCurlCommand(psCmd);
    expect(cmd.method).toBe('GET');
    expect(cmd.url).toBe('https://api.example.com/status');
    expect(cmd.headers[0].key).toBe('Cache-Control');
  });

  it('detects plain text non-JSON payload as rawType: text', () => {
    const cmd = parseCurlCommand("curl -X POST https://api.example.com/logs -d 'Plain text log message'");
    expect(cmd.method).toBe('POST');
    expect(cmd.body).toBe('Plain text log message');
    expect(cmd.bodyType).toBe('raw');
    expect(cmd.rawType).toBe('text');
  });

  it('parses --data-urlencode into body', () => {
    const cmd = parseCurlCommand("curl https://api.example.com/oauth/token --data-urlencode 'grant_type=client_credentials'");
    expect(cmd.method).toBe('POST');
    expect(cmd.body).toBe('grant_type=client_credentials');
  });

  it('ignores standard curl modifier flags (--compressed, -k, --insecure, -s, --silent, -v, --verbose)', () => {
    const cmd = parseCurlCommand("curl -s -k --compressed --insecure -v https://api.example.com/health");
    expect(cmd.method).toBe('GET');
    expect(cmd.url).toBe('https://api.example.com/health');
  });

  it('parses URLs without explicit protocol scheme if they contain dots', () => {
    const cmd = parseCurlCommand('curl api.sonyliv.com/v1/ping');
    expect(cmd.url).toBe('api.sonyliv.com/v1/ping');
  });
});
