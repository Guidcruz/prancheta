import { config, type Lang } from '@lib/config';
import { t } from '@lib/i18n';
import type { NoticeAction } from './components/actions';
import type { AlertAction } from './save-alerts';

/*
 * The buttons of a notice or an error from its actions (erros-e-avisos.md, "Ações e onde levam"),
 * translated. `retry`, `home` and `free` depend on where the notice is, so the caller passes them.
 */

export interface ActionHandlers {
  readonly retry?: () => void;
  readonly home?: () => void;
  /** "Liberar espaço": opens Carreiras e backup (inside the frame). */
  readonly free?: () => void;
}

function reload(): void {
  // "Atualizar o jogo" asks the service worker for the new version from T-039 on; until then
  // both reload the page.
  location.reload();
}

export function noticeActions(
  actions: readonly AlertAction[],
  handlers: ActionHandlers,
  lang: Lang,
): NoticeAction[] {
  const out: NoticeAction[] = [];
  for (const action of actions) {
    const label = t(`action.${action}`, lang);
    if (action === 'reload' || action === 'update')
      out.push({ label, onclick: reload, icon: 'reload' });
    else if (action === 'retry' && handlers.retry) {
      out.push({ label, onclick: handlers.retry, icon: 'retry' });
    } else if (action === 'home' && handlers.home) out.push({ label, onclick: handlers.home });
    else if (action === 'free' && handlers.free) out.push({ label, onclick: handlers.free });
    else if (action === 'help') {
      out.push({
        label,
        href: config.contacts.supportUrl,
        external: true,
        externalLabel: t('link.external', lang),
      });
    }
  }
  return out;
}
