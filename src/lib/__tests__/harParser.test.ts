import { describe, it, expect } from 'vitest';
import { HARParser, parseHAR, HAREntry } from '../harParser';

describe('harParser — parseHAR helper', () => {
  it('should parse a valid HAR object', () => {
    const harContent = { log: { entries: [] } };
    const result = parseHAR(harContent);
    expect(result).toEqual([]);
  });

  it('should throw an error for invalid HAR content', () => {
    expect(() => parseHAR(null)).toThrow('Invalid HAR content');
    expect(() => parseHAR({})).toThrow('Invalid HAR content');
    expect(() => parseHAR({ log: {} })).toThrow('Invalid HAR content');
  });
});

describe('HARParser class', () => {
  const sampleEntries: HAREntry[] = [
    {
      request: {
        method: 'GET',
        url: 'https://api.example.com/v1/users?page=1',
        headers: [
          { name: 'Accept', value: 'application/json' },
          { name: 'sec-ch-ua', value: 'Google Chrome' },
        ],
        queryString: [{ name: 'page', value: '1' }],
      },
      response: {
        status: 200,
        statusText: 'OK',
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        content: {
          mimeType: 'application/json',
          text: '{"users": []}',
        },
      },
      time: 120,
    },
    {
      request: {
        method: 'POST',
        url: 'https://api.example.com/v1/users',
        headers: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Authorization', value: 'Bearer token123' },
        ],
        postData: {
          mimeType: 'application/json',
          text: '{"name":"Alice"}',
        },
        queryString: [],
      },
      response: {
        status: 201,
        statusText: 'Created',
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        content: {
          mimeType: 'application/json',
          text: '{"id": 1, "name": "Alice"}',
        },
      },
      time: 210,
    },
    {
      request: {
        method: 'GET',
        url: 'https://cdn.example.com/static/bundle.js',
        headers: [],
        queryString: [],
      },
      response: {
        status: 200,
        statusText: 'OK',
        headers: [{ name: 'Content-Type', value: 'application/javascript' }],
        content: {
          mimeType: 'application/javascript',
          text: 'console.log("bundle")',
        },
      },
      time: 45,
    },
    {
      request: {
        method: 'GET',
        url: 'https://otherdomain.org/api/status',
        headers: [{ name: 'Accept', value: 'application/json' }],
        queryString: [],
      },
      response: {
        status: 200,
        statusText: 'OK',
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        content: {
          mimeType: 'application/json',
          text: '{"status": "ok"}',
        },
      },
      time: 30,
    },
  ];

  it('parses valid HAR JSON string', () => {
    const raw = JSON.stringify({
      log: {
        version: '1.2',
        creator: { name: 'Browser', version: '1.0' },
        entries: sampleEntries,
      },
    });
    const parsed = HARParser.parseHARFile(raw);
    expect(parsed.log.entries).toHaveLength(4);
  });

  it('throws on invalid HAR JSON string or missing entries', () => {
    expect(() => HARParser.parseHARFile('invalid json')).toThrow('Invalid HAR file: Not valid JSON');
    expect(() => HARParser.parseHARFile('{"log": {}}')).toThrow('Invalid HAR file format');
  });

  it('extracts unique hostnames sorted by frequency', () => {
    const domains = HARParser.extractDomains(sampleEntries);
    expect(domains[0]).toBe('api.example.com');
    expect(domains).toContain('cdn.example.com');
    expect(domains).toContain('otherdomain.org');
  });

  it('filters entries by domain and skips static assets', () => {
    const filtered = HARParser.filterEntries(sampleEntries, { domain: 'api.example.com' });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.request.url.includes('api.example.com'))).toBe(true);
  });

  it('filters entries by route substring', () => {
    const filtered = HARParser.filterEntries(sampleEntries, { route: '/status' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].request.url).toContain('/api/status');
  });

  it('converts filtered HAR entries into testable request objects', () => {
    const apiEntries = sampleEntries.filter((e) => e.request.url.includes('api.example.com'));
    const requests = HARParser.convertToRestifyRequests(apiEntries, 'col_test');
    expect(requests).toHaveLength(2);

    const postReq = requests.find((r) => r.method === 'POST');
    expect(postReq).toBeDefined();
    expect(JSON.parse(postReq!.body)).toEqual({ name: 'Alice' });
    expect(postReq?.bodyType).toBe('raw');

    // System headers like sec-ch-ua should be filtered out
    const getReq = requests.find((r) => r.method === 'GET');
    expect(getReq?.headers.some((h) => h.key.toLowerCase().startsWith('sec-'))).toBe(false);
  });

  it('generates meaningful collection names and summaries', () => {
    const name = HARParser.generateCollectionName({ domain: 'api.example.com' }, 2);
    expect(name).toContain('api.example.com');
    expect(name).toContain('HAR Import');

    const summary = HARParser.getImportSummary(4, 2, { domain: 'api.example.com' }, 0);
    expect(summary.totalEntries).toBe(4);
    expect(summary.filteredEntries).toBe(2);
    expect(summary.skippedEntries).toBe(2);
  });
});
