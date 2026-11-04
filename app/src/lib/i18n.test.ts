import { describe, expect, it } from 'vitest';
import ptBR from '../content/pt-BR/ui.json';
import es from '../content/es/ui.json';
import en from '../content/en/ui.json';

describe('ui texts', () => {
  it('have the same keys in every language', () => {
    const keys = Object.keys(ptBR).sort();
    expect(Object.keys(es).sort()).toEqual(keys);
    expect(Object.keys(en).sort()).toEqual(keys);
  });

  it('use the same placeholders in every language', () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const k of Object.keys(ptBR) as (keyof typeof ptBR)[]) {
      expect(ph(es[k])).toEqual(ph(ptBR[k]));
      expect(ph(en[k])).toEqual(ph(ptBR[k]));
    }
  });
});
