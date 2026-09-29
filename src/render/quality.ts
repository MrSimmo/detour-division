// Auto quality (DESIGN.md §19). Steps down when the mean frame time stays above 18 ms for 2 s:
// particles first, then resolution to 1.5, then 1. Steps back up after 10 s under 12 ms. Frames in
// between reset both clocks, so it never flaps around a borderline frame rate.

export interface QualityLevel {
  /** Particle density multiplier. */
  density: number;
  /** Renderer resolution (device pixels per CSS pixel). */
  resolution: number;
}

const SLOW_MS = 18;
const FAST_MS = 12;
const DOWN_AFTER = 2000;
const UP_AFTER = 10000;
/** Frames in the moving mean (an exponential average of about this many). */
const MEAN_FRAMES = 10;

export class AutoQuality {
  /** 0: full; 1: fewer particles; 2: resolution 1.5; 3: resolution 1. */
  level = 0;
  private mean = 16.7;
  private slowFor = 0;
  private fastFor = 0;
  private readonly maxRes: number;

  constructor(maxResolution: number) {
    this.maxRes = maxResolution;
  }

  /** Feeds one frame's duration; true when the level changed. */
  frame(ms: number): boolean {
    this.mean += (ms - this.mean) / MEAN_FRAMES;
    if (this.mean > SLOW_MS) {
      this.slowFor += ms;
      this.fastFor = 0;
    } else if (this.mean < FAST_MS) {
      this.fastFor += ms;
      this.slowFor = 0;
    } else {
      this.slowFor = 0;
      this.fastFor = 0;
    }
    if (this.slowFor >= DOWN_AFTER && this.level < 3) {
      this.level++;
      this.slowFor = 0;
      return true;
    }
    if (this.fastFor >= UP_AFTER && this.level > 0) {
      this.level--;
      this.fastFor = 0;
      return true;
    }
    return false;
  }

  current(): QualityLevel {
    const resolution = this.level >= 3 ? 1 : this.level === 2 ? Math.min(1.5, this.maxRes) : this.maxRes;
    return { density: this.level >= 1 ? 0.5 : 1, resolution: Math.min(resolution, this.maxRes) };
  }
}
