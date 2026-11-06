import { config } from '@lib/config';
import { createCareerApp } from '@lib/career';

/*
 * The career layer of this tab, built once: the CareerService (the only one that writes) and the
 * local error log. The screens import it from here; they never build a store of their own.
 */
export const { careers, errors } = createCareerApp({ appVersion: config.version });
