// In-game copy, UK English (DESIGN.md §2). Plain for instructions and errors.
import type { TargetMode } from '../data/schemas.ts';
import type { CommandReason } from '../sim/types.ts';

export const REASONS: Record<CommandReason, string> = {
  OUT_OF_BOUNDS: 'Off the map',
  LEVEL_OVER: 'The battle is over',
  NOT_IN_LOADOUT: 'Not in your loadout',
  NOT_BUILDABLE: "Can't build here",
  OCCUPIED: "Something's already here",
  ENEMY_IN_WAY: "Someone's standing there",
  BLOCKS_ROUTE: 'That would block the road',
  TRAPS_ENEMY: "You'd trap them",
  NO_CASH: 'Not enough cash',
  NO_SUCH_TOWER: 'That tower has gone',
  MAX_TIER: 'Fully upgraded',
  NO_MORE_WAVES: 'No more waves',
  NOT_A_BLOCKER: 'Nothing to clear here',
};

export const TARGET_LABEL: Record<TargetMode, string> = {
  first: 'First',
  last: 'Last',
  strongest: 'Strongest',
  closest: 'Closest',
};

export const TOWER_BLURB: Record<string, string> = {
  rattler: 'Cheap and cheerful rapid fire.',
  treacle: 'Sprays sticky treacle that slows the ground troops.',
  skylark: 'Homing rockets for anything that flies.',
  thumper: 'Long-range mortar. Needs room: it cannot hit anything too close.',
  scorcher: 'Short-range flame. Burns through armour.',
  sparkplug: 'Chain lightning that jumps between targets. Breaks shields.',
  sunbeam: 'Charges up, then burns a line through everything in front of it.',
  icebox: 'Freezes everything nearby. Thawed troops take extra damage.',
  teaurn: 'Towers nearby fire faster. Nothing like a brew.',
  bellower: 'Shouts "About turn!" and sends them marching back the way they came.',
  bubbler: 'Traps a target in a bubble and floats it back along the road.',
  piechucker: 'Custard pies strip armour and slow the troops down.',
};

/** Field-guide flavour (§12): jokes live here, never in instructions. */
export const TOWER_FLAVOUR: Record<string, string> = {
  rattler: 'Two barrels, one drum of ammunition and a very loud opinion.',
  treacle: 'Borrowed from the mess kitchen and never returned.',
  skylark: 'Each rocket has little wings. Nobody knows if they help.',
  thumper: 'It goes thump. Then, a little later, somewhere else, it goes BOOM.',
  scorcher: 'Converted from a pot-bellied stove. Still makes excellent toast.',
  sparkplug: 'The largest spark plug in Umbershire, attached to the second largest dynamo.',
  sunbeam: 'A magnifying glass of truly irresponsible size.',
  icebox: 'Keeps the milk fresh and the enemy frozen.',
  teaurn: 'Morale, measured in cups.',
  bellower: 'Parade-ground voice. Nobody has ever disobeyed it, including the enemy.',
  bubbler: 'Bath time for the Grand Blustering Army. Bring your own duck.',
  piechucker: 'The bakery wanted the cart back. The bakery was told no.',
};

export const ENEMY_FLAVOUR: Record<string, string> = {
  footling: "General Bluster's finest, in the sense that there are a lot of them.",
  scarper: 'Runs everywhere. Mostly away from responsibility.',
  puttputt: 'A moped, a rider and roughly nine seconds of courage.',
  tinkettle: 'An armoured car shaped like a kettle. Small bullets just rattle off.',
  lummox: 'Enormous, slow and very hard to persuade. Slows and stuns only half work on him.',
  brolly: 'Hides under a big umbrella that soaks up hits. Lightning pops it inside out.',
  sawbones: 'Patches up anyone nearby. Deal with the medic first.',
  trio: 'Three soldiers in one long coat. They fall apart when pressed.',
  tiddler: 'What is left of a Trenchcoat Trio, and furious about it.',
  tubthumper: 'Drums a quick march. Anyone nearby walks faster.',
  whirligig: 'A little autogyro that flies straight over your maze.',
  gasbag: 'A barrage balloon with ideas above its station. Tough, slow, airborne.',
  flattener: 'A steamroller with a brass whistle and no brakes to speak of.',
  dredger: 'A sand crawler that keeps unloading motorbikes out of the back.',
  grinder: 'An icebreaker on runners. Shatter its ice shield and it reels for a moment.',
  smogmother: 'A smoky zeppelin that drops armoured kettles on your road.',
  kerblam: "General Bluster's walking boiler. It gets angrier as it falls apart.",
};

export const MODE_TEXT: Record<'standard' | 'suddenDeath' | 'timeTrial' | 'puzzle', string> = {
  standard: 'Survive every wave.',
  suddenDeath: 'Hold out until the timer runs down, against a stream that never stops.',
  timeTrial: 'Defeat enough of them before the clock runs out.',
  puzzle: 'A fixed budget and a fixed set of towers. Find the way.',
};

export const DIFFICULTY_LABEL = { casual: 'Casual', tough: 'Tough', heroic: 'Heroic' } as const;

/** A bound key as the player sees it (§21). */
export const keyName = (k: string): string => (k === ' ' ? 'Space' : k === 'Escape' ? 'Esc' : k.length === 1 ? k.toUpperCase() : k);

/** Targeting options, explained in the tooltips (§4, §18.6). */
export const TARGET_TIP: Record<TargetMode, string> = {
  first: 'Aims at whoever is closest to the exit.',
  last: 'Aims at whoever is furthest from the exit.',
  strongest: 'Aims at whoever has the most health and shield.',
  closest: 'Aims at whoever is nearest the tower.',
};

export const MODE_NAME: Record<'standard' | 'suddenDeath' | 'timeTrial' | 'puzzle', string> = {
  standard: 'Standard',
  suddenDeath: 'Sudden Death',
  timeTrial: 'Time Trial',
  puzzle: 'Puzzle',
};

export function targetsLabel(ground: boolean, air: boolean): string {
  return ground && air ? 'Ground and air' : air ? 'Air only' : 'Ground only';
}
