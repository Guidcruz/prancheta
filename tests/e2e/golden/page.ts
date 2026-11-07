import { expTable } from '../../../app/src/engine/testing/exp-table.ts';
import { matchGoldenCases } from '../../../app/src/engine/testing/match-goldens.ts';

/*
 * Página do golden do motor no navegador (T-024, T-074; docs/03-test-plan.md, 4; ADR-0020). Roda
 * as mesmas entradas dos goldens do Vitest (engine/testing/match-goldens.ts e
 * engine/testing/exp-table.ts) e devolve o JSON de cada uma para o spec comparar com os arquivos
 * de __golden__/. Empacotada pelo Vite no spec.
 */
const cases: Record<string, () => unknown> = { ...matchGoldenCases(), 'exp-table': expTable };

(globalThis as { runGoldens?: () => Record<string, string> }).runGoldens = () =>
  Object.fromEntries(Object.entries(cases).map(([name, run]) => [name, JSON.stringify(run())]));
