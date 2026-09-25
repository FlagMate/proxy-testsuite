import { describe, it, expect } from 'vitest';
import { parseHAR } from '../harParser';

describe('harParser', () => {
  it('should parse a valid HAR file', () => {
    const harContent = { log: { entries: [] } }; // Mock HAR content
    const result = parseHAR(harContent);
    expect(result).toEqual([]); // Adjust based on actual implementation
  });

  it('should throw an error for invalid HAR content', () => {
    const invalidHarContent = null;
    expect(() => parseHAR(invalidHarContent)).toThrow('Invalid HAR content');
  });
});
