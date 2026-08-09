import { useTranslation } from 'react-i18next';

export function DebuggerWorkspace() {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="debugger-heading" className="workspace workspace-empty">
      <div className="workspace-copy">
        <h1 id="debugger-heading">{t('workspace.debugger.title')}</h1>
        <p>{t('workspace.debugger.foundationStatus')}</p>
      </div>
    </section>
  );
}

