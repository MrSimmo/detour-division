// Fixed-step accumulator (ADR-0003). Real time only decides how many ticks run,
// never what a tick does, so game speed cannot change outcomes (R-SIM-1).
import { MAX_TICKS_PER_FRAME, TICK_MS } from './constants.ts';

export class Clock {
  private acc = 0;

  /** Returns the number of ticks to run for `ms` of real time at `speed`× (0 = paused). */
  advance(ms: number, speed: number): number {
    this.acc += ms * speed;
    let n = Math.floor(this.acc / TICK_MS);
    if (n > MAX_TICKS_PER_FRAME) {
      n = MAX_TICKS_PER_FRAME;
      this.acc = 0;
    } else {
      this.acc -= n * TICK_MS;
    }
    return n;
  }

  /** Fraction of the way to the next tick, for render interpolation. */
  get alpha(): number {
    return Math.min(1, this.acc / TICK_MS);
  }

  reset(): void {
    this.acc = 0;
  }
}
