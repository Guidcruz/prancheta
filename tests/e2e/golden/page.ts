import { matchGoldenCases } from '../../../app/src/engine/testing/match-goldens.ts';

/*
 * Página do golden da partida no navegador (T-024; docs/03-test-plan.md, 4 e risco do `Math.exp`).
 * Roda as mesmas entradas do golden do Vitest (engine/testing/match-goldens.ts) e devolve o JSON de
 * cada uma para o spec comparar com os arquivos de __golden__/. Empacotada pelo Vite no spec.
 */
const cases = matchGoldenCases();

(globalThis as { runGoldens?: () => Record<string, string> }).runGoldens = () =>
  Object.fromEntries(Object.entries(cases).map(([name, run]) => [name, JSON.stringify(run())]));
