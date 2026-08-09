import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { loadFoundationContent } from '../../src/game/content/loaders/loadFoundationContent';
import { parseContentManifest } from '../../src/game/content/validation/parseContentManifest';

function readFixture(name: string): unknown {
  const contents = readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');
  return JSON.parse(contents) as unknown;
}

describe('content manifest validation', () => {
  it('validates the startup foundation manifest', () => {
    expect(loadFoundationContent().id).toBe('phase-zero-foundation');
  });

  it('parses a valid declarative manifest', () => {
    const manifest = parseContentManifest(
      readFixture('content-manifest.valid.json'),
      (key) => key === 'app.title',
    );

    expect(manifest.id).toBe('phase-zero-test');
  });

  it('fails fast for an invalid manifest', () => {
    expect(() =>
      parseContentManifest(readFixture('content-manifest.invalid.json'), () => true),
    ).toThrow();
  });

  it('fails fast for a missing localization key', () => {
    expect(() =>
      parseContentManifest(readFixture('content-manifest.valid.json'), () => false),
    ).toThrow(/missing localization key/);
  });
});
