import i18next from 'i18next';

import { tr } from './tr';

export const i18n = i18next.createInstance();

void i18n.init({
  fallbackLng: 'tr',
  initImmediate: false,
  interpolation: { escapeValue: false },
  lng: 'tr',
  resources: {
    tr: { translation: tr },
  },
  showSupportNotice: false,
});

export function hasTurkishTranslation(key: string): boolean {
  return i18n.exists(key, { lng: 'tr' });
}
