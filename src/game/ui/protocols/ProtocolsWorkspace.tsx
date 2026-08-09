import { useTranslation } from 'react-i18next';

import { ProtocolFlowBoundary } from './ProtocolFlowBoundary';

export function ProtocolsWorkspace() {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="protocols-heading" className="workspace">
      <div className="workspace-copy">
        <h1 id="protocols-heading">{t('workspace.protocols.title')}</h1>
        <p>{t('workspace.protocols.foundationStatus')}</p>
      </div>
      <ProtocolFlowBoundary />
    </section>
  );
}

