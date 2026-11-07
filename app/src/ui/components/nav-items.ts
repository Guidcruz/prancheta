import type { IconName } from './Icon.svelte';

/**
 * The destinations of the career frame, in order (docs/design/telas/navegacao.md). Text keys
 * only: the screen translates them with `t()` and adds the `href`. The Mercado tab enters in
 * Etapa 3, between Tabela and Calendário.
 */
export interface NavDestination {
  readonly id: string;
  readonly icon: IconName;
  readonly labelKey: string;
}

/** Bottom tabs on the phone; first group of the desktop sidebar. */
export const NAV_TABS: readonly NavDestination[] = [
  { id: 'club', icon: 'club', labelKey: 'nav.tab.club' },
  { id: 'squad', icon: 'squad', labelKey: 'nav.tab.squad' },
  { id: 'table', icon: 'table', labelKey: 'nav.tab.table' },
  { id: 'calendar', icon: 'calendar', labelKey: 'nav.tab.calendar' },
];

/** Second group of the sidebar; on the phone, in the "Mais" menu. Social only when on. */
export const NAV_EXTRA: readonly NavDestination[] = [
  { id: 'news', icon: 'news', labelKey: 'nav.news' },
  { id: 'social', icon: 'social', labelKey: 'nav.social' },
];

/** Third group of the sidebar; on the phone, in the "Mais" menu. */
export const NAV_SETTINGS: readonly NavDestination[] = [
  { id: 'saves', icon: 'saves', labelKey: 'nav.saves' },
  { id: 'preferences', icon: 'settings', labelKey: 'nav.preferences' },
  { id: 'about', icon: 'about', labelKey: 'nav.about' },
];

/** Only in the "Mais" menu (the sidebar has no tutorial entry). */
export const NAV_TUTORIAL: NavDestination = {
  id: 'tutorial',
  icon: 'tutorial',
  labelKey: 'nav.tutorial',
};
