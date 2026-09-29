// The SFX catalogue (DESIGN.md §17.3): every sound the game asks for, with what it should sound like.
// `patches.ts` must implement exactly these keys; a test checks that.

const TOWER_SOUNDS: Record<string, string> = {
  rattler: 'pop-pop; T3 a heavier chatter plus a tinkle of spent brass',
  treacle: 'a glug-splat',
  skylark: 'a whoosh-chirp (rocket launch)',
  thumper: 'a thoomp (the shell leaving the mortar)',
  scorcher: 'a whumph and a crackle',
  sparkplug: 'a zap-crackle',
  sunbeam: 'a rising hum, then a searing shimmer',
  icebox: 'a crystalline crack',
  teaurn: 'a kettle whistle (when it is built or upgraded)',
  bellower: 'a comic horn blast',
  bubbler: 'a blub-pop',
  piechucker: 'a boing (the pie leaving the spoon)',
};

const OTHER_SOUNDS: Record<string, string> = {
  // Impacts
  'boom.thumper': 'the shell landing: a whistle down, then a boom',
  'boom.piechucker': 'a pie landing: a wet splat',
  'boom.skylark': 'a small rocket burst in the air',
  'boom.small': 'a small generic impact',
  // Enemies
  'enemy.pop': 'a small soldier knocked out: a comic pop and a squeak',
  'enemy.clank': 'an armoured unit knocked out: a metal clank and rattle',
  'enemy.air': 'a flier knocked out: a sputter and a whistle falling',
  'enemy.leak': 'someone got through: a sad two-note horn and a gate bell',
  'enemy.shieldbreak': 'a Brolly shield shorting out: a zap and a snap',
  'enemy.shieldup': 'a Brolly shield coming back: a soft rising hum',
  'enemy.heal': 'a Sawbones healing: a soft bright chime',
  'enemy.split': 'a Trenchcoat Trio bursting apart: a cloth rip and a yelp',
  'enemy.tunnel': 'going down a tunnel: a hollow whoomp',
  'status.freeze': 'frozen solid: an icy shimmer',
  'status.pop': 'a bubble popping: a bright pop',
  'status.reverse': '"About turn!": a quick comic whistle-slide down',
  // Bosses
  'boss.arrive': 'a boss arriving: a huge engine roar and a clang',
  'boss.phase': 'a boss changing phase: a metallic groan and a hiss of steam',
  'boss.drop': 'the Smogmother dropping a Tin Kettle: a clunk and a whistle',
  'boss.death': 'a boss knocked out: a long rumbling explosion with debris',
  // UI
  'ui.click': 'a button press: a short wooden tock',
  'ui.select': 'selecting a tower: a light click-chirp',
  'ui.build': 'a tower placed: a solid thunk and a sandbag thump',
  'ui.upgrade': 'a tower upgraded: a rising ratchet and a ding',
  'ui.sell': 'a tower sold: coins',
  'ui.error': 'a refused action: a soft low buzz-bonk (never harsh)',
  'ui.clear': 'an obstacle cleared: a crumble and a whoosh',
  'ui.coins': 'an early-call bonus: a few coins',
  'ui.wave': 'a wave marching in on its own: a short snare roll',
  // Ambience (looped quietly under the music, per zone)
  'amb.z1': 'farmland: a soft breeze, birdsong now and then, a distant sheep',
  'amb.z2': 'desert: dry wind, a creaking wind pump',
  'amb.z3': 'snow: cold wind, the odd creak of ice',
  'amb.z4': 'works: a low machine hum, distant clanks and hisses',
  'amb.z5': 'volcano: a deep rumble, lava bubbling, crackles',
};

export const TOWER_TYPES = Object.keys(TOWER_SOUNDS);

/** Every SFX key, with its brief. */
export const SFX_BRIEF: Record<string, string> = {
  ...Object.fromEntries(TOWER_TYPES.flatMap((t) => [1, 2, 3].map((n) => [`tower.${t}.t${n}`, `${TOWER_SOUNDS[t]} (tier ${n}: heavier and richer with each tier)`]))),
  ...OTHER_SOUNDS,
};

export const SFX_KEYS = Object.keys(SFX_BRIEF);
