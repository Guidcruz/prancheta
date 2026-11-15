/*
 * The only entry of the chunk of the 2D pitch (docs/02-architecture.md, 4.7): the screen gets this
 * module whole from `pitch-loader.ts` and calls its functions; the components stay in
 * ui/components/ (the boundary is the graph of imports, not the folder). The file's name names the
 * chunk (`pitch-chunk-[hash].js`), which the E2E uses to find the request.
 */
export { default as MatchPitch } from '../../components/MatchPitch.svelte';
export { default as GoalCelebration } from '../../components/GoalCelebration.svelte';
export {
  choreograph,
  createScene,
  sceneAt,
  stillScene,
  type Choreography,
  type PitchScene,
} from './scene.ts';
export { pitchKits, type PitchKits } from './kits.ts';
