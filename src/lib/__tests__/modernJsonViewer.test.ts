import { describe, it, expect } from 'vitest';
import {
  isStreamingMediaUrl,
  parseEpochTimestamp,
  isColorHex,
  formatJsonPath,
} from '../../components/ModernJsonViewer';

describe('ModernJsonViewer — Helper Utilities', () => {
  describe('isStreamingMediaUrl', () => {
    it('detects HLS (.m3u8) streaming URLs', () => {
      expect(isStreamingMediaUrl('https://stream.example.com/live/index.m3u8')).toBe(true);
      expect(isStreamingMediaUrl('http://cdn.net/hls/master.m3u8?token=xyz')).toBe(true);
    });

    it('detects DASH (.mpd) streaming URLs', () => {
      expect(isStreamingMediaUrl('https://dash.example.com/manifest.mpd')).toBe(true);
    });

    it('detects video file extensions (.mp4, .webm, .ts, .mov, .m4s)', () => {
      expect(isStreamingMediaUrl('https://video.example.com/clip.mp4')).toBe(true);
      expect(isStreamingMediaUrl('https://video.example.com/clip.webm')).toBe(true);
      expect(isStreamingMediaUrl('https://video.example.com/segment.ts')).toBe(true);
      expect(isStreamingMediaUrl('https://video.example.com/init.m4s')).toBe(true);
    });

    it('detects streaming URLs from key hints even without stream file extensions', () => {
      expect(isStreamingMediaUrl('https://video.example.com/stream/auth?id=1', 'videoUrl')).toBe(true);
      expect(isStreamingMediaUrl('https://video.example.com/manifest', 'manifestUrl')).toBe(true);
      expect(isStreamingMediaUrl('https://video.example.com/play', 'playbackUrl')).toBe(true);
      expect(isStreamingMediaUrl('https://video.example.com/v', 'dashUrl')).toBe(true);
      expect(isStreamingMediaUrl('https://video.example.com/v', 'stream_url')).toBe(true);
    });

    it('rejects regular non-streaming URLs and non-string inputs', () => {
      expect(isStreamingMediaUrl('https://api.example.com/users')).toBe(false);
      expect(isStreamingMediaUrl('https://example.com/logo.png')).toBe(false);
      expect(isStreamingMediaUrl('ftp://example.com/file.mp4')).toBe(false);
      expect(isStreamingMediaUrl(null as any)).toBe(false);
      expect(isStreamingMediaUrl(12345 as any)).toBe(false);
    });
  });

  describe('parseEpochTimestamp', () => {
    it('parses 10-digit epoch timestamp in seconds', () => {
      // 1609459200 is 2021-01-01 00:00:00 UTC
      const parsed = parseEpochTimestamp(1609459200);
      expect(parsed).not.toBeNull();
      expect(parsed?.isValid).toBe(true);
      expect(parsed?.formattedUtc).toContain('2021-01-01');
      expect(parsed?.relative).toBeDefined();
    });

    it('parses 13-digit epoch timestamp in milliseconds', () => {
      const parsed = parseEpochTimestamp(1609459200000);
      expect(parsed).not.toBeNull();
      expect(parsed?.isValid).toBe(true);
      expect(parsed?.formattedUtc).toContain('2021-01-01');
    });

    it('parses string representation of epoch timestamp', () => {
      const parsed = parseEpochTimestamp('1609459200');
      expect(parsed).not.toBeNull();
      expect(parsed?.isValid).toBe(true);
    });

    it('returns null for values out of plausible epoch ranges', () => {
      expect(parseEpochTimestamp(123)).toBeNull(); // too small
      expect(parseEpochTimestamp(99999999999999)).toBeNull(); // too large
      expect(parseEpochTimestamp(null)).toBeNull();
      expect(parseEpochTimestamp(undefined)).toBeNull();
      expect(parseEpochTimestamp('not-a-number')).toBeNull();
    });

    it('calculates relative descriptions correctly', () => {
      const now = Date.now();
      const justNow = parseEpochTimestamp(now);
      expect(justNow?.relative).toBe('just now');

      const pastTenMin = parseEpochTimestamp(now - 10 * 60 * 1000);
      expect(pastTenMin?.relative).toBe('10m ago');

      const pastTwoHours = parseEpochTimestamp(now - 2 * 60 * 60 * 1000);
      expect(pastTwoHours?.relative).toBe('2h ago');

      const pastThreeDays = parseEpochTimestamp(now - 3 * 24 * 60 * 60 * 1000);
      expect(pastThreeDays?.relative).toBe('3d ago');

      const futureDays = parseEpochTimestamp(now + 2 * 24 * 60 * 60 * 1000);
      expect(futureDays?.relative).toBe('in 2d');
    });
  });

  describe('isColorHex', () => {
    it('identifies valid 3-digit and 6-digit hex color strings', () => {
      expect(isColorHex('#fff')).toBe(true);
      expect(isColorHex('#FFF')).toBe(true);
      expect(isColorHex('#0b0f19')).toBe(true);
      expect(isColorHex('#22c55e')).toBe(true);
    });

    it('identifies valid 8-digit hex colors with alpha', () => {
      expect(isColorHex('#0b0f19ff')).toBe(true);
    });

    it('rejects invalid color strings', () => {
      expect(isColorHex('rgb(255,255,255)')).toBe(false);
      expect(isColorHex('red')).toBe(false);
      expect(isColorHex('#12')).toBe(false);
      expect(isColorHex('#12345')).toBe(false);
      expect(isColorHex('#gggggg')).toBe(false);
      expect(isColorHex(null as any)).toBe(false);
    });
  });

  describe('formatJsonPath', () => {
    it('formats root path to $', () => {
      expect(formatJsonPath('root')).toBe('$');
      expect(formatJsonPath('')).toBe('$');
    });

    it('replaces root prefix with $', () => {
      expect(formatJsonPath('root.data.user.id')).toBe('$.data.user.id');
      expect(formatJsonPath('root.items[0].name')).toBe('$.items[0].name');
    });
  });
});
