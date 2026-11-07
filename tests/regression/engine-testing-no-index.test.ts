import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

// A exceção do ESLint da raiz para tests/e2e/golden/page.ts reinclui a pasta engine/testing;
// um index.ts ali ficaria importável de fora do motor. Ver eslint.config.js.
it('não existe app/src/engine/testing/index.ts', () => {
  const index = fileURLToPath(new URL('../../app/src/engine/testing/index.ts', import.meta.url));
  expect(existsSync(index)).toBe(false);
});
