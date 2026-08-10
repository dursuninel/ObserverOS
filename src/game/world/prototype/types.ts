export type FacilityId = 'reactor' | 'solar' | 'battery' | 'mine' | 'habitat' | 'oxygen';
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
  readonly fogEnabled: boolean;
  readonly objectInspectorEnabled: boolean;
  readonly layoutOverlayVisible: boolean;
  readonly quality: QualityProfileId;
  readonly safeAreasVisible: boolean;
  readonly snowEnabled: boolean;
  readonly timeOfDay: number;
}
