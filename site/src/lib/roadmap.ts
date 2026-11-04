import md from '../../../docs/roadmap.md?raw';

export type FeatureStatus = 'disponivel' | 'em-desenvolvimento' | 'planejado';

export interface Stage {
  id: string;
  name: string;
  delivery: string;
  state: string;
  status: FeatureStatus;
}

/** Single source: the table in docs/roadmap.md, read at build time. */
export const stages: Stage[] = md
  .split('\n')
  .filter((l) => l.startsWith('|') && !/^\|\s*:?-{3,}/.test(l) && !l.startsWith('| Etapa'))
  .map((l) =>
    l
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim().replace(/`/g, '')),
  )
  .map(([id, name, delivery, state]) => ({
    id: id ?? '',
    name: name ?? '',
    delivery: delivery ?? '',
    state: state ?? '',
    status: stateToStatus(state ?? ''),
  }));

export const roadmapNote = md.split('\n').find((l) => l.startsWith('Sem datas')) ?? '';

function stateToStatus(state: string): FeatureStatus {
  if (state.startsWith('conclu')) return 'disponivel';
  if (state.startsWith('em andamento')) return 'em-desenvolvimento';
  return 'planejado';
}

/**
 * Status of a feature, derived from its stage. A stage that is not finished is never
 * "disponivel", unless the feature is explicitly marked as published (`published`).
 */
export function statusForStage(stageId: string, published = false): FeatureStatus {
  if (published) return 'disponivel';
  const stage = stages.find((s) => s.id === stageId);
  if (!stage) return 'planejado';
  return stage.status === 'disponivel' ? 'disponivel' : stage.status;
}

export const currentStage = stages.find((s) => s.status === 'em-desenvolvimento');
