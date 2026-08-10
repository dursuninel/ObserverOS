import { useTranslation } from 'react-i18next';

import type { PrototypeDebugState, WorldMetrics } from '../../world/prototype/types';
import { SimulationDiagnostic } from './SimulationDiagnostic';

interface PrototypeDebugPanelProps {
  readonly metrics: WorldMetrics;
  readonly onChange: (state: PrototypeDebugState) => void;
  readonly onCameraPreset: (preset: PrototypeDebugState['cameraPreset']) => void;
  readonly onToggle: () => void;
  readonly open: boolean;
  readonly state: PrototypeDebugState;
}

export function PrototypeDebugPanel({ metrics, onCameraPreset, onChange, onToggle, open, state }: PrototypeDebugPanelProps) {
  const { t } = useTranslation();
  const set = <Key extends keyof PrototypeDebugState>(key: Key, value: PrototypeDebugState[Key]) => onChange({ ...state, [key]: value });
  return (
    <aside aria-label={t('prototype.debug.title')} className={`prototype-debug-panel${open ? '' : ' collapsed'}`}>
      <button aria-expanded={open} className="debug-panel-toggle" onClick={onToggle} type="button">{open ? t('prototype.debug.hide') : t('prototype.debug.show')}</button>
      {open && <>
      <div className="debug-panel-heading"><span>{t('prototype.debug.title')}</span><span className="prototype-badge">WORLD DEV</span></div>
      <label>{t('prototype.debug.time')}<input max="1" min="0" onChange={(event) => set('timeOfDay', Number(event.target.value))} step="0.01" type="range" value={state.timeOfDay} /></label>
      <div className="debug-toggle-row">
        <label><input checked={state.snowEnabled} onChange={(event) => set('snowEnabled', event.target.checked)} type="checkbox" />{t('prototype.debug.snow')}</label>
        <label><input checked={state.fogEnabled} onChange={(event) => set('fogEnabled', event.target.checked)} type="checkbox" />{t('prototype.debug.fog')}</label>
      </div>
      <label>{t('prototype.debug.camera')}<select onChange={(event) => onCameraPreset(event.target.value as PrototypeDebugState['cameraPreset'])} value={state.cameraPreset}><option value="overview">{t('prototype.camera.overview')}</option><option value="reactor">{t('prototype.camera.reactor')}</option><option value="mine">{t('prototype.camera.mine')}</option><option value="habitat">{t('prototype.camera.habitat')}</option></select></label>
      <button className="camera-reset-button" onClick={() => onCameraPreset('overview')} type="button">{t('prototype.camera.reset')}</button>
      <label>{t('prototype.debug.quality')}<select onChange={(event) => set('quality', event.target.value as PrototypeDebugState['quality'])} value={state.quality}><option value="low">{t('prototype.quality.low')}</option><option value="medium">{t('prototype.quality.medium')}</option><option value="high">{t('prototype.quality.high')}</option></select></label>
      <label className="debug-safe-area"><input checked={state.safeAreasVisible} onChange={(event) => set('safeAreasVisible', event.target.checked)} type="checkbox" />{t('prototype.debug.safeAreas')}</label>
      <dl className="performance-grid">
        <div><dt>FPS</dt><dd>{metrics.fps}</dd></div><div><dt>ms</dt><dd>{metrics.frameTimeMs}</dd></div><div><dt>Draw</dt><dd>{metrics.drawCalls}</dd></div><div><dt>Tri</dt><dd>{metrics.triangleCount}</dd></div><div><dt>Geo</dt><dd>{metrics.geometryCount}</dd></div><div><dt>Tex</dt><dd>{metrics.textureCount}</dd></div><div><dt>Light</dt><dd>{metrics.lightCount}</dd></div><div><dt>Particles</dt><dd>{metrics.particleCount}</dd></div>
      </dl>
      {import.meta.env.DEV && <SimulationDiagnostic />}
      </>}
    </aside>
  );
}
