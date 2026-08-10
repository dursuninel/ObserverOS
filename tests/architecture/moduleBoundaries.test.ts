import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(process.cwd(), 'src');
const sourceExtensions = ['.ts', '.tsx'] as const;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return sourceExtensions.includes(extname(entry.name) as '.ts' | '.tsx') ? [path] : [];
  });
}

function moduleSpecifiers(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];

  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1
    ) {
      const argument = node.arguments[0];
      if (argument !== undefined && ts.isStringLiteral(argument)) specifiers.push(argument.text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

function identifiers(file: string): Set<string> {
  const source = readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const names = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isIdentifier(node)) names.add(node.text);
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return names;
}

function resolveSourceImport(fromFile: string, specifier: string): string | undefined {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [
    ...sourceExtensions.map((extension) => `${base}${extension}`),
    ...sourceExtensions.map((extension) => resolve(base, `index${extension}`)),
  ];
  return candidates.find(existsSync);
}

function findCycle(graph: ReadonlyMap<string, readonly string[]>): string[] | undefined {
  const visited = new Set<string>();
  const active = new Set<string>();
  const stack: string[] = [];

  function visit(node: string): string[] | undefined {
    if (active.has(node)) {
      const start = stack.indexOf(node);
      return [...stack.slice(start), node];
    }
    if (visited.has(node)) return undefined;

    visited.add(node);
    active.add(node);
    stack.push(node);
    for (const dependency of graph.get(node) ?? []) {
      const cycle = visit(dependency);
      if (cycle !== undefined) return cycle;
    }
    stack.pop();
    active.delete(node);
    return undefined;
  }

  for (const node of graph.keys()) {
    const cycle = visit(node);
    if (cycle !== undefined) return cycle;
  }
  return undefined;
}

describe('module boundaries', () => {
  it('keeps simulation free of presentation and browser dependencies', () => {
    const simulationFiles = sourceFiles(resolve(sourceRoot, 'game/simulation'));
    const bannedPackages = [
      'react',
      'react-dom',
      'zustand',
      'three',
      '@react-three/fiber',
      '@xyflow/react',
    ];
    const bannedBrowserGlobals = [
      'IDBDatabase',
      'IDBFactory',
      'document',
      'indexedDB',
      'localStorage',
      'navigator',
      'sessionStorage',
      'window',
    ];

    for (const file of simulationFiles) {
      const imports = moduleSpecifiers(file);
      const names = identifiers(file);
      const source = readFileSync(file, 'utf8');

      for (const packageName of bannedPackages) {
        expect(
          imports.some(
            (specifier) => specifier === packageName || specifier.startsWith(`${packageName}/`),
          ),
          `${relative(sourceRoot, file)} imports ${packageName}`,
        ).toBe(false);
      }

      expect(
        imports.some((specifier) => specifier.includes('save/adapters')),
        `${relative(sourceRoot, file)} imports a browser storage adapter`,
      ).toBe(false);

      for (const globalName of bannedBrowserGlobals) {
        expect(names.has(globalName), `${relative(sourceRoot, file)} uses ${globalName}`).toBe(false);
      }

      for (const nondeterministicApi of ['Date.now', 'Math.random', 'performance.now', 'requestAnimationFrame']) {
        expect(source.includes(nondeterministicApi), `${relative(sourceRoot, file)} uses ${nondeterministicApi}`).toBe(false);
      }
    }
  });

  it('keeps browser storage types and globals inside the save adapter boundary', () => {
    const saveRoot = resolve(sourceRoot, 'game/save');
    const adapterRoot = resolve(saveRoot, 'adapters');
    const storageIdentifiers = ['IDBDatabase', 'IDBFactory', 'indexedDB', 'localStorage', 'sessionStorage'];

    for (const file of sourceFiles(saveRoot).filter((path) => !path.startsWith(adapterRoot))) {
      const names = identifiers(file);
      for (const identifier of storageIdentifiers) {
        expect(names.has(identifier), `${relative(sourceRoot, file)} uses ${identifier}`).toBe(false);
      }

      expect(
        moduleSpecifiers(file).some((specifier) => specifier.includes('/adapters/')),
        `${relative(sourceRoot, file)} imports a persistence adapter`,
      ).toBe(false);
    }
  });

  it('contains no circular relative source dependencies', () => {
    const files = sourceFiles(sourceRoot);
    const graph = new Map(
      files.map((file) => [
        file,
        moduleSpecifiers(file)
          .filter((specifier) => specifier.startsWith('.'))
          .map((specifier) => resolveSourceImport(file, specifier))
          .filter((dependency): dependency is string => dependency !== undefined),
      ]),
    );

    expect(findCycle(graph)).toBeUndefined();
  });

  it('keeps workforce assignment authority out of the renderer', () => {
    const rendererFiles = sourceFiles(resolve(sourceRoot, 'game/world'));
    for (const file of rendererFiles) {
      const imports = moduleSpecifiers(file);
      const source = readFileSync(file, 'utf8');
      expect(imports.some((specifier) => specifier.includes('/simulation/systems/')), `${relative(sourceRoot, file)} imports simulation systems`).toBe(false);
      for (const authorityCall of ['allocateWorkforce(', 'applyWorkforceAllocation(', 'submitFacilityCommand(', 'advanceFixedSteps(']) {
        expect(source.includes(authorityCall), `${relative(sourceRoot, file)} calls ${authorityCall}`).toBe(false);
      }
    }
  });

  it('keeps character object and mixer identity independent of animation snapshot changes', () => {
    const source = readFileSync(resolve(sourceRoot, 'game/world/renderer/RuntimeAsset.tsx'), 'utf8');
    expect(source).toContain('new AnimationMixer(object)');
    expect(source).toContain('[asset.animationClips, object]');
    expect(source).not.toContain('[animation, object]');
    expect(source).not.toContain('mixer.stopAllAction()');
  });
});
