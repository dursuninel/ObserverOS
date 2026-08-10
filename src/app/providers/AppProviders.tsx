import type { PropsWithChildren } from 'react';
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter } from 'react-router-dom';

import { i18n } from '../../localization/i18n';
import { SimulationProvider } from './SimulationProvider';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <I18nextProvider i18n={i18n}>
      <SimulationProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </SimulationProvider>
    </I18nextProvider>
  );
}
