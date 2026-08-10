import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DEFAULT_PROTOTYPE_STATE, EMPTY_METRICS } from '../../world/prototype/prototypeConfig';
import type { PrototypeDebugState, WorldMetrics } from '../../world/prototype/types';
import { WorldScene } from '../../world/renderer/WorldScene';
import { PrototypeDebugPanel } from './PrototypeDebugPanel';

export function ColonyWorkspace() {
  const { t } = useTranslation();
  const [debugState, setDebugState] = useState<PrototypeDebugState>(DEFAULT_PROTOTYPE_STATE);
  const [metrics, setMetrics] = useState<WorldMetrics>(EMPTY_METRICS);
  const [debugPanelOpen, setDebugPanelOpen] = useState(true);

  return (
    <section aria-labelledby="colony-heading" className="workspace colony-prototype">
      <header className="prototype-header">
        <div><h1 id="colony-heading">{t('workspace.colony.title')}</h1><p>{t('workspace.colony.prototypeStatus')}</p></div>
        <div className="world-status"><span className="status-dot" />{t('prototype.worldStatus')}</div>
      </header>
      <div className="prototype-stage">
        <WorldScene debugPanelOpen={debugPanelOpen} debugState={debugState} onMetrics={setMetrics} />
        <PrototypeDebugPanel metrics={metrics} onChange={setDebugState} onToggle={() => setDebugPanelOpen((open) => !open)} open={debugPanelOpen} state={debugState} />
        {debugPanelOpen && debugState.safeAreasVisible && <><div className="safe-mask safe-mask-right">{t('prototype.safe.right')}</div><div className="safe-mask safe-mask-bottom">{t('prototype.safe.bottom')}</div></>}
        <div className="prototype-legend"><span>{t('prototype.legend.pan')}</span><span>{t('prototype.legend.zoom')}</span></div>
      </div>
    </section>
  );
}
