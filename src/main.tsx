import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { AppProviders } from './app/providers/AppProviders';
import { loadFoundationContent } from './game/content/loaders/loadFoundationContent';
import { i18n } from './localization/i18n';
import './styles.css';

loadFoundationContent();
document.title = i18n.t('app.title');

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Application root element was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
