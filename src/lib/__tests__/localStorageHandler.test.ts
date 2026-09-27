import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveValidationResult,
  getValidationResult,
  clearValidationResult,
  getAllValidationResults,
} from '../localStorageHandler';

describe('localStorageHandler', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and retrieves validation results from localStorage', () => {
    const payload = { testId: 't-1', passed: true, score: 100 };
    saveValidationResult('test-result-1', payload);

    const retrieved = getValidationResult('test-result-1');
    expect(retrieved).toEqual(payload);
  });

  it('returns null when getting a non-existent key', () => {
    const result = getValidationResult('non-existent-key');
    expect(result).toBeNull();
  });

  it('clears specific validation results by key', () => {
    saveValidationResult('key-to-delete', { foo: 'bar' });
    expect(getValidationResult('key-to-delete')).not.toBeNull();

    clearValidationResult('key-to-delete');
    expect(getValidationResult('key-to-delete')).toBeNull();
  });

  it('retrieves all stored validation results across keys', () => {
    saveValidationResult('res-a', { name: 'A' });
    saveValidationResult('res-b', { name: 'B' });

    const all = getAllValidationResults();
    expect(all).toHaveLength(2);
    const keys = all.map((item) => item.key);
    expect(keys).toContain('res-a');
    expect(keys).toContain('res-b');
  });
});
