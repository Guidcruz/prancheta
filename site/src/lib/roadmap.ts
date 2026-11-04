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
export const stages: Stage[] = parseStages(md);

export function parseStages(source: string): Stage[] {
  return source
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
}

export const roadmapNote = md.split('\n').find((l) => l.startsWith('Sem datas')) ?? '';

function stateToStatus(state: string): FeatureStatus {
  if (state.startsWith('conclu')) return 'disponivel';
  if (state.startsWith('em andamento')) return 'em-desenvolvimento';
  return 'planejado';
}

/** Status of a stage from its state in docs/roadmap.md. Unknown stages are "planejado". */
export function statusForStage(stageId: string, list: Stage[] = stages): FeatureStatus {
  return list.find((s) => s.id === stageId)?.status ?? 'planejado';
}

export const currentStage = stages.find((s) => s.status === 'em-desenvolvimento');
