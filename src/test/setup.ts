import '@testing-library/jest-dom';

// Extend Vitest's expect with jest-dom matchers
expect.extend({
  ...require('@testing-library/jest-dom/matchers'),
});