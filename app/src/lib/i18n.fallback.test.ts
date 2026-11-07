import { describe, expect, it, vi } from 'vitest';
import { t } from './i18n.ts';

/*
 * The fallback of `t()` for a key that exists only in pt-BR (a draft waiting for the
 * content-writer), with catalogs of this test: the real ones may have every key translated.
 */

vi.mock('../content/pt-BR/ui.json', () => ({
  default: { 'test.draft': 'Rascunho {n}', 'test.both': 'Os dois' },
}));
vi.mock('../content/en/ui.json', () => ({ default: { 'test.both': 'Both' } }));
vi.mock('../content/es/ui.json', () => ({ default: { 'test.both': 'Los dos' } }));
vi.mock('../content/pt-BR/errors.json', () => ({ default: {} }));
vi.mock('../content/en/errors.json', () => ({ default: {} }));
vi.mock('../content/es/errors.json', () => ({ default: {} }));
vi.mock('../content/pt-BR/fans.json', () => ({ default: {} }));
vi.mock('../content/en/fans.json', () => ({ default: {} }));
vi.mock('../content/es/fans.json', () => ({ default: {} }));

describe('t() fallback', () => {
  it('uses pt-BR for a key not yet translated, with its variables', () => {
    expect(t('test.draft', 'en', { n: 2 })).toBe('Rascunho 2');
    expect(t('test.draft', 'es', { n: 3 })).toBe('Rascunho 3');
  });

  it('uses the language when it has the key', () => {
    expect(t('test.both', 'en')).toBe('Both');
    expect(t('test.both', 'es')).toBe('Los dos');
  });
});
