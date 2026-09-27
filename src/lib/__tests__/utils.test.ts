import { describe, it, expect } from 'vitest';
import { formatUrl, isValidUrl } from '../utils';

describe('utils', () => {
  describe('formatUrl', () => {
    it('should format a URL correctly', () => {
      const url = 'example.com';
      const formattedUrl = formatUrl(url);
      expect(formattedUrl).toBe('http://example.com'); // Adjust based on actual implementation
    });

    it('should handle already formatted URLs', () => {
      const url = 'http://example.com';
      const formattedUrl = formatUrl(url);
      expect(formattedUrl).toBe('http://example.com');
    });
  });

  describe('isValidUrl', () => {
    it('should return true for valid URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('https://example.com')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidUrl('example')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('cn', () => {
    it('merges class names correctly with tailwind classes', async () => {
      const { cn } = await import('../utils');
      expect(cn('p-4', 'bg-red-500')).toBe('p-4 bg-red-500');
      expect(cn('p-2', 'p-4')).toBe('p-4');
    });
  });
});
