// Zone terrain and world-map colours (DESIGN.md §16.3 zone palettes). Art palette
// module for terrain (V-1): the only place terrain.ts and worldmap.ts take colours from,
// alongside the shared P.

export const PZ = {
  // Zone 2: Scorchsand Flats
  sand: '#F0CF86',
  sandMid: '#DDAE62',
  sandDark: '#B9854A',
  mesa: '#C8764A',
  mesaDark: '#9A5238',
  mesaLight: '#E29A68',
  cactus: '#5E9B45',
  cactusDark: '#3E6F2E',
  oasis: '#4FC1D9',
  oasisDeep: '#2C93B8',
  bone: '#F4ECD8',

  // Zone 3: Frostnip Fells
  snow: '#F4F8FC',
  snowMid: '#D6E4F0',
  snowDark: '#A9C1D8',
  ice: '#BFE6F5',
  iceDark: '#84C6E6',
  iceWater: '#3F7FB3',
  iceWaterDeep: '#2A5F8F',
  pine: '#2E6B4F',
  pineDark: '#1F4D39',
  timber: '#8A5A35',
  carrot: '#F08A24',

  // Zone 4: Grimebottom Works
  concrete: '#B7B2A6',
  concreteDark: '#8F8A80',
  concreteLight: '#D2CEC3',
  steel: '#7D8791',
  steelDark: '#56606A',
  steelLight: '#A9B3BC',
  rust: '#C0612F',
  rustDark: '#8A3F1C',
  hazard: '#F2C230',
  sludge: '#6E8B3D',
  sludgeDark: '#4E6B26',
  sludgeLight: '#94AE5A',
  brick: '#A8553A',
  brickDark: '#7A3824',
  brickLight: '#C57455',
  belt: '#3B3F45',

  // Zone 5: Mount Kerblam
  basalt: '#4A3B3A',
  basaltDark: '#33282A',
  basaltLight: '#6B5754',
  ash: '#8C817B',
  ashLight: '#ABA19A',
  lava: '#FF7A1F',
  lavaCore: '#FFB63B',
  lavaDark: '#D2461A',
  obsidian: '#26222A',
  obsidianLight: '#4B4453',
  ember: '#FFD06A',

  // World map extras
  sea: '#3D98CF',
  seaDeep: '#2A74AA',
  seaLight: '#7CC3E6',
  beach: '#F3DA9C',
  field: '#A6CF4E',
  fieldGold: '#E3C95A',
  road: '#FFF1CF',
  cloud: '#FFFDF7',
  roof: '#C4533A',
} as const;
