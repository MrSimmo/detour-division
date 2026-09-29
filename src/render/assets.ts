// Asset manifest loader (ADR-0006). Code only ever asks for sprite keys; which atlas
// page holds a key is the manifest's business, so hand-painted atlases can replace
// the baked ones under the same keys without code changes.
import { Assets, Texture, type Spritesheet } from 'pixi.js';

export interface Manifest {
  version: number;
  cellArt: number;
  atlases: Record<string, Record<string, string[]>>;
  sprites: Record<string, string>;
  towers: Record<string, { headLift: number; muzzle: number; rotates?: boolean }>;
}

export const ASSET_BASE = `${import.meta.env.BASE_URL}assets/`;

/** Groups every screen needs; zone terrain, bosses and the map load on demand (§19 page budget). */
export const CORE_GROUPS = ['towers', 'units', 'fx', 'ui'];

export class Art {
  readonly textures = new Map<string, Texture>();
  readonly manifest: Manifest;
  readonly scale: number;
  private loaded = new Map<string, string[]>();

  constructor(manifest: Manifest, scale: number) {
    this.manifest = manifest;
    this.scale = scale;
  }

  static async load(scale: 1 | 2, groups: string[] = CORE_GROUPS): Promise<Art> {
    const manifest = (await (await fetch(`${ASSET_BASE}manifest.json`)).json()) as Manifest;
    const art = new Art(manifest, scale);
    await art.ensure(groups);
    return art;
  }

  private urls(group: string): string[] {
    // A group baked at fewer scales (the world map is @1x only) falls back to what exists.
    const byScale = this.manifest.atlases[group] ?? {};
    return (byScale[String(this.scale)] ?? Object.values(byScale)[0] ?? []).map((u) => `${ASSET_BASE}${u}`);
  }

  /** Loads any of `groups` not yet resident. */
  async ensure(groups: string[]): Promise<void> {
    for (const g of groups) {
      if (this.loaded.has(g) || !this.manifest.atlases[g]) continue;
      const urls = this.urls(g);
      const sheets = (await Assets.load(urls)) as Record<string, Spritesheet>;
      for (const sheet of Object.values(sheets)) for (const [k, t] of Object.entries(sheet.textures)) this.textures.set(k, t);
      this.loaded.set(g, urls);
    }
  }

  /** Frees resident groups not in `keep` (never the core groups). */
  async release(keep: string[]): Promise<void> {
    for (const [g, urls] of [...this.loaded]) {
      if (CORE_GROUPS.includes(g) || keep.includes(g)) continue;
      for (const [k, grp] of Object.entries(this.manifest.sprites)) if (grp === g) this.textures.delete(k);
      this.loaded.delete(g);
      await Assets.unload(urls);
    }
  }

  tex(key: string): Texture {
    const t = this.textures.get(key);
    if (!t) {
      if (import.meta.env.DEV) console.warn(`missing sprite '${key}'`);
      return Texture.WHITE;
    }
    return t;
  }

  has(key: string): boolean {
    return this.textures.has(key);
  }
}
