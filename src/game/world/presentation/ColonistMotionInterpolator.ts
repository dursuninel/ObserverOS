import type { ColonistState, TravelTaskState } from '../../domain/workforce/Workforce';

function withTravelElapsed(colonist: ColonistState, travel: TravelTaskState, elapsedMinutes: number): ColonistState {
  return { ...colonist, travel: { ...travel, elapsedMinutes } };
}

function sameTravel(left: TravelTaskState | null, right: TravelTaskState | null): boolean {
  return left !== null && right !== null && left.id === right.id;
}

/**
 * Presentation-only previous→current interpolation. It never advances beyond
 * the latest authoritative travel progress and may intentionally render one
 * fixed step behind simulation truth.
 */
export class ColonistMotionInterpolator {
  private authoritative: ColonistState;
  private from: ColonistState;
  private progress = 1;
  private terminal: ColonistState | null = null;
  private to: ColonistState;

  constructor(initial: ColonistState) {
    this.authoritative = initial;
    this.from = initial;
    this.to = initial;
  }

  observe(next: ColonistState): void {
    if (next === this.authoritative) return;
    const sampled = this.sample();
    const previousTravel = this.authoritative.travel;
    if (sameTravel(previousTravel, next.travel)) {
      this.from = sampled;
      this.to = next;
      this.terminal = null;
      this.progress = 0;
    } else if (previousTravel !== null && next.travel === null) {
      this.from = sampled.travel === null ? this.authoritative : sampled;
      this.to = withTravelElapsed(this.authoritative, previousTravel, previousTravel.durationMinutes);
      this.terminal = next;
      this.progress = 0;
    } else {
      this.from = next;
      this.to = next;
      this.terminal = null;
      this.progress = 1;
    }
    this.authoritative = next;
  }

  advance(presentationDeltaSeconds: number, fixedStepPresentationSeconds: number): ColonistState {
    if (presentationDeltaSeconds < 0 || !Number.isFinite(presentationDeltaSeconds)) throw new Error('Presentation delta must be finite and non-negative.');
    if (fixedStepPresentationSeconds <= 0 || !Number.isFinite(fixedStepPresentationSeconds)) throw new Error('Fixed-step presentation duration must be finite and positive.');
    this.progress = Math.min(1, this.progress + presentationDeltaSeconds / fixedStepPresentationSeconds);
    return this.sample();
  }

  sample(): ColonistState {
    const fromTravel = this.from.travel;
    const toTravel = this.to.travel;
    if (fromTravel !== null && toTravel !== null && fromTravel.id === toTravel.id) {
      const elapsedMinutes = fromTravel.elapsedMinutes + (toTravel.elapsedMinutes - fromTravel.elapsedMinutes) * this.progress;
      if (this.progress === 1 && this.terminal !== null) return this.terminal;
      return withTravelElapsed(this.to, toTravel, elapsedMinutes);
    }
    return this.progress === 1 && this.terminal !== null ? this.terminal : this.to;
  }
}

export function shortestAngleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function interpolateFacing(from: number, to: number, deltaSeconds: number, responsiveness = 14): number {
  if (deltaSeconds === 0) return from;
  const alpha = 1 - Math.exp(-responsiveness * deltaSeconds);
  return from + shortestAngleDelta(from, to) * alpha;
}
