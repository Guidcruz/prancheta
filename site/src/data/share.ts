import { config } from '../../../config/prancheta.config.ts';

/**
 * Single source of the sharing texts: `description` goes to <meta name="description"> and
 * og:description; `ogTitle` is the title drawn on the share image (scripts/og.mjs) and its alt.
 * Source: docs/content/site/complementos.md ("Descrições para compartilhar", approved).
 */
export interface ShareEntry {
  /** Page key; the image is site/public/og/<file>.png. */
  slug: string;
  file: string;
  description: string;
  ogTitle: string;
}

const name = config.name;

export const share: ShareEntry[] = [
  {
    slug: 'index',
    file: 'index.png',
    description: `Técnico de futebol no celular, com clubes fictícios do Brasil. Acompanhe o ${name} em construção.`,
    ogTitle: config.slogan.short['pt-BR'],
  },
  {
    slug: 'o-jogo',
    file: 'o-jogo.png',
    description: `Escale o time, ajuste a tática em três opções e acompanhe a partida minuto a minuto no ${name}.`,
    ogTitle: 'Como é jogar',
  },
  {
    slug: 'modos',
    file: 'modos.png',
    description: `Carreira offline ou liga online com amigos, no seu ritmo ou em tempo real. Veja os modos do ${name}.`,
    ogTitle: 'Carreira ou liga com amigos',
  },
  {
    slug: 'clubes',
    file: 'clubes.png',
    description: `Clubes fictícios com nomes em trocadilho e escudos desenhados por código. Conheça os times do ${name}.`,
    ogTitle: 'Clubes com trocadilho',
  },
  {
    slug: 'perguntas',
    file: 'perguntas.png',
    description: `Preço, celular, privacidade e online: respostas diretas sobre o ${name}.`,
    ogTitle: 'Perguntas frequentes',
  },
  {
    slug: 'roadmap',
    file: 'roadmap.png',
    description: `As etapas do ${name}, cada uma com uma versão jogável. Veja onde estamos.`,
    ogTitle: 'O roteiro do jogo',
  },
  {
    slug: 'devlog',
    file: 'devlog.png',
    description: `O diário de desenvolvimento do ${name}: o que ficou pronto e o que vem a seguir.`,
    ogTitle: 'Diário de desenvolvimento',
  },
  {
    slug: 'apoiar',
    file: 'apoiar.png',
    description: `Como apoiar o desenvolvimento do ${name}.`,
    ogTitle: 'Apoie o projeto',
  },
  {
    slug: 'privacidade',
    file: 'privacidade.png',
    description: `Política de privacidade do ${name}: o que o jogo guarda e o que não guarda.`,
    ogTitle: 'Privacidade',
  },
];

export function shareFor(slug: string): ShareEntry {
  const e = share.find((x) => x.slug === slug);
  if (!e) throw new Error(`Unknown share slug: ${slug}`);
  return e;
}
