import type { PlayerId, Side } from '@engine';
import { t } from '@lib/i18n';
import { nameOf, type NarrationContext } from './narration';
import type { MatchStep } from './steps';

/*
 * Which tag a step of the match puts on the pitch (docs/design/telas/partida-campo-v2.md, 9 and
 * 10): the table of steps and kinds, as a pure function of the step. It reads the same event the
 * commentary line of the step reads, so the tag names the player the line names. The tag never
 * says more than the step does: the start of a goal and the start of a chance of the same kind,
 * side and player give the same plan (only the outcome step tells them apart).
 *
 * No text here: `TAG_KIND_KEYS` are the keys of `app/src/content/<idioma>/ui.json`, which the
 * screen translates.
 */

/** The kind a tag shows, in the order of the table of 9. */
export type TagKind = 'shot' | 'freeKick' | 'penalty' | 'saved' | 'post' | 'wide' | 'goal' | 'red';

/** The i18n key of the kind (the type of the play, or the title of the goal tag). */
export const TAG_KIND_KEYS: Readonly<Record<TagKind, string>> = {
  shot: 'match.live.shot',
  freeKick: 'match.live.freeKick',
  penalty: 'match.live.penalty',
  saved: 'match.tag.saved',
  post: 'match.tag.post',
  wide: 'match.tag.wide',
  goal: 'match.celebration.title',
  red: 'report.event.red',
};

export interface TagPlan {
  /** `play` (the play and the red card) or `goal`. */
  readonly tone: 'play' | 'goal';
  readonly kind: TagKind;
  /** The player of the event: the finisher, the taker, the scorer or the sent-off. */
  readonly player: PlayerId;
  readonly side: Side;
  /**
   * The same through the start and the outcome of a play (only its kind changes, in place); a
   * goal is another tag (the goal tone) and another player replaces it at once.
   */
  readonly key: string;
}

/** The tag of `step`, or none (a minute with nothing shown, a card, a substitution, the phases). */
export function tagPlanOf(step: MatchStep): TagPlan | undefined {
  const line = step.line;
  if (line === undefined || step.timing === undefined) return undefined;
  const source = line.source;
  const plan = (tone: TagPlan['tone'], kind: TagKind, player: PlayerId, side: Side): TagPlan => ({
    tone,
    kind,
    player,
    side,
    key: `${line.id}:${tone}`,
  });
  switch (source.type) {
    case 'chance':
      return plan(
        'play',
        line.stage === 'build'
          ? source.kind === 'freeKick'
            ? 'freeKick'
            : 'shot'
          : source.outcome === 'saved'
            ? 'saved'
            : source.outcome === 'post'
              ? 'post'
              : 'wide',
        source.shooter,
        source.side,
      );
    case 'goal':
      if (line.stage === 'build') {
        return plan(
          'play',
          source.kind === 'freeKick' ? 'freeKick' : 'shot',
          source.scorer,
          source.side,
        );
      }
      return plan('goal', 'goal', source.scorer, source.side);
    case 'penaltyAwarded':
      return plan('play', 'penalty', source.taker, source.side);
    case 'penaltyMissed':
      return plan(
        'play',
        source.outcome === 'saved' ? 'saved' : source.outcome === 'post' ? 'post' : 'wide',
        source.taker,
        source.side,
      );
    case 'red':
      return plan('play', 'red', source.player, source.side);
    default:
      return undefined;
  }
}

/** What a tag says of its plan (the texts the screen translates and the number of the shirt). */
export interface TagFields {
  readonly kind: string;
  readonly name: string;
  /** `Player.shirt` of the same `PlayerId` as the name; none if he is unknown to the game. */
  readonly shirt?: number;
}

/**
 * The kind, the name and the shirt number of the tag of `plan`, all of its `PlayerId`: the same
 * name the commentary line of the step writes (`nameOf`).
 */
export function tagFields(plan: TagPlan, ctx: NarrationContext): TagFields {
  const shirt = ctx.game.players[plan.player]?.shirt;
  return {
    kind: t(TAG_KIND_KEYS[plan.kind], ctx.lang),
    name: nameOf(ctx, plan.player),
    ...(shirt === undefined ? {} : { shirt }),
  };
}
