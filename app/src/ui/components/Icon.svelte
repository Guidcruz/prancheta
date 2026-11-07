<script lang="ts" module>
  /**
   * Provisional icon set (24x24, 2px stroke), drawn in-house in the same style as the site's
   * icons. It stays behind this component until the art-director's own set is approved (US-015).
   */
  export type IconName =
    | 'club'
    | 'squad'
    | 'table'
    | 'calendar'
    | 'news'
    | 'social'
    | 'saves'
    | 'settings'
    | 'about'
    | 'tutorial'
    | 'menu'
    | 'back'
    | 'close'
    | 'chevron-right'
    | 'external'
    | 'play'
    | 'warning'
    | 'error'
    | 'info'
    | 'retry'
    | 'reload'
    | 'download'
    | 'upload'
    | 'copy'
    | 'more'
    | 'check'
    | 'plus'
    | 'trash'
    | 'edit'
    | 'injury'
    | 'card'
    | 'star'
    | 'derby'
    | 'swap'
    | 'arrow-up'
    | 'arrow-down'
    | 'improvised'
    | 'captain'
    | 'suggest'
    | 'undo';

  const paths: Record<IconName, string> = {
    club: '<path d="M5 4.5h14v8c0 4-3 6.5-7 8-4-1.5-7-4-7-8z"/>',
    squad:
      '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><circle cx="17" cy="9.5" r="2.3"/><path d="M16.5 14.2c2.6 0 4 1.6 4 4"/>',
    table:
      '<rect x="4" y="4.5" width="16" height="15" rx="2"/><path d="M4 9.5h16M4 14.5h16M9 4.5v15"/>',
    calendar:
      '<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8 3.5v4M16 3.5v4"/>',
    news: '<rect x="4" y="4.5" width="16" height="15" rx="2"/><path d="M8 9h8M8 12.5h8M8 16h5"/>',
    social: '<path d="M5 5.5h14v10H11l-4 3.5v-3.5H5z"/>',
    saves: '<path d="M5 4.5h11l3 3v12H5z"/><path d="M8 4.5v5h7v-5M8 19.5v-5h8v5"/>',
    settings:
      '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    about: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.5v.5"/>',
    tutorial:
      '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 16.5v.5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    'chevron-right': '<path d="M9 5l7 7-7 7"/>',
    external: '<path d="M14 4.5h5.5V10M19.5 4.5L11 13"/><path d="M17 14v5.5H4.5V7H10"/>',
    play: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8l3.5 2.5-1.3 4h-4.4l-1.3-4z"/>',
    warning: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.5M12 17v.5"/>',
    error: '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.5v.5"/>',
    retry: '<path d="M5 12a7 7 0 1 0 2-5"/><path d="M5 4v4h4"/>',
    reload: '<path d="M19 12a7 7 0 1 1-2-5"/><path d="M19 4v4h-4"/>',
    download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
    upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14"/>',
    copy: '<rect x="8" y="8" width="11.5" height="11.5" rx="2"/><path d="M5 15.5V5a.5.5 0 01.5-.5H16"/>',
    more: '<path d="M12 5.5v.5M12 11.75v.5M12 18v.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash:
      '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5"/><path d="M10.5 11v5M13.5 11v5"/>',
    edit: '<path d="M14.5 5.5l4 4L9 19H5v-4z"/><path d="M12.5 7.5l4 4"/>',
    injury: '<rect x="4.5" y="4.5" width="15" height="15" rx="3"/><path d="M12 8.5v7M8.5 12h7"/>',
    card: '<rect x="7" y="4" width="10" height="15" rx="1.5" transform="rotate(10 12 11.5)"/>',
    star: '<path d="M12 4.5l2.3 4.8 5.2.7-3.8 3.6.9 5.2L12 16.3l-4.6 2.5.9-5.2-3.8-3.6 5.2-.7z"/>',
    derby:
      '<path d="M12 20.5c-3.5 0-6-2.4-6-5.6 0-3.4 2.6-5.2 3.4-8.4 1.6 1.2 2.4 2.8 2.4 4.4 1-.6 1.8-1.8 2-3.2 1.8 1.6 4.2 4 4.2 7.2 0 3.2-2.5 5.6-6 5.6z"/>',
    swap: '<path d="M5 8h13M15 5l3 3-3 3M19 16H6M9 13l-3 3 3 3"/>',
    'arrow-up': '<path d="M12 19V5M6 11l6-6 6 6"/>',
    'arrow-down': '<path d="M12 5v14M6 13l6 6 6-6"/>',
    improvised:
      '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>',
    captain: '<circle cx="12" cy="12" r="8.5"/><path d="M15.2 9.3a4.2 4.2 0 1 0 0 5.4"/>',
    suggest:
      '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  };
</script>

<script lang="ts">
  interface Props {
    name: IconName;
    size?: number;
    /** Accessible name. Without it the icon is decorative (text sits next to it). */
    label?: string;
  }
  const { name, size = 24, label }: Props = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  focusable="false"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- constant SVG paths from this file, never input -->
  {@html paths[name]}
</svg>

<style>
  svg {
    flex: none;
    display: block;
  }
</style>
