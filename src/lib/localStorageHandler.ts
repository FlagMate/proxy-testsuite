export function saveValidationResult(key, result) {
  localStorage.setItem(key, JSON.stringify(result));
}

export function getValidationResult(key) {
  const result = localStorage.getItem(key);
  return result ? JSON.parse(result) : null;
}

export function clearValidationResult(key) {
  localStorage.removeItem(key);
}

export function getAllValidationResults() {
  const results = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    results.push({ key, value: JSON.parse(value) });
  }
  return results;
}
