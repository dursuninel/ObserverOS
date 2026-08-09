import { z } from 'zod';

const localizationKeySchema = z
  .string()
  .min(1)
  .regex(/^[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)+$/);

export const contentManifestSchema = z
  .object({
    id: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    localization: z
      .object({
        nameKey: localizationKeySchema,
      })
      .strict(),
    schemaVersion: z.int().positive(),
  })
  .strict();

export type ContentManifest = z.infer<typeof contentManifestSchema>;

