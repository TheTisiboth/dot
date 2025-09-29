// Export the test runner for the main test command
export { TestRunner } from './tests/testRunner.js';

// Run tests if this file is executed directly
import { TestRunner } from './tests/testRunner.js';

if (import.meta.url === `file://${process.argv[1]}`) {
  const testRunner = new TestRunner();
  testRunner.runAllTests().catch(console.error);
}