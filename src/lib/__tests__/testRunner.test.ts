import { describe, it, expect } from 'vitest';
import { runTests } from '../testRunner';

describe('testRunner', () => {
  it('should run tests and return results', () => {
    const mockTests = [
      { name: 'Test 1', run: () => true },
      { name: 'Test 2', run: () => false },
    ];
    const results = runTests(mockTests);
    expect(results).toEqual([
      { name: 'Test 1', success: true },
      { name: 'Test 2', success: false },
    ]);
  });

  it('should handle empty test cases', () => {
    const results = runTests([]);
    expect(results).toEqual([]);
  });
});
