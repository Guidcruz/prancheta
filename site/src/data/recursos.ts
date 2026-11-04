import { statusForStage, type FeatureStatus } from '../lib/roadmap';

export interface Recurso {
  id: string;
  /** Roadmap stage the feature belongs to (docs/roadmap.md). */
  stage: string;
  /**
   * Explicit marking: only true once the feature is published in /jogo
   * (check docs/status.md). Nothing is derived into "disponivel".
   */
  disponivel?: boolean;
}

/** Single source of the feature states shown on the site. */
export const recursos: Recurso[] = [
  { id: 'rodadas-curtas', stage: '1a' },
  { id: 'carreira-offline', stage: '1a' },
  { id: 'clubes-ficticios', stage: '1a' },
  { id: 'tatica', stage: '1a' },
  { id: 'partida', stage: '1a' },
  { id: 'tabela-noticias', stage: '1a' },
  { id: 'saves', stage: '1a' },
  { id: 'ritmo-meu-ritmo', stage: '1a' },
  { id: 'serie-a', stage: '1a' },
  { id: 'liga-amigos', stage: '1b' },
  { id: 'conta-anonima', stage: '1b' },
  { id: 'piramide-nacional', stage: '2' },
  { id: 'series-b-d', stage: '2' },
  { id: 'mercado-financas', stage: '3' },
  { id: 'mercado-entre-jogadores', stage: '3' },
  { id: 'rede-social-completa', stage: '4' },
  { id: 'sincronizacao-saves', stage: '4' },
  { id: 'metas-diretoria', stage: '4' },
  { id: 'ritmo-tempo-real', stage: '4' },
  { id: 'america-do-sul', stage: '5' },
  { id: 'ligas-grandes', stage: '6' },
  { id: 'apoio-recompensas', stage: '6' },
];

export function getRecurso(id: string): Recurso {
  const r = recursos.find((x) => x.id === id);
  if (!r) throw new Error(`Unknown resource: ${id}`);
  return r;
}

/** "disponivel" only by explicit marking; otherwise the stage decides (never "disponivel"). */
export function statusForRecurso(id: string): FeatureStatus {
  const r = getRecurso(id);
  if (r.disponivel === true) return 'disponivel';
  const s = statusForStage(r.stage);
  return s === 'disponivel' ? 'em-desenvolvimento' : s;
}
