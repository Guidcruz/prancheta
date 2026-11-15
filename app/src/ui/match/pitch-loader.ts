import { lazyChunk } from '../lazy-chunk';

/*
 * The chunk of the 2D pitch (docs/02-architecture.md, 4.7): the choreography, the MatchPitch and
 * the GoalCelebration, asked by the match screen only in "Animada completa", never in "Só lances
 * principais". This file is the only way into the chunk (the lint refuses a static import of it).
 */

/** What the chunk of the pitch gives the screen. */
export type PitchChunk = typeof import('./pitch/pitch-chunk.ts');

/** Loads the chunk of the pitch once per session; a failure can be asked again. */
export const loadPitch: () => Promise<PitchChunk> = lazyChunk(
  () => import('./pitch/pitch-chunk.ts'),
);
