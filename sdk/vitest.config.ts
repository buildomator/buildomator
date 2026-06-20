import { defineConfig } from 'vitest/config';

// Many SDK tests spawn the `gsd-tools.cjs` CJS CLI as a subprocess (golden parity,
// hotpath methods, command-router seams). Running test files in parallel across
// workers floods the machine with concurrent node subprocesses and causes
// timeout-based flakiness — the same tests pass in isolation but fail in bursts
// under the full suite. `fileParallelism: false` serializes file execution so
// subprocess pressure stays bounded and results are deterministic.
//
// Also defines the `unit` / `integration` projects that package.json's
// `test:unit` / `test:integration` scripts reference (previously no config existed,
// so `--project unit` errored with "No projects matched").
export default defineConfig({
  test: {
    fileParallelism: false,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.integration.test.ts'],
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.integration.test.ts'],
          fileParallelism: false,
        },
      },
    ],
  },
});
