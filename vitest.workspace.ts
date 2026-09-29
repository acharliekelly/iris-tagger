import { resolve } from 'node:path';
import { defineWorkspace } from 'vitest/config';
const root = process.cwd();
export default defineWorkspace([
  resolve(root, 'packages/core/vitest.config.ts'),
  resolve(root, 'packages/config/vitest.config.ts'),
  resolve(root, 'packages/adapters/local-metadata/vitest.config.ts'),
  resolve(root, 'apps/local-api/vitest.config.ts'),
  resolve(root, 'apps/web/vitest.config.ts'),
]);
