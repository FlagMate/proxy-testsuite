export function runTests(tests) {
  return tests.map((test) => ({
    name: test.name,
    success: test.run(),
  }));
}