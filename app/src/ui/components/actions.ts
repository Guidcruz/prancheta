import type { IconName } from './Icon.svelte';

/** An action offered by a notice or an error: a button, or a link that looks like one. */
export type NoticeAction =
  | { readonly label: string; readonly onclick: () => void; readonly icon?: IconName }
  | {
      readonly label: string;
      readonly href: string;
      readonly external?: boolean;
      /** Accessible hint for external links, already translated. */
      readonly externalLabel?: string;
      readonly icon?: IconName;
    };
