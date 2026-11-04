import { config } from '../../../config/prancheta.config.ts';

const base = config.paths.site;

/** Menu order from docs/design/site.md. `id` matches the `current` prop of SiteHeader. */
export const navItems = [
  { id: 'o-jogo', href: `${base}o-jogo/`, label: 'O jogo' },
  { id: 'modos', href: `${base}modos/`, label: 'Modos de jogo' },
  { id: 'clubes', href: `${base}clubes/`, label: 'Clubes' },
  { id: 'perguntas', href: `${base}perguntas/`, label: 'Perguntas' },
  { id: 'roadmap', href: `${base}roadmap/`, label: 'Roteiro' },
  { id: 'devlog', href: `${base}devlog/`, label: 'Devlog' },
  { id: 'apoiar', href: `${base}apoiar/`, label: 'Apoiar' },
];
