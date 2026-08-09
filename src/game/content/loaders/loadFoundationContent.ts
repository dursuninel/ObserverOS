import { hasTurkishTranslation } from '../../../localization/i18n';
import { foundationContentManifest } from '../manifests/foundation';
import { parseContentManifest } from '../validation/parseContentManifest';

/** Startup validation boundary. Invalid declarative content fails before rendering. */
export function loadFoundationContent() {
  return parseContentManifest(foundationContentManifest, hasTurkishTranslation);
}

