import type { ContentManifest } from '../schemas/ContentManifestSchema';
import { contentManifestSchema } from '../schemas/ContentManifestSchema';

export type LocalizationKeyLookup = (key: string) => boolean;

export function parseContentManifest(
  input: unknown,
  hasLocalizationKey: LocalizationKeyLookup,
): ContentManifest {
  const manifest = contentManifestSchema.parse(input);

  if (!hasLocalizationKey(manifest.localization.nameKey)) {
    throw new Error(
      `Content manifest "${manifest.id}" references missing localization key "${manifest.localization.nameKey}".`,
    );
  }

  return manifest;
}

