import { describe, it, expect } from 'vitest';
import { validateApiResponse, validateArrayResponse } from '../apiValidator';

describe('apiValidator — validateApiResponse & validateArrayResponse', () => {
  it('returns valid: true when validation function succeeds', () => {
    const fn = (data: any) => data.toUpperCase();
    const result = validateApiResponse('hello', fn);
    expect(result.valid).toBe(true);
    expect(result.result).toBe('HELLO');
  });

  it('returns valid: false with error message when validation function throws', () => {
    const fn = () => {
      throw new Error('Schema mismatch');
    };
    const result = validateApiResponse({}, fn);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Schema mismatch');
  });

  describe('validateArrayResponse', () => {
    it('passes for arrays with required id and title keys', () => {
      const items = [
        { id: 1, title: 'Item 1' },
        { id: 2, title: 'Item 2' },
      ];
      expect(validateArrayResponse(items)).toEqual(items);
    });

    it('throws when payload is not an array', () => {
      expect(() => validateArrayResponse({ id: 1, title: 'Item' })).toThrow('Response is not an array');
      expect(() => validateArrayResponse(null)).toThrow('Response is not an array');
    });

    it('throws when an item in array is missing required id or title', () => {
      const missingTitle = [{ id: 1 }];
      expect(() => validateArrayResponse(missingTitle)).toThrow('Missing required keys');

      const missingId = [{ title: 'No ID' }];
      expect(() => validateArrayResponse(missingId)).toThrow('Missing required keys');
    });
  });
});
