import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DEFAULT_PROTOTYPE_STATE, EMPTY_METRICS } from '../../world/prototype/prototypeConfig';
import type { PrototypeDebugState, WorldMetrics } from '../../world/prototype/types';
import type { RuntimeObjectInspection } from '../../world/renderer/runtimeObjectInspector';
import { WorldScene } from '../../world/renderer/WorldScene';
import { generateLayoutCandidates, runLayoutSeedSweep } from '../../world/layout/layoutGenerator';
import { PrototypeDebugPanel } from './PrototypeDebugPanel';

export function ColonyWorkspace() {
  const { t } = useTranslation();
  const [debugState, setDebugState] = useState<PrototypeDebugState>(DEFAULT_PROTOTYPE_STATE);
  const [metrics, setMetrics] = useState<WorldMetrics>(EMPTY_METRICS);
  const [debugPanelOpen, setDebugPanelOpen] = useState(true);
  const [cameraResetToken, setCameraResetToken] = useState(0);
  const [objectInspection, setObjectInspection] = useState<RuntimeObjectInspection | null>(null);
  const [layoutSeed, setLayoutSeed] = useState(41_001);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);
  const [layoutMode, setLayoutMode] = useState<'generated' | 'prototype'>('prototype');
  const generation = useMemo(() => import.meta.env.DEV ? generateLayoutCandidates({ seed: layoutSeed }) : null, [layoutSeed]);
  const seedSweep = useMemo(() => import.meta.env.DEV ? runLayoutSeedSweep(100, layoutSeed) : null, [layoutSeed]);
  if (generation === null || seedSweep === null) return <section aria-labelledby="colony-heading" className="workspace"><h1 id="colony-heading">{t('workspace.colony.title')}</h1><p>{t('layoutReview.productionPending')}</p></section>;
  if (generation.status === 'failure') throw new Error(`Faz 4 layout generation failed: ${generation.reasons.join(', ')}`);
  const selectedLayout = layoutMode === 'prototype' ? null : (generation.candidates[selectedCandidateIndex] ?? generation.candidates[0]);
  if (layoutMode === 'generated' && !selectedLayout) throw new Error('Faz 4 layout generation returned no visual candidates.');

  const setCameraPreset = (cameraPreset: PrototypeDebugState['cameraPreset']) => {
    setDebugState((current) => ({ ...current, cameraPreset }));
    setCameraResetToken((token) => token + 1);
  };

  return (
    <section aria-labelledby="colony-heading" className="workspace colony-prototype">
      <header className="prototype-header">
        <div><h1 id="colony-heading">{t('workspace.colony.title')}</h1><p>{t('workspace.colony.prototypeStatus')}</p></div>
        <div className="world-status"><span className="status-dot" />{t('prototype.worldStatus')}</div>
      </header>
      <div className="prototype-stage">
        <WorldScene cameraResetToken={cameraResetToken} debugPanelOpen={debugPanelOpen} debugState={debugState} layout={selectedLayout} onMetrics={setMetrics} onObjectInspection={setObjectInspection} usePrototypeLayout={layoutMode === 'prototype'} />
        <PrototypeDebugPanel candidates={generation.candidates} inspection={objectInspection} layoutMode={layoutMode} metrics={metrics} onCameraPreset={setCameraPreset} onChange={setDebugState} onLayoutModeChange={setLayoutMode} onNewLayoutSeed={() => { setLayoutSeed((seed) => seed + 1); setSelectedCandidateIndex(0); setCameraResetToken((token) => token + 1); }} onSelectCandidate={(index) => { setSelectedCandidateIndex(index); setLayoutMode('generated'); setCameraResetToken((token) => token + 1); }} onToggle={() => setDebugPanelOpen((open) => !open)} open={debugPanelOpen} seedSweep={seedSweep} selectedCandidateIndex={selectedCandidateIndex} state={debugState} />
        {debugPanelOpen && debugState.safeAreasVisible && <><div className="safe-mask safe-mask-right">{t('prototype.safe.right')}</div><div className="safe-mask safe-mask-bottom">{t('prototype.safe.bottom')}</div></>}
        <div className="prototype-legend"><span>{t('prototype.legend.pan')}</span><span>{t('prototype.legend.zoom')}</span></div>
      </div>
    </section>
  );
}
