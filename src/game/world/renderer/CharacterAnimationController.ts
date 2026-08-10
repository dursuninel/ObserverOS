import { LoopRepeat, type AnimationAction, type AnimationClip, type AnimationMixer, type Object3D } from 'three';

export interface ActiveCharacterAnimationState {
  readonly effectiveWeight: number;
  readonly enabled: boolean;
  readonly name: string;
  readonly running: boolean;
}

/** Stable action cache and gap-free locomotion transition controller. */
export class CharacterAnimationController {
  private activeAction: AnimationAction | null = null;
  private activeName: string | null = null;
  private readonly actions: ReadonlyMap<string, AnimationAction>;

  constructor(
    private readonly mixer: AnimationMixer,
    clips: readonly AnimationClip[],
    object: Object3D,
    private readonly fadeSeconds = 0.18,
  ) {
    this.actions = new Map(clips.map((clip) => [clip.name, mixer.clipAction(clip, object)]));
  }

  activate(name: string): boolean {
    if (this.activeName === name) return false;
    const next = this.actions.get(name);
    if (next === undefined) throw new Error(`Runtime animation clip is missing: ${name}`);
    const previous = this.activeAction;
    next.enabled = true;
    next.clampWhenFinished = false;
    next.setLoop(LoopRepeat, Number.POSITIVE_INFINITY).reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (previous !== null) previous.crossFadeTo(next, this.fadeSeconds, false);
    this.activeAction = next;
    this.activeName = name;
    this.mixer.update(0);
    return true;
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.activeAction = null;
    this.activeName = null;
  }

  getActiveName(): string | null {
    return this.activeName;
  }

  getActiveState(): ActiveCharacterAnimationState | null {
    if (this.activeAction === null || this.activeName === null) return null;
    return {
      effectiveWeight: this.activeAction.getEffectiveWeight(),
      enabled: this.activeAction.enabled,
      name: this.activeName,
      running: this.activeAction.isRunning(),
    };
  }

  isReady(): boolean {
    for (const action of this.actions.values()) {
      if (action.enabled && action.isRunning() && action.getEffectiveWeight() > 0) return true;
    }
    return false;
  }

  update(deltaSeconds: number): void {
    this.mixer.update(deltaSeconds);
  }
}
