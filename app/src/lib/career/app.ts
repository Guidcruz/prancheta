import { ENGINE_VERSION } from '../../engine/index.ts';
import { ErrorLog } from '../errors/index.ts';
import { SAVE_FIELD_NAMES, SAVE_SCHEMA_VERSION, SaveStore } from '../save/index.ts';
import { CareerService } from './service.ts';

/*
 * The career layer of the running game: one store on the game's database (`prancheta`, or
 * `prancheta-test` in the test build), the error log on its `errors` ring and the
 * `CareerService` on both. The interface builds it once, at start, and never reaches lib/save.
 */

export interface CareerApp {
  readonly careers: CareerService;
  readonly errors: ErrorLog;
}

export function createCareerApp(options: { readonly appVersion: string }): CareerApp {
  const store = new SaveStore();
  const errors = new ErrorLog(
    {
      appVersion: options.appVersion,
      schemaVersion: SAVE_SCHEMA_VERSION,
      engineVersion: ENGINE_VERSION,
    },
    store,
    { fields: SAVE_FIELD_NAMES },
  );
  const careers = new CareerService({ store, log: errors, appVersion: options.appVersion });
  return { careers, errors };
}
