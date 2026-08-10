import type { AnimationAction, AnimationClip, AnimationMixer, Object3D } from 'three';

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
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (previous !== null) previous.crossFadeTo(next, this.fadeSeconds, false);
    this.activeAction = next;
    this.activeName = name;
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

  update(deltaSeconds: number): void {
    this.mixer.update(deltaSeconds);
  }
}
