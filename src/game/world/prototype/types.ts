export type FacilityId = 'reactor' | 'solar' | 'battery' | 'mine' | 'habitat' | 'oxygen';
export type ReactorVisualState = 'boost' | 'interlocked' | 'maintenance' | 'normal';
export type MineVisualState = 'maintenance' | 'offline' | 'working';
export type QualityProfileId = 'low' | 'medium' | 'high';
export type CameraPreset = 'overview' | 'reactor' | 'mine' | 'habitat';

export interface WorldMetrics {
  readonly drawCalls: number;
  readonly fps: number;
  readonly frameTimeMs: number;
  readonly geometryCount: number;
  readonly lightCount: number;
  readonly particleCount: number;
  readonly textureCount: number;
  readonly triangleCount: number;
}

export interface PrototypeDebugState {
  readonly cameraPreset: CameraPreset;
  readonly colonistCount: number;
  readonly fogEnabled: boolean;
  readonly mineState: MineVisualState;
  readonly quality: QualityProfileId;
  readonly reactorState: ReactorVisualState;
  readonly safeAreasVisible: boolean;
  readonly snowEnabled: boolean;
  readonly timeOfDay: number;
}
