import { describe, expect, it } from 'vitest';
import { parseStages, stages, statusForStage } from './roadmap';
import { recursos, statusForRecurso } from '../data/recursos';

const sample = [
  '| Etapa | Nome | Entrega jogável | Estado |',
  '| ----- | ---- | --------------- | ------ |',
  '| 0 | Um | a | concluída |',
  '| 1a | Dois | b | em andamento |',
  '| 1b | Três | c | planejada |',
].join('\n');

describe('roadmap parser', () => {
  it('reads the current docs/roadmap.md table', () => {
    expect(stages.length).toBeGreaterThanOrEqual(7);
    expect(stages[0]?.id).toBe('0');
    expect(stages.some((s) => s.id === '1a' && s.name.length > 0)).toBe(true);
    expect(stages.every((s) => s.state !== '')).toBe(true);
  });

  it('maps states to statuses', () => {
    const list = parseStages(sample);
    expect(list.map((s) => s.status)).toEqual(['disponivel', 'em-desenvolvimento', 'planejado']);
  });

  it('treats an unknown stage as planned', () => {
    expect(statusForStage('99', parseStages(sample))).toBe('planejado');
  });
});

describe('resource status', () => {
  it('never marks an in-progress stage as available', () => {
    for (const r of recursos.filter((x) => !x.disponivel)) {
      expect(statusForRecurso(r.id)).not.toBe('disponivel');
    }
  });

  it('keeps in-progress stage features in development', () => {
    expect(statusForRecurso('tatica')).toBe('em-desenvolvimento');
    expect(statusForRecurso('liga-amigos')).toBe('planejado');
  });
});
