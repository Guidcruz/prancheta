/*
 * The only entry of the chunk of the 2D pitch (docs/02-architecture.md, 4.7): the screen gets this
 * module whole from `pitch-loader.ts` and calls its functions; the components stay in
 * ui/components/ (the boundary is the graph of imports, not the folder). The file's name names the
 * chunk (`pitch-chunk-[hash].js`), which the E2E uses to find the request.
 */
export { default as MatchPitch } from '../../components/MatchPitch.svelte';
export { default as PitchTag, PITCH_TAG_MOTION } from '../../components/PitchTag.svelte';
export {
  choreograph,
  createScene,
  discShownIn,
  sceneAt,
  stillScene,
  tagDiscOf,
  type Choreography,
  type PitchScene,
} from './scene.ts';
export {
  pitchKits,
  pitchTagKits,
  tagKitOf,
  tagShirt,
  type PitchKits,
  type PitchTagKit,
  type PitchTagKits,
} from './kits.ts';
export { possessionOwners, OWNER } from './possession.ts';
