/*
 * How long "Jogar rodada" ignores taps after the round summary closes (resumo-rodada.md, "Fluxo
 * da rodada", step 6; the window of the confirmations in steps, design-system.md). Alone in its
 * file, without imports, so the E2E helpers read the same value (tests/e2e/career.ts).
 */
export const PLAY_GUARD_MS = 500;
