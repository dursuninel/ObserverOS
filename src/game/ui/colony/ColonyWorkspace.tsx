import { useTranslation } from 'react-i18next';

import { WorldScene } from '../../world/renderer/WorldScene';

export function ColonyWorkspace() {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="colony-heading" className="workspace">
      <div className="workspace-copy">
        <h1 id="colony-heading">{t('workspace.colony.title')}</h1>
        <p>{t('workspace.colony.foundationStatus')}</p>
      </div>
      <WorldScene />
    </section>
  );
}

