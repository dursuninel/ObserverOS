import { useTranslation } from 'react-i18next';

import type { PrototypeDebugState, WorldMetrics } from '../../world/prototype/types';
import type { RuntimeObjectInspection } from '../../world/renderer/runtimeObjectInspector';
import { SimulationDiagnostic } from './SimulationDiagnostic';
import type { GeneratedPlanetLayout } from '../../world/layout/layoutTypes';
import type { SeedSweepReport } from '../../world/layout/layoutGenerator';
import { LayoutCandidatePanel } from './LayoutCandidatePanel';

interface PrototypeDebugPanelProps {
  readonly candidates: readonly GeneratedPlanetLayout[];
  readonly inspection: RuntimeObjectInspection | null;
  readonly layoutMode?: 'generated' | 'prototype';
  readonly metrics: WorldMetrics;
  readonly onChange: (state: PrototypeDebugState) => void;
  readonly onCameraPreset: (preset: PrototypeDebugState['cameraPreset']) => void;
  readonly onLayoutModeChange?: (mode: 'generated' | 'prototype') => void;
  readonly onToggle: () => void;
  readonly onNewLayoutSeed: () => void;
  readonly onSelectCandidate: (index: number) => void;
  readonly open: boolean;
  readonly state: PrototypeDebugState;
  readonly seedSweep: SeedSweepReport;
  readonly selectedCandidateIndex: number;
}

export function PrototypeDebugPanel({ candidates, inspection, layoutMode, metrics, onCameraPreset, onChange, onLayoutModeChange, onNewLayoutSeed, onSelectCandidate, onToggle, open, seedSweep, selectedCandidateIndex, state }: PrototypeDebugPanelProps) {
  const { t } = useTranslation();
  const set = <Key extends keyof PrototypeDebugState>(key: Key, value: PrototypeDebugState[Key]) => onChange({ ...state, [key]: value });
  return (
    <aside aria-label={t('prototype.debug.title')} className={`prototype-debug-panel${open ? '' : ' collapsed'}`}>
      <button aria-expanded={open} className="debug-panel-toggle" onClick={onToggle} type="button">{open ? t('prototype.debug.hide') : t('prototype.debug.show')}</button>
      {open && <>
      <div className="debug-panel-heading"><span>{t('prototype.debug.title')}</span><span className="prototype-badge">{t('prototype.debug.badge')}</span></div>
      {import.meta.env.DEV && <LayoutCandidatePanel candidates={candidates} onNewSeed={onNewLayoutSeed} onSelect={onSelectCandidate} onSelectDefault={() => onLayoutModeChange?.('prototype')} seedSweep={seedSweep} selectedIndex={selectedCandidateIndex} selectedMode={layoutMode} showDefaultOption />}
      <label>{t('prototype.debug.time')}<input max="1" min="0" onChange={(event) => set('timeOfDay', Number(event.target.value))} step="0.01" type="range" value={state.timeOfDay} /></label>
      <div className="debug-toggle-row">
        <label><input checked={state.snowEnabled} onChange={(event) => set('snowEnabled', event.target.checked)} type="checkbox" />{t('prototype.debug.snow')}</label>
        <label><input checked={state.fogEnabled} onChange={(event) => set('fogEnabled', event.target.checked)} type="checkbox" />{t('prototype.debug.fog')}</label>
      </div>
      <label>{t('prototype.debug.camera')}<select onChange={(event) => onCameraPreset(event.target.value as PrototypeDebugState['cameraPreset'])} value={state.cameraPreset}><option value="overview">{t('prototype.camera.overview')}</option><option value="reactor">{t('prototype.camera.reactor')}</option><option value="mine">{t('prototype.camera.mine')}</option><option value="habitat">{t('prototype.camera.habitat')}</option></select></label>
      <button className="camera-reset-button" onClick={() => onCameraPreset('overview')} type="button">{t('prototype.camera.reset')}</button>
      <label>{t('prototype.debug.quality')}<select onChange={(event) => set('quality', event.target.value as PrototypeDebugState['quality'])} value={state.quality}><option value="low">{t('prototype.quality.low')}</option><option value="medium">{t('prototype.quality.medium')}</option><option value="high">{t('prototype.quality.high')}</option></select></label>
      <label className="debug-safe-area"><input checked={state.safeAreasVisible} onChange={(event) => set('safeAreasVisible', event.target.checked)} type="checkbox" />{t('prototype.debug.safeAreas')}</label>
      {import.meta.env.DEV && <label className="debug-safe-area"><input checked={state.layoutOverlayVisible} onChange={(event) => set('layoutOverlayVisible', event.target.checked)} type="checkbox" />{t('layoutReview.overlay')}</label>}
      {import.meta.env.DEV && <label className="debug-safe-area"><input checked={state.objectInspectorEnabled} onChange={(event) => set('objectInspectorEnabled', event.target.checked)} type="checkbox" />{t('prototype.inspector.toggle')}</label>}
      {import.meta.env.DEV && state.objectInspectorEnabled && <div className="object-inspector" data-testid="object-inspector">
        <strong>{t('prototype.inspector.title')}</strong>
        {inspection === null ? <small>{t('prototype.inspector.prompt')}</small> : <dl>
          <div><dt>{t('prototype.inspector.object')}</dt><dd>{inspection.objectName}</dd></div>
          <div><dt>{t('prototype.inspector.parent')}</dt><dd>{inspection.parentName}</dd></div>
          <div><dt>{t('prototype.inspector.asset')}</dt><dd>{inspection.runtimeAssetId}</dd></div>
          <div><dt>{t('prototype.inspector.source')}</dt><dd>{inspection.sourcePack}</dd></div>
          <div><dt>{t('prototype.inspector.position')}</dt><dd>{inspection.worldPosition.map((value) => value.toFixed(2)).join(', ')}</dd></div>
          <div><dt>{t('prototype.inspector.chain')}</dt><dd>{inspection.ancestorChain.join(' ← ')}</dd></div>
        </dl>}
      </div>}
      <dl className="performance-grid">
        <div><dt>FPS</dt><dd>{metrics.fps}</dd></div><div><dt>ms</dt><dd>{metrics.frameTimeMs}</dd></div><div><dt>{t('prototype.metrics.draw')}</dt><dd>{metrics.drawCalls}</dd></div><div><dt>{t('prototype.metrics.triangles')}</dt><dd>{metrics.triangleCount}</dd></div><div><dt>{t('prototype.metrics.geometry')}</dt><dd>{metrics.geometryCount}</dd></div><div><dt>{t('prototype.metrics.textures')}</dt><dd>{metrics.textureCount}</dd></div><div><dt>{t('prototype.metrics.lights')}</dt><dd>{metrics.lightCount}</dd></div><div><dt>{t('prototype.metrics.particles')}</dt><dd>{metrics.particleCount}</dd></div>
      </dl>
      {import.meta.env.DEV && <SimulationDiagnostic />}
      </>}
    </aside>
  );
}
